import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { addDays, eatTime, operatorApi, todayEat, ugx } from "../../../lib/bus";
import { Skel } from "../../../components/Skeleton";
import { Avatar, Empty, ErrorBox, Meter, PageHead, Panel, Segmented, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcArrowDown, IcArrowRight, IcArrowUp, IcBus, IcCalendarDay, IcCheck, IcChevronRight, IcMegaphone, IcPlus, IcRoute, IcScan, IcTicket, IcTrips, IcWallet } from "../../../components/bus/operator/icons";
import { SalesChart, Sparkline } from "../../../components/bus/operator/charts";
import { greeting, occupancy, pctChange, timeAgo, tripStatus, ugxShort, useNow } from "../../../components/bus/operator/util";

function Delta({ value, suffix = "vs yesterday" }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="bop-delta-wrap"><span className="bop-delta is-flat">No change</span><em>{suffix}</em></span>;
  const up = value >= 0;
  return (
    <span className="bop-delta-wrap">
      <span className={`bop-delta ${up ? "is-up" : "is-down"}`}>
        {up ? <IcArrowUp size={13} strokeWidth={2.6} /> : <IcArrowDown size={13} strokeWidth={2.6} />}
        {Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1).replace(/\.0$/, "")}%
      </span>
      <em>{suffix}</em>
    </span>
  );
}

function Kpi({ icon, label, prefix, value, delta, suffix, sub, spark, tone = "navy", sparkLabel }) {
  return (
    <div className={`bop-card bop-kpi is-${tone}`}>
      <div className="bop-kpi-top">
        <span className="bop-kpi-icon">{icon}</span>
        <span className="bop-kpi-label">{label}</span>
      </div>
      <div className="bop-kpi-value">{prefix ? <small>{prefix}</small> : null}<strong>{value}</strong></div>
      <div className="bop-kpi-foot">
        {delta !== undefined ? <Delta value={delta} suffix={suffix} /> : <span className="bop-kpi-sub">{sub}</span>}
        {spark ? <span className="bop-kpi-spark"><Sparkline values={spark} tone={tone} label={sparkLabel} /></span> : null}
      </div>
      {delta !== undefined && sub ? <span className="bop-kpi-sub bop-kpi-sub2">{sub}</span> : null}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bop-kpis" role="status" aria-busy="true" aria-label="Loading sales">
      {Array.from({ length: 4 }).map((_, i) => (
        <div className="bop-card bop-kpi" key={i}>
          <div className="bop-kpi-top"><Skel w={34} h={34} r={11} /><Skel w="46%" h={11} /></div>
          <Skel w="70%" h={30} r={10} style={{ marginTop: 18 }} />
          <div className="bop-kpi-foot"><Skel w="46%" h={12} /><Skel w={84} h={34} r={10} /></div>
        </div>
      ))}
    </div>
  );
}

