import React, { useEffect, useState } from 'react';

const money = (amount) => `UGX ${Number(amount ?? 0).toLocaleString()}`;
const date = (value) => value ? new Date(value).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' }) : '—';
const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const action = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function EventTicketDesk({ event, token, request, onChange }) {
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ q: '', status: '' });
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const endpoint = `/events/admin/${event.id}`;
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page });
    Object.entries(filter).forEach(([k, v]) => { if (v) params.set(k, v); });
    setLoading(true);
    request(`${endpoint}/ticket-orders?${params}`, { token }).then((data) => {
      if (active) setReport(data);
    }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, token, request, page, filter, version]);

  async function save(path, method, body, refreshEvents = false) {
    setBusy(true);
    setError('');
    try {
      await request(endpoint + path, { token, method, body: JSON.stringify(body) });
      if (refreshEvents) onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setVersion((v) => v + 1);
      setBusy(false);
    }
  }

  const config = report?.salesConfig;
  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5" aria-label={`Ticket desk for ${event.title}`}>
    <header><p className="text-xs font-bold uppercase tracking-widest text-rose-700">Ticket desk</p><h2 className="mt-1 text-xl font-bold">{event.title}</h2></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {!report ? <p>{loading ? 'Loading ticket sales…' : 'Ticket sales could not be loaded.'}</p> : <>
      <form key={`${config?.enabled}-${config?.price}-${config?.capacity}`} className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        save('/ticket-sales', 'PUT', { enabled: values.has('enabled'), price: Number(values.get('price')), capacity: Number(values.get('capacity')) }, true);
      }}>
        <label className="grid gap-1 text-sm">Price per pass (UGX)<input className={control} name="price" type="number" min="500" max="10000000" required defaultValue={config?.price || Math.max(500, Math.round(event.payMin || 0))}/></label>
        <label className="grid gap-1 text-sm">Capacity<input className={control} name="capacity" type="number" min="1" max="100000" required defaultValue={config?.capacity}/></label>
        <label className="flex items-center gap-2 self-center text-sm"><input name="enabled" type="checkbox" defaultChecked={config?.enabled}/> Allow online sales</label>
        <button className={action} disabled={busy}>Save sales settings</button>
      </form>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Passes sold', report.sales.quantity ?? 0], ['Gross collected', money(report.sales.total)], ['Available to settle', money(report.available)]].map(([label, value]) =>
          <div key={label} className="rounded-lg bg-slate-100 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div><strong className="mt-2 block text-lg tabular-nums">{value}</strong></div>)}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        setPage(1);
        setFilter({ q: values.get('q').trim(), status: values.get('status') });
      }}>
        <input className={control} name="q" placeholder="Buyer, email, phone or ticket" aria-label="Search ticket orders"/>
        <select className={control} name="status" aria-label="Payment status"><option value="">All payments</option><option value="paid">Paid</option><option value="pending_payment">Pending</option><option value="failed">Failed</option><option value="refund_due">Refund due</option><option value="refunded">Refunded</option></select>
        <button className={action}>Filter orders</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Buyer', 'Payment', 'Paid at (EAT)', 'Passes', 'Email'].map((heading) => <th key={heading} scope="col" className="p-3">{heading}</th>)}</tr></thead>
          <tbody>{report.items.map((order) => <tr className="border-b align-top" key={order.id}>
            <td className="p-3"><strong>{order.buyerName}</strong><div>{order.buyerEmail}</div>{order.accountEmail && order.accountEmail !== order.buyerEmail && <div>Account {order.accountEmail}</div>}{order.payerEmail && order.payerEmail !== order.buyerEmail && <div>Gateway email {order.payerEmail}</div>}<div>{order.payerPhone}</div><small className="text-slate-500">{order.buyerId}</small></td>
            <td className="p-3"><strong>{money(order.total)}</strong>{order.receivedAmount != null && order.receivedAmount !== order.total && <div>Received {money(order.receivedAmount)}</div>}<div className="capitalize">{order.status.replaceAll('_', ' ')}</div></td>
            <td className="p-3">{date(order.paidAt)}{order.gatewayPaidAt && <div className="text-xs text-slate-500">Gateway {String(order.gatewayPaidAt)}</div>}</td>
            <td className="p-3">{order.quantity} × {money(order.unitPrice)}{order.tickets.map((ticket) => <div className="mt-1 font-mono text-xs" key={ticket.number}>{ticket.number} {ticket.usedAt && '· Used'}</div>)}</td>
            <td className="p-3 capitalize">{order.emailStatus.replaceAll('_', ' ')}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {report.items.length === 0 && <p className="text-sm text-slate-600">{loading ? 'Loading orders…' : 'No orders match these filters.'}</p>}
      <div className="flex items-center justify-between text-sm"><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {report.total} orders</span><button disabled={page * 25 >= report.total || loading} onClick={() => setPage(page + 1)}>Next</button></div>
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-bold">Organizer payout</h3>
        <p className="text-sm text-slate-600">{report.owner.name} · {report.owner.phone || 'No account phone'} · Available after the event ends</p>
        {report.canSettle && report.available > 0 && report.owner.phone && <button className={action} disabled={busy} onClick={() => {
          if (window.confirm(`Send ${money(report.available)} to ${report.owner.name} at ${report.owner.phone}?`)) {
            save('/ticket-payouts', 'POST', { phone: report.owner.phone.replace(/[^+\d]/g, '') });
          }
        }}>Settle {money(report.available)}</button>}
        {report.payouts.map((payout) => <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm" key={payout.id}>
          <strong>{money(payout.amount)}</strong><span>{payout.phone} · {date(payout.createdAt)}</span><span className="capitalize">{payout.status}</span><span className="font-mono text-xs">event-payout-{payout.id}</span>
          {payout.reconciliationNote && <span>{payout.reconciliationNote}</span>}
          {(payout.status === 'unknown' || payout.status === 'processing' && Date.now() - Date.parse(payout.createdAt) > 300000) &&
            ['paid', 'failed'].map((status) => <button key={status} className={control} disabled={busy} onClick={() => {
              const note = window.prompt('Check the gateway statement first. Enter the evidence and reference for this outcome.');
              if (note?.trim()) save(`/ticket-payouts/${payout.id}`, 'PATCH', { status, note });
            }}>Record {status}</button>)}
        </div>)}
      </div>
    </>}
  </section>;
}
