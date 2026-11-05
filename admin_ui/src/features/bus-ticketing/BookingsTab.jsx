import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  BookingChip, EmptyState, ErrorBanner, ErrorState, FilterPills, SearchBox, Pager, ConfirmDialog, SkeletonRows, SkeletonCards, Card, Stat, CompanyAvatar, thClass,
  formatUgx, formatNumber, formatEatDateTime, formatEatShort, formatEatDay, INK, MUTED, FAINT, LINE, NAVY
} from './shared.jsx';
import { listBookings, markRefunded, listOperators } from './api.js';

const LIMIT = 25;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'refund_due', label: 'Refund due' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' }
];

const RefundButton = ({ onClick, block }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap hover:opacity-90 inline-flex items-center justify-center gap-1.5 ${block ? 'w-full' : ''}`}
    style={{ backgroundColor: '#E11D48' }}
  >
    <i className="ph ph-arrow-u-up-left text-sm"></i> Mark refunded
  </button>
);

const BookingCard = ({ b, logo, onRefund }) => {
  const refundDue = b.status === 'refund_due';
  return (
    <Card className="p-4 relative overflow-hidden" style={refundDue ? { borderColor: '#FECDD3', backgroundColor: '#FFFBFB' } : undefined}>
      {refundDue ? <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: '#E11D48' }}></span> : null}
      <div className="flex items-start gap-3">
        <CompanyAvatar name={b.company} url={logo} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] truncate" style={{ color: INK }}>{b.route}</p>
          <p className="text-xs truncate" style={{ color: MUTED }}>{b.company}</p>
        </div>
        <BookingChip status={b.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
        <Stat label="Departs">{formatEatShort(b.departureAt)}</Stat>
        <Stat label="Total"><span style={{ color: NAVY }}>{formatUgx(b.total)}</span></Stat>
        <Stat label="Passenger">{b.passengerName}</Stat>
        <Stat label="Seats">{formatNumber(b.seatCount)}</Stat>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] tabular-nums" style={{ color: FAINT }}>
        <span className="font-mono font-semibold tracking-wide" style={{ color: NAVY }}>{b.reference}</span>
        <span>Fee {formatUgx(b.fee)}</span>
      </div>
      {refundDue ? <div className="mt-3"><RefundButton block onClick={() => onRefund(b)} /></div> : null}
    </Card>
  );
};

export const BookingsTab = ({ token, status, onStatusChange, notify, onChanged }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [refundTarget, setRefundTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logos, setLogos] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listBookings(token, { status, q: query, page, limit: LIMIT });
      setItems(res?.items || []);
      setTotal(res?.total || 0);
    } catch (e) {
      setError(e.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [token, status, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Bookings only carry the company name, so fetch the companies once to show their logos (best effort).
  useEffect(() => {
    let live = true;
    listOperators(token, { limit: 100 })
      .then((res) => {
        if (live) setLogos(Object.fromEntries((res?.items || []).map((op) => [op.companyName, op.logoUrl])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setBusy(true);
    try {
      await markRefunded(token, refundTarget.id);
      notify(`Booking ${refundTarget.reference} marked as refunded`);
      setRefundTarget(null);
      await load();
      onChanged?.();
    } catch (e) {
      notify(e.message || 'Could not mark this booking as refunded', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Mobile cards are grouped under the day they were booked, like an agenda.
  const groups = useMemo(() => {
    const out = [];
    items.forEach((b) => {
      const label = formatEatDay(b.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(b);
      else out.push({ label, items: [b] });
    });
    return out;
  }, [items]);

  const hasData = items.length > 0;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search reference, name or phone..." />
        <p className="text-xs tabular-nums hidden sm:block" style={{ color: MUTED }}>{hasData || status || query ? `${formatNumber(total)} booking${total === 1 ? '' : 's'}` : ''}</p>
      </div>
      <FilterPills options={STATUS_FILTERS} value={status} onChange={(value) => { onStatusChange(value); setPage(1); }} />

      {hasData ? <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={load} /> : null}

      {loading && !hasData ? (
        <>
          <div className="xl:hidden"><SkeletonCards count={5} className="grid grid-cols-1 sm:grid-cols-2 gap-4" /></div>
          <div className="hidden xl:block"><SkeletonRows rows={8} /></div>
        </>
      ) : error && !hasData ? (
        <ErrorState message={error} onRetry={load} />
      ) : !hasData ? (
        <EmptyState icon="ph-ticket" title={status || query ? 'No bookings match' : 'No bookings yet'}>
          {status || query ? 'Try clearing the search or picking another status.' : 'Bookings appear here as soon as passengers start buying tickets.'}
        </EmptyState>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }} className="transition-opacity">
          {/* Mobile / tablet: agenda of cards */}
          <div className="xl:hidden space-y-5">
            {groups.map((g) => (
              <section key={g.label}>
                <div className="flex items-center gap-3 mb-2.5 px-1">
                  <h4 className="text-[10.5px] font-bold uppercase tracking-[0.09em]" style={{ color: FAINT }}>Booked {g.label}</h4>
                  <span className="flex-1 h-px" style={{ backgroundColor: LINE }}></span>
                  <span className="text-[11px] tabular-nums font-semibold" style={{ color: FAINT }}>{g.items.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.items.map((b) => (
                    <BookingCard key={b.id} b={b} logo={logos[b.company]} onRefund={setRefundTarget} />
                  ))}
                </div>
              </section>
            ))}
            <Card className="overflow-hidden"><Pager page={page} limit={LIMIT} total={total} onPage={setPage} /></Card>
          </div>

          {/* Desktop: table */}
          <Card className="hidden xl:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: LINE, color: FAINT, backgroundColor: '#FBFCFD' }}>
                  <th className={thClass}>Reference</th>
                  <th className={thClass}>Company</th>
                  <th className={thClass}>Trip</th>
                  <th className={thClass}>Passenger</th>
                  <th className={`${thClass} text-right`}>Seats</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => {
                  const refundDue = b.status === 'refund_due';
                  return (
                    <tr
                      key={b.id}
                      className="border-b last:border-0 hover:bg-slate-50/60 transition"
                      style={{ borderColor: '#F1F5F9', backgroundColor: refundDue ? 'rgba(255,241,242,0.8)' : undefined, boxShadow: refundDue ? 'inset 3px 0 0 #E11D48' : undefined }}
                    >
                      <td className="p-3.5 min-w-[130px]">
                        <p className="font-mono text-xs font-bold tracking-wide" style={{ color: NAVY }}>{b.reference}</p>
                        <p className="text-[11px] mt-0.5 max-w-[150px] tabular-nums" style={{ color: FAINT }}>Booked {formatEatDateTime(b.createdAt)}</p>
                      </td>
                      <td className="p-3.5 min-w-[160px]">
                        <div className="flex items-center gap-2.5">
                          <CompanyAvatar name={b.company} url={logos[b.company]} size={30} radius={9} />
                          <span className="font-medium" style={{ color: INK }}>{b.company}</span>
                        </div>
                      </td>
                      <td className="p-3.5 min-w-[170px]">
                        <p className="font-semibold" style={{ color: INK }}>{b.route}</p>
                        <p className="text-xs tabular-nums" style={{ color: FAINT }}>Departs {formatEatShort(b.departureAt)}</p>
                      </td>
                      <td className="p-3.5 min-w-[130px]">
                        <p className="font-medium" style={{ color: INK }}>{b.passengerName}</p>
                        <p className="text-xs tabular-nums" style={{ color: FAINT }}>{b.passengerPhone}</p>
                      </td>
                      <td className="p-3.5 text-right tabular-nums">{formatNumber(b.seatCount)}</td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <p className="font-bold tabular-nums" style={{ color: NAVY }}>{formatUgx(b.total)}</p>
                        <p className="text-xs tabular-nums" style={{ color: FAINT }}>Fee {formatUgx(b.fee)}</p>
                      </td>
                      <td className="p-3.5"><BookingChip status={b.status} /></td>
                      <td className="p-3.5 text-right">{refundDue ? <RefundButton onClick={() => setRefundTarget(b)} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(refundTarget)}
        tone="danger"
        title={`Mark ${refundTarget?.reference} as refunded?`}
        description={`Only do this after you have paid ${formatUgx(refundTarget?.total)} back to ${refundTarget?.passengerName || 'the passenger'} by mobile money (${refundTarget?.payPhone || refundTarget?.passengerPhone || 'no phone on file'}). This closes the booking and can't be undone.`}
        confirmLabel="Yes, I've refunded them"
        busy={busy}
        onConfirm={confirmRefund}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
};
