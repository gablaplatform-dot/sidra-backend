import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Card, CardHeader, Eyebrow, Chip, BookingChip, CompanyAvatar, Rating, Skeleton, ErrorBanner, ErrorState, EmptyState, companyState,
  formatUgx, formatNumber, compactUgx, compactNumber, formatEatShort, formatEatTime,
  INK, MUTED, FAINT, LINE, NAVY, GOLD
} from './shared.jsx';
import { listOperators, listBookings, listPayouts } from './api.js';

// ---------------------------------------------------------------------------------------------
// KPI strip. Same pastel-gradient language as the main dashboard, but compact enough to sit six
// across on desktop and two across on a phone. Each card jumps to the tab that explains the number.
const KPIS = [
  { key: 'grossSales', label: 'Gross sales', icon: 'ph-currency-circle-dollar', from: '#FEF3C7', to: '#FDE68A', money: true, target: { tab: 'bookings', status: 'confirmed' } },
  { key: 'commissionEarned', label: 'Commission', icon: 'ph-percent', from: '#CCFBF1', to: '#99F6E4', money: true, target: { tab: 'bookings', status: 'confirmed' } },
  { key: 'tickets', label: 'Tickets sold', icon: 'ph-ticket', from: '#DCEBFF', to: '#BFD8FF', target: { tab: 'bookings', status: 'confirmed' } },
  { key: 'operators', label: 'Active companies', icon: 'ph-bus', from: '#E0E7FF', to: '#C7D2FE', target: { tab: 'companies' } },
  { key: 'refundsDue', label: 'Refunds due', icon: 'ph-arrow-u-up-left', from: '#FFE4E6', to: '#FECDD3', target: { tab: 'bookings', status: 'refund_due' }, alert: 'rose' },
  { key: 'payoutsPending', label: 'Payouts pending', icon: 'ph-hand-coins', from: '#FFEDD5', to: '#FED7AA', target: { tab: 'payouts', status: 'requested' }, alert: 'amber' }
];

const KpiSkeletons = () => (
  <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 md:gap-4" role="status" aria-label="Loading">
    {KPIS.map((k) => (
      <Card key={k.key} className="p-4">
        <Skeleton className="w-10 h-10 !rounded-xl" />
        <Skeleton className="h-3 w-20 mt-4" />
        <Skeleton className="h-6 w-28 mt-2" />
        <Skeleton className="h-3 w-24 mt-3" />
      </Card>
    ))}
  </div>
);

const Kpi = ({ card, value, sub, goTo, needsAction }) => {
  const ring = needsAction ? (card.alert === 'rose' ? 'rgba(225,29,72,0.35)' : 'rgba(234,88,12,0.35)') : LINE;
  return (
    <button
      type="button"
      onClick={() => goTo(card.target.tab, card.target.status)}
      className="bus-lift text-left p-4 rounded-2xl border bg-white relative overflow-hidden group min-w-0"
      style={{ borderColor: ring, boxShadow: needsAction ? `0 0 0 3px ${ring.replace('0.35', '0.08')}` : '0 1px 2px rgba(15,23,42,0.03)' }}
    >
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-60" style={{ background: `linear-gradient(135deg, ${card.from}, ${card.to})` }}></div>
      <div className="relative w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${card.from}, ${card.to})`, color: NAVY }}>
        <i className={`ph ${card.icon} text-xl`}></i>
      </div>
      <Eyebrow className="relative mt-3.5">{card.label}</Eyebrow>
      <p className="relative mt-1 text-[22px] leading-7 font-extrabold tracking-tight tabular-nums truncate" style={{ color: NAVY }} title={card.money ? formatUgx(value) : undefined}>
        {card.money ? compactUgx(value) : formatNumber(value)}
      </p>
      <p className="relative mt-1.5 text-xs font-medium flex items-center justify-between gap-2" style={{ color: MUTED }}>
        <span className="truncate">{sub}</span>
        <i className="ph ph-arrow-right text-sm flex-shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </p>
    </button>
  );
};

