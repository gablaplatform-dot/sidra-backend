import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  PayoutChip, EmptyState, ErrorBanner, ErrorState, FilterPills, ModalShell, ModalHeader, FieldLabel, PrimaryButton, GhostButton, Card, Eyebrow, CompanyAvatar,
  SkeletonCards, SkeletonRows, Skeleton, thClass, formatUgx, compactUgx, formatNumber, formatEatDateTime, inputClass, inputStyle, INK, MUTED, FAINT, LINE, NAVY, GOLD
} from './shared.jsx';
import { listPayouts, processPayout, listOperators } from './api.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' }
];

const ProcessModal = ({ target, token, onClose, onDone, onError }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const paying = target?.action === 'paid';

  useEffect(() => {
    if (target) setNote('');
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await processPayout(token, target.payout.id, { status: target.action, note: note.trim() });
      await onDone(paying ? `Payout to ${target.payout.operator?.companyName || 'company'} marked as paid` : 'Payout rejected - the money is back in the company wallet');
    } catch (e) {
      onError(e.message || 'Could not process this payout');
    } finally {
      setSaving(false);
    }
  };

  const payout = target?.payout;
  return (
    <ModalShell open={Boolean(target)} onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader
        title={paying ? 'Mark payout as paid' : 'Reject payout request'}
        subtitle={payout ? `${payout.operator?.companyName || 'Company'} - ${formatUgx(payout.amount)}` : ''}
        onClose={onClose}
      />
      <div className="px-6 pb-2 space-y-4 overflow-y-auto">
        {paying ? (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }}>
            Send <strong>{formatUgx(payout?.amount)}</strong> by mobile money to <strong>{payout?.phone}</strong> first, then confirm here. Gabla does not move the money for you.
          </div>
        ) : (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#FECDD3', backgroundColor: '#FFF1F2', color: '#9F1239' }}>
            Rejecting returns <strong>{formatUgx(payout?.amount)}</strong> to the company's wallet balance. Tell them why in the note.
          </div>
        )}
        <div>
          <FieldLabel>{paying ? 'Note (optional)' : 'Reason for the company'}</FieldLabel>
          <textarea
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={paying ? 'e.g. MTN MoMo transaction ID' : 'e.g. Please confirm the payout phone number'}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
      <div className="p-6 pt-4 flex justify-end gap-3 flex-shrink-0">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: paying ? '#0B2046' : '#9F1239' }}
        >
          {saving ? 'Saving...' : paying ? "I've sent the money" : 'Reject payout'}
        </button>
      </div>
    </ModalShell>
  );
};

const copyText = async (text, notify, done) => {
  try {
    await navigator.clipboard.writeText(text);
    notify(done);
  } catch {
    notify('Could not copy - select the number and copy it manually', 'error');
  }
};

// Balance-style summary cards (money first, count underneath).
const BalanceCard = ({ label, amount, count, icon, tone, loading }) => {
  const tones = {
    navy: { bg: `linear-gradient(135deg, ${NAVY}, #1B3A78)`, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.65)', chip: 'rgba(255,255,255,0.14)', glow: GOLD },
    emerald: { bg: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', ink: '#065F46', muted: 'rgba(6,95,70,0.7)', chip: 'rgba(255,255,255,0.7)', glow: '#34D399' },
    rose: { bg: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', ink: '#9F1239', muted: 'rgba(159,18,57,0.7)', chip: 'rgba(255,255,255,0.7)', glow: '#FB7185' }
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 border min-w-[80%] sm:min-w-0 snap-start" style={{ background: tones.bg, borderColor: tone === 'navy' ? NAVY : 'rgba(226,232,240,0.8)', color: tones.ink, boxShadow: '0 14px 30px -20px rgba(11,32,70,0.5)' }}>
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-25 blur-sm" style={{ backgroundColor: tones.glow }}></div>
      <div className="flex items-center justify-between relative">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.09em]" style={{ color: tones.muted }}>{label}</p>
        <span className="w-8 h-8 rounded-xl inline-flex items-center justify-center" style={{ backgroundColor: tones.chip }}><i className={`ph ${icon} text-lg`}></i></span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-40 mt-3" />
      ) : (
        <p className="relative mt-2 text-2xl sm:text-[26px] font-extrabold tracking-tight tabular-nums">{formatUgx(amount)}</p>
      )}
      <p className="relative mt-1 text-xs font-medium tabular-nums" style={{ color: tones.muted }}>{loading ? ' ' : `${formatNumber(count)} request${count === 1 ? '' : 's'}`}</p>
    </div>
  );
};