// Airport-style board of today's departures.
function DeparturesBoard({ trips, now, tomorrow }) {
  const today = trips.data?.items || [];
  const upcoming = (tomorrow || []).filter((t) => t.status !== "cancelled").slice(0, 4);
  const showTomorrow = !trips.loading && !trips.error && today.length === 0 && upcoming.length > 0;
  const items = showTomorrow ? upcoming : today;
  const counts = useMemo(() => {
    const c = { left: 0, boarding: 0, delayed: 0 };
    items.forEach((t) => {
      const s = tripStatus(t, now).key;
      if (s === "scheduled") c.left += 1;
      if (s === "boarding") c.boarding += 1;
      if (s === "delayed") c.delayed += 1;
    });
    return c;
  }, [items, now]);

  return (
    <section className="bop-board" aria-label="Today’s departures">
      <header className="bop-board-head">
        <div>
          <h2><span className="bop-board-dot" aria-hidden="true" />{showTomorrow ? "Next departures" : "Today’s departures"}</h2>
          <p>{trips.loading ? "Updating…" : showTomorrow ? `Nothing left today. Tomorrow starts with ${eatTime(upcoming[0].departureAt)}.` : items.length ? `${items.length} trip${items.length === 1 ? "" : "s"} · ${counts.boarding} boarding · ${counts.left} upcoming${counts.delayed ? ` · ${counts.delayed} delayed` : ""}` : "Nothing scheduled today"}</p>
        </div>
        <Link to="/bus/operator/trips" className="bop-board-link">All trips <IcChevronRight size={16} /></Link>
      </header>
      {trips.loading && !trips.data ? (
        <div className="bop-board-body" role="status" aria-busy="true" aria-label="Loading departures">
          {[0, 1, 2].map((i) => <div className="bop-board-row is-skel" key={i}><Skel w={64} h={22} className="bop-skel-dark" /><Skel w="60%" h={14} className="bop-skel-dark" /><Skel w="80%" h={8} className="bop-skel-dark" /><Skel w={84} h={26} r={999} className="bop-skel-dark" /></div>)}
        </div>
      ) : trips.error ? (
        <div className="bop-board-empty"><IcAlert size={20} /><p>Couldn’t load today’s trips.</p><button type="button" className="bop-btn bop-btn-sm bop-btn-ghost-light" onClick={trips.refresh}>Try again</button></div>
      ) : items.length ? (
        <div className="bop-board-body" role="table" aria-label="Departures">
          <div className="bop-board-cols" role="row"><span role="columnheader">Time</span><span role="columnheader">Route</span><span role="columnheader">Seats</span><span role="columnheader">Status</span></div>
          {items.map((t) => {
            const st = tripStatus(t, now);
            const occ = occupancy(t);
            const [from, to] = [t.route.originName, t.route.destinationName];
            return (
              <Link key={t.id} to={`/bus/operator/trips/${t.id}`} className={`bop-board-row is-${st.key}`} role="row">
                <span className="bop-board-time" role="cell">{eatTime(t.departureAt).replace(" ", "")}{t.delayMinutes ? <small>+{t.delayMinutes}m</small> : showTomorrow ? <small>Tomorrow</small> : null}</span>
                <span className="bop-board-route" role="cell"><strong>{from && to ? <>{from}<IcArrowRight size={14} />{to}</> : t.route.name}</strong><small>{t.busType || "Bus"}{t.fromSchedule ? "" : " · Extra"}</small></span>
                <span className="bop-board-seats" role="cell"><Meter pct={occ.pct} level={occ.level} /><em><b>{occ.taken}</b>/{occ.seats}</em></span>
                <span className="bop-board-status" role="cell"><span className={`bop-pill is-${st.tone} ${st.pulse ? "is-pulse" : ""}`}>{st.label}</span></span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bop-board-empty"><IcBus size={26} /><strong>No departures today</strong><p>Sessions create trips automatically. Add a session or a one-off trip.</p><Link to="/bus/operator/trips?new=1" className="bop-btn bop-btn-sm bop-btn-ghost-light">Add an extra trip</Link></div>
      )}
    </section>
  );
}

function NeedsAttention({ stats, tomorrow, loading }) {
  const items = [];
  if (stats) {
    if (Number(stats.pendingRefunds) > 0) {
      items.push({ key: "refund", tone: "red", Icon: IcAlert, to: "/bus/operator/bookings?status=refund_due", title: `${stats.pendingRefunds} refund${Number(stats.pendingRefunds) === 1 ? "" : "s"} pending`, sub: "From cancelled trips. Gabla refunds passengers for you." });
    }
    const low = (tomorrow || []).filter((t) => t.status === "scheduled" && occupancy(t).pct < 25);
    if (low.length) {
      items.push({ key: "low", tone: "amber", Icon: IcCalendarDay, to: "/bus/operator/trips", title: `${low.length} trip${low.length === 1 ? "" : "s"} tomorrow under 25% full`, sub: `${low[0].route.name} at ${eatTime(low[0].departureAt)}${low.length > 1 ? ` and ${low.length - 1} more` : ""}. Consider a promotion.` });
    }
    if (Number(stats.pendingPayouts) > 0) {
      items.push({ key: "payout", tone: "blue", Icon: IcWallet, to: "/bus/operator/payouts", title: `${ugx(stats.pendingPayouts)} payout in progress`, sub: "Requested and waiting for Gabla to send." });
    }
  }
  return (
    <Panel title="Needs attention" sub={stats ? (items.length ? `${items.length} thing${items.length === 1 ? "" : "s"} to look at` : "You’re all caught up") : " "} className="bop-attn">
      {loading || !stats ? (
        <div className="bop-attn-list">{[0, 1, 2].map((i) => <div className="bop-attn-item" key={i}><Skel w={38} h={38} r={12} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="60%" h={13} /><Skel w="90%" h={10} /></div></div>)}</div>
      ) : items.length ? (
        <ul className="bop-attn-list">
          {items.map(({ key, tone, Icon, to, title, sub }) => (
            <li key={key}>
              <Link to={to} className="bop-attn-item">
                <span className={`bop-tile is-${tone}`}><Icon size={19} /></span>
                <span className="bop-attn-text"><strong>{title}</strong><small>{sub}</small></span>
                <IcChevronRight size={17} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bop-clear"><span className="bop-tile is-green"><IcCheck size={20} strokeWidth={2.4} /></span><strong>All clear</strong><p>No refunds, empty buses or payouts need your attention.</p></div>
      )}
    </Panel>
  );
}

function TopRoutes({ stats }) {
  const routes = stats?.topRoutes || [];
  const max = Math.max(...routes.map((r) => r.tickets), 1);
  const total = routes.reduce((a, r) => a + r.tickets, 0) || 1;
  return (
    <Panel title="Top routes" sub="By tickets sold, all time">
      {!stats ? (
        <div style={{ display: "grid", gap: 16 }}>{[0, 1, 2].map((i) => <div key={i}><Skel w="50%" h={13} /><Skel h={9} r={999} style={{ marginTop: 10 }} /></div>)}</div>
      ) : routes.length ? (
        <ol className="bop-hbars">
          {routes.map((r, i) => (
            <li key={r.name}>
              <div><span className="bop-rank">{i + 1}</span><strong>{r.name}</strong><em>{r.tickets.toLocaleString("en-US")} <small>{Math.round((r.tickets / total) * 100)}%</small></em></div>
              <span className="bop-hbar"><i className={i === 0 ? "is-top" : ""} style={{ width: `${Math.max(5, (r.tickets / max) * 100)}%` }} /></span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bop-hint">Sales will show up here after your first bookings.</p>
      )}
    </Panel>
  );
}

function RecentOrders({ orders, now }) {
  const rows = useMemo(() => {
    const all = orders.data?.items || [];
    const live = all.filter((b) => new Date(b.createdAt).getTime() <= now + 5 * 60000);
    return (live.length ? live : all).slice(0, 6);
  }, [orders.data, now]);
  return (
    <Panel title="Recent orders" sub="Latest bookings from passengers" action={<Link to="/bus/operator/bookings" className="bop-textlink">View all <IcChevronRight size={15} /></Link>}>
      {orders.loading && !orders.data ? (
        <div className="bop-feed">{[0, 1, 2, 3].map((i) => <div className="bop-feed-row" key={i}><Skel w={40} h={40} r={999} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="40%" h={13} /><Skel w="65%" h={10} /></div><Skel w={80} h={14} /></div>)}</div>
      ) : orders.error ? (
        <ErrorBox error={orders.error} onRetry={orders.refresh} />
      ) : rows.length ? (
        <ul className="bop-feed">
          {rows.map((b) => (
            <li key={b.id || b.reference}>
              <Link to={`/bus/operator/bookings?q=${encodeURIComponent(b.reference)}`} className="bop-feed-row">
                <Avatar name={b.passengerName} size={40} />
                <span className="bop-feed-main"><strong>{b.passengerName}</strong><small>{b.route?.name} · {b.seatCount} seat{b.seatCount === 1 ? "" : "s"}</small></span>
                <span className="bop-feed-end"><strong>{ugx(b.total)}</strong><small>{timeAgo(b.createdAt, now)}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty compact icon={<IcTicket size={24} />} title="No orders yet">Passenger bookings show up here as they happen.</Empty>
      )}
    </Panel>
  );
}

function QuickActions() {
  const actions = [
    { to: "/bus/operator/tickets", Icon: IcScan, title: "Verify a ticket", sub: "Check a passenger in", tone: "orange" },
    { to: "/bus/operator/trips?new=1", Icon: IcTrips, title: "Add an extra trip", sub: "A special departure", tone: "blue" },
    { to: "/bus/operator/routes?new=1", Icon: IcRoute, title: "Add a route", sub: "New destination", tone: "green" },
    { to: "/bus/operator/announcements", Icon: IcMegaphone, title: "Message customers", sub: "Notices and offers", tone: "amber" }
  ];
  return (
    <Panel title="Quick actions">
      <div className="bop-actions">
        {actions.map(({ to, Icon, title, sub, tone }) => (
          <Link key={to} to={to} className="bop-action"><span className={`bop-tile is-${tone}`}><Icon size={20} /></span><strong>{title}</strong><small>{sub}</small></Link>
        ))}
      </div>
    </Panel>
  );
}

export default function OperatorDashboard() {
  const { operator } = useOperator();
  const today = todayEat();
  const tomorrow = addDays(today, 1);
  const now = useNow(30000);
  const stats = useLoad(() => operatorApi.get("/stats"), []);
  const trips = useLoad(() => operatorApi.get("/trips", { from: today, to: today }), [today]);
  const nextDay = useLoad(() => operatorApi.get("/trips", { from: tomorrow, to: tomorrow }), [tomorrow]);
  const orders = useLoad(() => operatorApi.get("/bookings", { limit: 40 }), []);
  const [metric, setMetric] = useState("revenue");
  const s = stats.data;

  const trend = s?.trend || [];
  const rev = trend.map((d) => d.revenue);
  const tix = trend.map((d) => d.tickets);
  const running = (arr, k = 1) => arr.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v * k), acc), []);
  const fee = s ? 1 - Number(s.commissionPercent || 0) / 100 : 1;
  const yRev = trend.length > 1 ? trend[trend.length - 2].revenue : 0;
  const yTix = trend.length > 1 ? trend[trend.length - 2].tickets : 0;
  const weekTotal = rev.reduce((a, b) => a + b, 0);
  const weekTickets = tix.reduce((a, b) => a + b, 0);
  const first = (operator.companyName || "").split(" ")[0];

  return (
    <>
      <PageHead
        lead={`${greeting(now)}, ${first}`}
        sub="Here’s how your buses are doing today."
        actions={<><Link to="/bus/operator/trips?new=1" className="bop-btn bop-btn-light"><IcPlus size={18} /> Extra trip</Link><Link to="/bus/operator/announcements" className="bop-btn bop-btn-light bop-hide-sm"><IcMegaphone size={18} /> Message customers</Link></>}
      />

      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />

      {!s ? <KpiSkeleton /> : (
        <div className="bop-kpis">
          <Kpi tone="orange" icon={<IcTicket size={19} />} label="Today’s sales" prefix="UGX" value={Number(s.today.revenue).toLocaleString("en-US")} delta={pctChange(s.today.revenue, yRev)} spark={rev} sparkLabel="Sales, last 7 days" />
          <Kpi tone="blue" icon={<IcScan size={19} />} label="Tickets sold today" value={s.today.tickets.toLocaleString("en-US")} delta={pctChange(s.today.tickets, yTix)} spark={tix} sparkLabel="Tickets, last 7 days" sub={`${s.today.bookings} order${s.today.bookings === 1 ? "" : "s"}`} />
          <Kpi tone="navy" icon={<IcCalendarDay size={19} />} label="This month" prefix="UGX" value={ugxShort(s.month.revenue)} sub={`${s.month.tickets.toLocaleString("en-US")} tickets · ${s.month.bookings} orders`} spark={running(rev)} sparkLabel="Running total, last 7 days" />
          <Kpi tone="dark" icon={<IcWallet size={19} />} label="Wallet balance" prefix="UGX" value={Number(s.walletBalance).toLocaleString("en-US")} sub={Number(s.pendingPayouts) > 0 ? `${ugxShort(s.pendingPayouts)} payout pending` : `After ${Number(s.commissionPercent)}% Gabla fee`} spark={running(rev, fee)} sparkLabel="Net sales added, last 7 days" />
        </div>
      )}

      <div className="bop-grid bop-grid-main">
        <Panel
          className="bop-hero-chart"
          title="Sales — last 7 days"
          sub={s ? (metric === "revenue" ? `${ugx(weekTotal)} this week · ${ugx(s.allTime.revenue)} all time` : `${weekTickets.toLocaleString("en-US")} tickets this week · ${s.allTime.tickets.toLocaleString("en-US")} all time`) : " "}
          action={<Segmented label="Chart metric" value={metric} onChange={setMetric} options={[["revenue", "Sales"], ["tickets", "Tickets"]]} />}
        >
          {s ? <SalesChart trend={trend} metric={metric} /> : <Skel h={280} r={14} />}
        </Panel>
        <NeedsAttention stats={s} tomorrow={nextDay.data?.items} loading={stats.loading && !s} />
      </div>

      <div className="bop-grid bop-grid-main">
        <DeparturesBoard trips={trips} now={now} tomorrow={nextDay.data?.items} />
        <TopRoutes stats={s} />
      </div>

      <div className="bop-grid bop-grid-main">
        <RecentOrders orders={orders} now={now} />
        <QuickActions />
      </div>
    </>
  );
}