// ---------------------------------------------------------------------------------------------
// Sales by company: hand-built horizontal bars. Revenue is split into the company's share (navy)
// and Gabla's fee (gold) so ops can see at a glance who drives commission.
const niceMax = (v) => {
  if (!v || v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : 10;
  return nice * exp;
};

const METRICS = [
  { id: 'revenue', label: 'Sales' },
  { id: 'bookings', label: 'Bookings' }
];

const SalesChart = ({ operators, onOpenCompany }) => {
  const [metric, setMetric] = useState('revenue');
  const rows = useMemo(
    () =>
      (operators || [])
        .map((op) => {
          const revenue = Number(op.stats?.revenue || 0);
          const fee = Number(op.stats?.commission || 0);
          return { op, revenue, fee, bookings: Number(op.stats?.bookings || 0) };
        })
        .filter((r) => r.revenue > 0 || r.bookings > 0)
        .sort((a, b) => (metric === 'revenue' ? b.revenue - a.revenue : b.bookings - a.bookings))
        .slice(0, 10),
    [operators, metric]
  );

  const peak = rows.reduce((m, r) => Math.max(m, metric === 'revenue' ? r.revenue : r.bookings), 0);
  const max = niceMax(peak);
  const ticks = [0, 0.5, 1];
  const total = rows.reduce((s, r) => s + (metric === 'revenue' ? r.revenue : r.bookings), 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Sales by company"
        subtitle={metric === 'revenue' ? 'Confirmed bookings, all time, UGX' : 'Confirmed bookings, all time'}
        action={
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#F1F5F9' }}>
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${metric === m.id ? 'bg-white shadow-sm' : ''}`}
                style={{ color: metric === m.id ? NAVY : MUTED }}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />
      {!rows.length ? (
        <div className="px-5 pb-6"><EmptyState icon="ph-chart-bar" title="No sales yet">Sales by company appear here once passengers start booking.</EmptyState></div>
      ) : (
        <div className="px-5 pb-5">
          <div className="hidden sm:grid grid-cols-[170px_1fr_84px] gap-x-3 mb-1.5">
            <span></span>
            <div className="relative h-4">
              {ticks.map((t) => (
                <span key={t} className="absolute text-[10px] font-semibold tabular-nums -translate-x-1/2" style={{ left: `${t * 100}%`, color: FAINT, ...(t === 0 ? { transform: 'none' } : {}), ...(t === 1 ? { transform: 'translateX(-100%)' } : {}) }}>
                  {t === 0 ? '0' : compactNumber(max * t)}
                </span>
              ))}
            </div>
            <span></span>
          </div>
          <ul className="space-y-1.5 sm:space-y-1">
            {rows.map(({ op, revenue, fee, bookings }) => {
              const value = metric === 'revenue' ? revenue : bookings;
              const pct = (value / max) * 100;
              const feePct = metric === 'revenue' && revenue > 0 ? Math.max(2, (fee / revenue) * 100) : 0;
              return (
                <li key={op.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[170px_1fr_84px] items-center gap-x-3 gap-y-1.5">
                  <button type="button" onClick={() => onOpenCompany?.(op.id)} className="flex items-center gap-2.5 min-w-0 text-left rounded-lg hover:bg-slate-50 -mx-1 px-1 py-0.5">
                    <CompanyAvatar name={op.companyName} url={op.logoUrl} size={28} radius={8} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: INK }}>{op.companyName}</span>
                      <span className="block text-[11px] tabular-nums truncate" style={{ color: FAINT }}>
                        {metric === 'revenue' ? `${formatNumber(bookings)} bookings` : compactUgx(revenue)}
                      </span>
                    </span>
                  </button>
                  <span className="sm:col-start-3 sm:row-start-1 text-right text-[13px] font-bold tabular-nums" style={{ color: NAVY }}>
                    {metric === 'revenue' ? compactUgx(value) : formatNumber(value)}
                  </span>
                  <div
                    className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 row-start-2 h-6 sm:h-7 rounded-md relative"
                    style={{ backgroundImage: 'linear-gradient(to right, #E8EDF4 1px, transparent 1px)', backgroundSize: '25% 100%', backgroundColor: '#FAFBFD' }}
                    title={`${op.companyName}: ${formatUgx(revenue)} sales, ${formatUgx(fee)} Gabla fee, ${formatNumber(bookings)} bookings`}
                  >
                    <div className="bus-bar absolute inset-y-1 left-0 rounded-[5px] overflow-hidden flex" style={{ width: `${Math.max(pct, 1.2)}%` }}>
                      <div className="h-full flex-1" style={{ backgroundColor: NAVY }}></div>
                      {feePct ? <div className="h-full flex-shrink-0" style={{ width: `${feePct}%`, minWidth: 3, backgroundColor: GOLD }}></div> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3 flex-wrap text-xs" style={{ borderColor: '#F1F5F9', color: MUTED }}>
            <div className="flex items-center gap-4">
              {metric === 'revenue' ? (
                <>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: NAVY }}></span>Company share</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GOLD }}></span>Gabla fee</span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: NAVY }}></span>Confirmed bookings</span>
              )}
            </div>
            <span className="tabular-nums">Top {rows.length}: <strong style={{ color: INK }}>{metric === 'revenue' ? compactUgx(total) : formatNumber(total)}</strong></span>
          </div>
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------------------------
// Needs attention: the four things an ops person should chase, each deep-linking to the fix.
const AttentionRow = ({ icon, tint, ink, title, sub, right, onClick, children }) => (
  <div className="rounded-xl border" style={{ borderColor: LINE }}>
    <button type="button" onClick={onClick} className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tint, color: ink }}>
        <i className={`ph ${icon} text-xl`}></i>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold" style={{ color: INK }}>{title}</span>
        <span className="block text-xs truncate" style={{ color: MUTED }}>{sub}</span>
      </span>
      <span className="text-right flex-shrink-0">{right}</span>
      <i className="ph ph-caret-right flex-shrink-0" style={{ color: FAINT }}></i>
    </button>
    {children ? <div className="px-3 pb-3 -mt-1 space-y-1.5">{children}</div> : null}
  </div>
);

const MiniLine = ({ left, right, onClick }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 text-xs pl-[52px] pr-1 py-1 rounded-md hover:bg-slate-50 text-left">
    <span className="truncate" style={{ color: MUTED }}>{left}</span>
    <span className="font-semibold tabular-nums flex-shrink-0" style={{ color: INK }}>{right}</span>
  </button>
);

const NeedsAttention = ({ overview, operators, refunds, payouts, goTo, onOpenCompany }) => {
  const refundCount = Number(overview?.refundsDue ?? refunds?.total ?? 0);
  const refundItems = refunds?.items || [];
  const refundSum = refundItems.reduce((s, b) => s + Number(b.total || 0), 0);
  const payoutItems = (payouts?.items || []).filter((p) => p.status === 'requested');
  const payoutCount = Number(overview?.payoutsPending ?? payoutItems.length);
  const payoutSum = payoutItems.reduce((s, p) => s + Number(p.amount || 0), 0);
  const invited = (operators || []).filter((op) => companyState(op).key === 'invited');
  const suspended = (operators || []).filter((op) => companyState(op).key === 'suspended');
  const issues = (refundCount > 0 ? 1 : 0) + (payoutCount > 0 ? 1 : 0) + (invited.length ? 1 : 0) + (suspended.length ? 1 : 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Needs attention"
        subtitle="Money to move and companies to chase"
        action={
          <Chip tone={issues ? 'rose' : 'emerald'}>{issues ? `${issues} open` : 'All clear'}</Chip>
        }
      />
      <div className="px-5 pb-5 space-y-2.5">
        {issues === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}><i className="ph ph-seal-check text-2xl"></i></div>
            <p className="font-bold" style={{ color: INK }}>Nothing needs you right now</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>No refunds, payouts, invitations or suspensions waiting.</p>
          </div>
        ) : null}

        {refundCount > 0 ? (
          <AttentionRow
            icon="ph-arrow-u-up-left" tint="#FFE4E6" ink="#BE123C"
            title={`${formatNumber(refundCount)} refund${refundCount === 1 ? '' : 's'} due`}
            sub="Cancelled trips - pay passengers back"
            right={<span className="text-sm font-extrabold tabular-nums" style={{ color: '#BE123C' }}>{refundItems.length >= refundCount ? compactUgx(refundSum) : ''}</span>}
            onClick={() => goTo('bookings', 'refund_due')}
          >
            {refundItems.slice(0, 3).map((b) => (
              <MiniLine key={b.id} onClick={() => goTo('bookings', 'refund_due')} left={`${b.passengerName} - ${b.route}`} right={compactUgx(b.total)} />
            ))}
          </AttentionRow>
        ) : null}

        {payoutCount > 0 ? (
          <AttentionRow
            icon="ph-hand-coins" tint="#FFEDD5" ink="#C2410C"
            title={`${formatNumber(payoutCount)} payout${payoutCount === 1 ? '' : 's'} pending`}
            sub="Companies waiting for mobile money"
            right={<span className="text-sm font-extrabold tabular-nums" style={{ color: '#C2410C' }}>{payoutItems.length >= payoutCount ? compactUgx(payoutSum) : ''}</span>}
            onClick={() => goTo('payouts', 'requested')}
          >
            {payoutItems.slice(0, 3).map((p) => (
              <MiniLine key={p.id} onClick={() => goTo('payouts', 'requested')} left={p.operator?.companyName || 'Company'} right={compactUgx(p.amount)} />
            ))}
          </AttentionRow>
        ) : null}

        {invited.length ? (
          <AttentionRow
            icon="ph-paper-plane-tilt" tint="#FEF3C7" ink="#92400E"
            title={`${invited.length} invited, not registered`}
            sub="Waiting on the emailed link - consider resending"
            right={<Chip tone="amber" dot={false}>{invited.length}</Chip>}
            onClick={() => goTo('companies')}
          >
            {invited.slice(0, 3).map((op) => (
              <MiniLine key={op.id} onClick={() => onOpenCompany(op.id)} left={op.companyName} right="Invited" />
            ))}
          </AttentionRow>
        ) : null}

        {suspended.length ? (
          <AttentionRow
            icon="ph-prohibit" tint="#E2E8F0" ink="#475569"
            title={`${suspended.length} suspended`}
            sub="Hidden from passenger search"
            right={<Chip tone="slate" dot={false}>{suspended.length}</Chip>}
            onClick={() => goTo('companies')}
          >
            {suspended.slice(0, 3).map((op) => (
              <MiniLine key={op.id} onClick={() => onOpenCompany(op.id)} left={op.companyName} right="Suspended" />
            ))}
          </AttentionRow>
        ) : null}
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------------------------------------
// Company health: status, rating, upcoming trips and wallet at a glance.
const CompanyHealth = ({ operators, goTo, onOpenCompany }) => {
  const rows = useMemo(
    () => [...(operators || [])].sort((a, b) => Number(b.stats?.revenue || 0) - Number(a.stats?.revenue || 0)),
    [operators]
  );
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Company health"
        subtitle="Status, rating, upcoming trips and wallet"
        action={<button type="button" onClick={() => goTo('companies')} className="text-xs font-semibold inline-flex items-center gap-1 hover:underline flex-shrink-0" style={{ color: NAVY }}>All companies <i className="ph ph-arrow-right"></i></button>}
      />
      {!rows.length ? (
        <div className="px-5 pb-6"><EmptyState icon="ph-buildings" title="No companies yet">Invite your first bus company to see its health here.</EmptyState></div>
      ) : (
        <div className="pb-2">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_64px_110px_96px] gap-x-3 px-5 pb-2">
            <Eyebrow>Company</Eyebrow>
            <Eyebrow className="text-right">Trips</Eyebrow>
            <Eyebrow className="text-right">Wallet</Eyebrow>
            <Eyebrow className="text-right">Status</Eyebrow>
          </div>
          <ul>
            {rows.map((op) => {
              const state = companyState(op);
              const trips = Number(op.stats?.upcomingTrips || 0);
              const lowTrips = state.key === 'registered' && trips === 0;
              return (
                <li key={op.id} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                  <button type="button" onClick={() => onOpenCompany(op.id)} className="w-full text-left px-5 py-3 hover:bg-slate-50/80 transition grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_64px_110px_96px] gap-x-3 gap-y-2 items-center">
                    <span className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0">
                      <CompanyAvatar name={op.companyName} url={op.logoUrl} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold truncate" style={{ color: INK }}>{op.companyName}</span>
                        <span className="flex items-center gap-2 mt-0.5 min-w-0">
                          <Rating avg={op.ratingAvg} count={op.ratingCount} size={12} />
                        </span>
                      </span>
                      <span className="sm:hidden flex-shrink-0"><Chip tone={state.tone}>{state.label}</Chip></span>
                    </span>
                    <span className="sm:text-right">
                      <Eyebrow className="sm:hidden">Upcoming trips</Eyebrow>
                      <span className={`text-sm font-bold tabular-nums inline-flex items-center gap-1 ${lowTrips ? '' : ''}`} style={{ color: lowTrips ? '#C2410C' : INK }}>
                        {lowTrips ? <i className="ph ph-warning" title="No upcoming trips scheduled"></i> : null}
                        {formatNumber(trips)}
                      </span>
                    </span>
                    <span className="sm:text-right">
                      <Eyebrow className="sm:hidden">Wallet</Eyebrow>
                      <span className="text-sm font-bold tabular-nums" style={{ color: INK }} title={formatUgx(op.walletBalance)}>{compactUgx(op.walletBalance)}</span>
                    </span>
                    <span className="hidden sm:block text-right"><Chip tone={state.tone}>{state.label}</Chip></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------------------------
// Recent orders feed.
const RecentOrders = ({ bookings, operators, goTo }) => {
  const byName = useMemo(() => new Map((operators || []).map((op) => [op.companyName, op])), [operators]);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recent orders"
        subtitle="Latest bookings across all companies"
        action={<button type="button" onClick={() => goTo('bookings', '')} className="text-xs font-semibold inline-flex items-center gap-1 hover:underline flex-shrink-0" style={{ color: NAVY }}>All bookings <i className="ph ph-arrow-right"></i></button>}
      />
      {!bookings?.length ? (
        <div className="px-5 pb-6"><EmptyState icon="ph-ticket" title="No orders yet">New bookings show up here as they happen.</EmptyState></div>
      ) : (
        <ul className="pb-2">
          {bookings.map((b) => {
            const op = byName.get(b.company);
            return (
              <li key={b.id} className="border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: '#F1F5F9' }}>
                <CompanyAvatar name={b.company} url={op?.logoUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: INK }}>{b.route}</p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>
                    {b.passengerName} - {b.seatCount} seat{b.seatCount === 1 ? '' : 's'}
                  </p>
                  <p className="text-[11px] tabular-nums truncate" style={{ color: FAINT }}>Booked {formatEatShort(b.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-sm font-extrabold tabular-nums" style={{ color: NAVY }}>{compactUgx(b.total)}</p>
                  <BookingChip status={b.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

const PanelSkeleton = ({ rows = 5, title }) => (
  <Card className="p-5" role="status" aria-label={`Loading ${title}`}>
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-3 w-52 mt-2" />
    <div className="mt-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 !rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  </Card>
);

// ---------------------------------------------------------------------------------------------
export const OverviewTab = ({ token, overview, loading, error, onRetry, goTo, onOpenCompany, refreshKey = 0 }) => {
  const [data, setData] = useState({ operators: null, recent: null, refunds: null, payouts: null });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    const calls = [
      ['operators', () => listOperators(token, { limit: 100 })],
      ['recent orders', () => listBookings(token, { limit: 8 })],
      ['refunds', () => listBookings(token, { status: 'refund_due', limit: 50 })],
      ['payouts', () => listPayouts(token, { status: 'requested' })]
    ];
    const results = await Promise.allSettled(calls.map(([, fn]) => fn()));
    const val = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);
    setData((prev) => ({
      operators: val(0)?.items ?? prev.operators,
      recent: val(1)?.items ?? prev.recent,
      refunds: val(2) ?? prev.refunds,
      payouts: val(3) ?? prev.payouts
    }));
    setDataErrors(results.map((r, i) => (r.status === 'rejected' ? `${calls[i][0]}: ${r.reason?.message || 'failed to load'}` : null)).filter(Boolean));
    setFetchedAt(new Date());
    setDataLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (error && !overview) return <ErrorState message={error} onRetry={onRetry} />;

  const operators = data.operators;
  const firstLoad = dataLoading && !operators;
  const gross = Number(overview?.grossSales || 0);
  const commission = Number(overview?.commissionEarned || 0);
  const refundTotal = (data.refunds?.items || []).reduce((s, b) => s + Number(b.total || 0), 0);
  const payoutTotal = (data.payouts?.items || []).filter((p) => p.status === 'requested').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalCompanies = data.operators ? operators.length : null;

  const kpiSub = {
    grossSales: 'All time, confirmed',
    commissionEarned: gross ? `${((commission / gross) * 100).toFixed(1)}% of gross` : 'Gabla fee',
    tickets: `${formatNumber(overview?.bookings)} bookings`,
    operators: totalCompanies !== null ? `of ${totalCompanies} invited` : 'Finished registration',
    refundsDue: Number(overview?.refundsDue) > 0 ? (refundTotal ? `${compactUgx(refundTotal)} owed` : 'To pay back') : 'All refunded',
    payoutsPending: Number(overview?.payoutsPending) > 0 ? (payoutTotal ? `${compactUgx(payoutTotal)} asked` : 'Awaiting you') : 'None waiting'
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs flex items-center gap-1.5" style={{ color: FAINT }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dataLoading || loading ? '#F59E0B' : '#10B981' }}></span>
          {dataLoading || loading ? 'Updating...' : fetchedAt ? `Live - updated ${formatEatTime(fetchedAt.toISOString())} EAT` : 'Live'}
        </p>
      </div>

      <ErrorBanner message={error} onRetry={onRetry} />
      <ErrorBanner message={dataErrors.length ? `Some panels could not load (${dataErrors.join('; ')}).` : ''} onRetry={load} />

      {loading && !overview ? (
        <KpiSkeletons />
      ) : overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 md:gap-4">
          {KPIS.map((card) => (
            <Kpi key={card.key} card={card} value={overview[card.key]} sub={kpiSub[card.key]} goTo={goTo} needsAction={Boolean(card.alert) && Number(overview[card.key]) > 0} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6 items-start">
        <div className="xl:col-span-3 min-w-0">
          {firstLoad ? <PanelSkeleton rows={7} title="sales" /> : <SalesChart operators={operators} onOpenCompany={onOpenCompany} />}
        </div>
        <div className="xl:col-span-2 min-w-0">
          {firstLoad && !data.refunds ? (
            <PanelSkeleton rows={3} title="alerts" />
          ) : (
            <NeedsAttention overview={overview} operators={operators} refunds={data.refunds} payouts={data.payouts} goTo={goTo} onOpenCompany={onOpenCompany} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6 items-start">
        <div className="xl:col-span-3 min-w-0">
          {firstLoad ? <PanelSkeleton rows={6} title="company health" /> : <CompanyHealth operators={operators} goTo={goTo} onOpenCompany={onOpenCompany} />}
        </div>
        <div className="xl:col-span-2 min-w-0">
          {dataLoading && !data.recent ? <PanelSkeleton rows={5} title="recent orders" /> : <RecentOrders bookings={data.recent} operators={operators} goTo={goTo} />}
        </div>
      </div>
    </div>
  );
};