// Two-step timeline: requested -> paid / rejected (or still waiting).
const Timeline = ({ p, compact }) => {
  const done = p.status !== 'requested';
  const steps = [
    { key: 'req', label: 'Requested', at: p.createdAt, color: '#F59E0B', filled: true },
    done
      ? { key: 'end', label: p.status === 'paid' ? 'Paid' : 'Rejected', at: p.processedAt, color: p.status === 'paid' ? '#10B981' : '#F43F5E', filled: true }
      : { key: 'end', label: 'Waiting for payment', at: null, color: '#CBD5E1', filled: false }
  ];
  return (
    <ol className={`relative ${compact ? 'space-y-2.5' : 'space-y-3'} ml-1.5 pl-4 border-l`} style={{ borderColor: LINE }}>
      {steps.map((st) => (
        <li key={st.key} className="relative">
          <span
            className="absolute -left-[22.5px] top-[3px] w-3 h-3 rounded-full"
            style={st.filled ? { backgroundColor: st.color, boxShadow: '0 0 0 3px #fff' } : { backgroundColor: '#fff', border: `2px dashed ${st.color}`, boxShadow: '0 0 0 2px #fff' }}
          ></span>
          <p className="text-xs font-bold leading-4" style={{ color: st.filled ? INK : FAINT }}>{st.label}</p>
          {st.at ? <p className="text-[11px] tabular-nums leading-4" style={{ color: MUTED }}>{formatEatDateTime(st.at)}</p> : null}
        </li>
      ))}
    </ol>
  );
};

const PayoutActions = ({ p, onPay, onReject, block }) =>
  p.status === 'requested' ? (
    <div className={block ? 'flex items-center gap-2' : 'flex flex-col gap-1.5 w-28 ml-auto'}>
      <button type="button" onClick={() => onPay(p)} className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap hover:opacity-90 inline-flex items-center justify-center gap-1.5 ${block ? 'flex-1' : ''}`} style={{ backgroundColor: NAVY }}>
        <i className="ph ph-check-circle text-sm"></i> Mark paid
      </button>
      <button type="button" onClick={() => onReject(p)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border text-rose-700 whitespace-nowrap hover:bg-rose-50 ${block ? 'flex-1' : ''}`} style={{ borderColor: '#FECDD3' }}>
        Reject
      </button>
    </div>
  ) : null;

export const PayoutsTab = ({ token, status, onStatusChange, notify, onChanged }) => {
  const [all, setAll] = useState([]);
  const [operators, setOperators] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);

  // The API returns up to 200 payouts and has no pagination, so fetch once and filter in the browser.
  // That keeps the pill counts and the summary cards honest whichever filter is selected.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPayouts(token, {});
      setAll(res?.items || []);
    } catch (e) {
      setError(e.message || 'Unable to load payouts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let live = true;
    listOperators(token, { limit: 100 })
      .then((res) => {
        if (live) setOperators(Object.fromEntries((res?.items || []).map((op) => [op.id, op])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  const done = async (message) => {
    setTarget(null);
    await load();
    onChanged?.();
    notify(message);
  };

  const totals = useMemo(() => {
    const t = { requested: { n: 0, sum: 0 }, paid: { n: 0, sum: 0 }, rejected: { n: 0, sum: 0 } };
    all.forEach((p) => {
      if (t[p.status]) {
        t[p.status].n += 1;
        t[p.status].sum += Number(p.amount || 0);
      }
    });
    return t;
  }, [all]);

  const filters = FILTERS.map((f) => ({ ...f, count: f.value ? totals[f.value].n : all.length }));
  const items = status ? all.filter((p) => p.status === status) : all;
  const hasData = all.length > 0;
  const firstLoad = loading && !hasData;
  const logoFor = (p) => operators[p.operatorId]?.logoUrl;
  const pay = (p) => setTarget({ payout: p, action: 'paid' });
  const reject = (p) => setTarget({ payout: p, action: 'rejected' });

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex sm:grid sm:grid-cols-3 gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory bus-hide-scroll -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
        <BalanceCard label="Awaiting payout" amount={totals.requested.sum} count={totals.requested.n} icon="ph-hourglass-medium" tone="navy" loading={firstLoad} />
        <BalanceCard label="Paid out" amount={totals.paid.sum} count={totals.paid.n} icon="ph-check-circle" tone="emerald" loading={firstLoad} />
        <BalanceCard label="Rejected" amount={totals.rejected.sum} count={totals.rejected.n} icon="ph-x-circle" tone="rose" loading={firstLoad} />
      </div>

      <FilterPills options={filters} value={status} onChange={onStatusChange} />
      {hasData ? <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={load} /> : null}

      {firstLoad ? (
        <>
          <div className="xl:hidden"><SkeletonCards count={4} className="grid grid-cols-1 sm:grid-cols-2 gap-4" /></div>
          <div className="hidden xl:block"><SkeletonRows rows={5} /></div>
        </>
      ) : error && !hasData ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items.length ? (
        <EmptyState icon="ph-hand-coins" title={status ? 'No payouts with this status' : 'No payout requests yet'}>
          {status ? 'Pick another status to see more.' : 'When a company asks to cash out its wallet, the request lands here for you to pay by mobile money.'}
        </EmptyState>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }} className="transition-opacity">
          {/* Mobile / tablet: payout cards */}
          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((p) => (
              <Card key={p.id} className="p-4" style={p.status === 'requested' ? { borderColor: '#FDE68A' } : undefined}>
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={p.operator?.companyName} url={logoFor(p)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[15px] truncate" style={{ color: INK }}>{p.operator?.companyName || '-'}</p>
                    <p className="text-xs tabular-nums truncate" style={{ color: FAINT }}>{operators[p.operatorId] ? `Wallet ${compactUgx(operators[p.operatorId].walletBalance)}` : p.operator?.contactPhone || ''}</p>
                  </div>
                  <PayoutChip status={p.status} />
                </div>
                <p className="mt-3 text-[26px] leading-8 font-extrabold tracking-tight tabular-nums" style={{ color: NAVY }}>{formatUgx(p.amount)}</p>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
                  <div className="min-w-0">
                    <Eyebrow>Send to</Eyebrow>
                    <p className="text-sm font-bold tabular-nums" style={{ color: INK }}>{p.phone}</p>
                  </div>
                  <button type="button" onClick={() => copyText(p.phone, notify, 'Phone number copied')} className="p-2 rounded-lg hover:bg-white border" style={{ borderColor: LINE, color: MUTED }} aria-label="Copy phone number"><i className="ph ph-copy"></i></button>
                </div>
                <div className="mt-4"><Timeline p={p} compact /></div>
                {p.note ? (
                  <p className="mt-3 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#F8FAFC', color: MUTED }}><i className="ph ph-note-pencil mr-1"></i>{p.note}</p>
                ) : null}
                {p.status === 'requested' ? <div className="mt-4"><PayoutActions p={p} onPay={pay} onReject={reject} block /></div> : null}
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden xl:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: LINE, color: FAINT, backgroundColor: '#FBFCFD' }}>
                  <th className={thClass}>Company</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>Send to</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Timeline</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 align-top hover:bg-slate-50/60 transition" style={{ borderColor: '#F1F5F9' }}>
                    <td className="p-3.5">
                      <div className="flex items-center gap-3 min-w-[170px]">
                        <CompanyAvatar name={p.operator?.companyName} url={logoFor(p)} size={38} />
                        <div className="min-w-0">
                          <p className="font-bold truncate" style={{ color: INK }}>{p.operator?.companyName || '-'}</p>
                          <p className="text-xs tabular-nums" style={{ color: FAINT }}>{p.operator?.contactPhone || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-extrabold whitespace-nowrap tabular-nums" style={{ color: NAVY }}>{formatUgx(p.amount)}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <button type="button" onClick={() => copyText(p.phone, notify, 'Phone number copied')} className="inline-flex items-center gap-1.5 tabular-nums font-medium hover:underline" title="Copy number" style={{ color: INK }}>
                        {p.phone} <i className="ph ph-copy text-sm" style={{ color: FAINT }}></i>
                      </button>
                    </td>
                    <td className="p-3.5"><PayoutChip status={p.status} /></td>
                    <td className="p-3.5 min-w-[170px] max-w-[240px]">
                      <Timeline p={p} compact />
                      {p.note ? <p className="mt-2 text-[11px] leading-snug" style={{ color: MUTED }}><i className="ph ph-note-pencil mr-1"></i>{p.note}</p> : null}
                    </td>
                    <td className="p-3.5"><PayoutActions p={p} onPay={pay} onReject={reject} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs px-1 tabular-nums" style={{ color: MUTED }}>Showing {items.length} of {all.length} payout request{all.length === 1 ? '' : 's'}{all.length >= 200 ? ' (the 200 most recent)' : ''}.</p>
        </div>
      )}

      <ProcessModal target={target} token={token} onClose={() => setTarget(null)} onDone={done} onError={(message) => notify(message, 'error')} />
    </div>
  );
};
