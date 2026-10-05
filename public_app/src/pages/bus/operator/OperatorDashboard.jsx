import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { dayLabel, eatTime, operatorApi, todayEat, ugx } from "../../../lib/bus";
import { IconCalendar, IconChat, IconPin, IconQr } from "../../../components/icons";
import { CardsSkel, Empty, ErrorBox, ListSkel, PageHead, StatusChip, compactUgx, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { Skel } from "../../../components/Skeleton";

function Kpi({ label, value, sub, tone }) {
  return (
    <div className={`bus-card bop-kpi ${tone ? `is-${tone}` : ""}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

// 7-day sales as hand-built SVG bars.
const useNarrow = () => {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return narrow;
};

function TrendChart({ trend, metric }) {
  const narrow = useNarrow();
  const W = narrow ? 320 : 700, H = narrow ? 210 : 230, padL = 12, padR = 12, top = 26, bottom = 34;
  const vals = trend.map((d) => Number(metric === "revenue" ? d.revenue : d.tickets) || 0);
  const max = Math.max(...vals, 1);
  const step = (W - padL - padR) / trend.length;
  const bw = Math.min(56, step * 0.6);
  const chartH = H - top - bottom;
  const today = todayEat();
  return (
    <svg className="bop-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Last 7 days ${metric === "revenue" ? "sales in UGX" : "tickets sold"}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={padL} x2={W - padR} y1={top + chartH * (1 - f)} y2={top + chartH * (1 - f)} className="bop-chart-grid" />)}
      <line x1={padL} x2={W - padR} y1={top + chartH} y2={top + chartH} className="bop-chart-axis" />
      {trend.map((d, i) => {
        const v = vals[i];
        const h = Math.max(v ? 4 : 0, (v / max) * chartH);
        const x = padL + step * i + (step - bw) / 2;
        const y = top + chartH - h;
        const isToday = d.date === today;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={bw} height={h} rx="8" className={isToday ? "bop-bar is-today" : "bop-bar"}>
              <title>{`${dayLabel(d.date)}: ${ugx(d.revenue)} · ${d.tickets} ticket${d.tickets === 1 ? "" : "s"}`}</title>
            </rect>
            {v > 0 ? <text x={x + bw / 2} y={y - 7} textAnchor="middle" className="bop-chart-val">{metric === "revenue" ? compactUgx(v) : v}</text> : null}
            <text x={x + bw / 2} y={H - 12} textAnchor="middle" className={`bop-chart-lbl ${isToday ? "is-today" : ""}`}>{isToday ? "Today" : dayLabel(d.date).split(" ")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function OperatorDashboard() {
  const { operator } = useOperator();
  const stats = useLoad(() => operatorApi.get("/stats"), []);
  const today = todayEat();
  const trips = useLoad(() => operatorApi.get("/trips", { from: today, to: today }), [today]);
  const [metric, setMetric] = useState("revenue");
  const s = stats.data;

  return (
    <>
      <PageHead title={`Hello, ${operator.companyName}`} sub="Here’s how your buses are doing." />

      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />
      {s && Number(s.pendingRefunds) > 0 ? (
        <div className="bus-notice is-danger bop-mb">
          <strong>{s.pendingRefunds} booking{s.pendingRefunds === 1 ? " is" : "s are"} waiting for a refund.</strong> These are from cancelled trips. Gabla refunds the passengers; you don’t need to do anything.{" "}
          <Link to="/bus/operator/bookings" className="bus-link">See bookings</Link>
        </div>
      ) : null}

      {!s ? <CardsSkel count={4} /> : (
        <div className="bop-kpis">
          <Kpi label="Sales today" value={ugx(s.today.revenue)} sub={`${s.today.tickets} ticket${s.today.tickets === 1 ? "" : "s"} · ${s.today.bookings} booking${s.today.bookings === 1 ? "" : "s"}`} tone="orange" />
          <Kpi label="Sales this month" value={ugx(s.month.revenue)} sub={`${s.month.tickets} tickets sold`} />
          <Kpi label="Available balance" value={ugx(s.walletBalance)} sub={Number(s.pendingPayouts) > 0 ? `${ugx(s.pendingPayouts)} payout pending` : `After ${Number(s.commissionPercent)}% Gabla fee`} tone="navy" />
          <Kpi label="Upcoming trips" value={s.upcomingTrips} sub={`${s.today.trips} leaving today`} />
        </div>
      )}

      <div className="bop-dash-grid">
        <section className="bus-card bop-panel">
          <header className="bop-panel-head">
            <div><h2>Last 7 days</h2><p>{s ? `${ugx(s.allTime.revenue)} all time · ${s.allTime.tickets} tickets` : " "}</p></div>
            <div className="bop-seg" role="tablist">
              <button type="button" className={metric === "revenue" ? "is-on" : ""} onClick={() => setMetric("revenue")}>Sales</button>
              <button type="button" className={metric === "tickets" ? "is-on" : ""} onClick={() => setMetric("tickets")}>Tickets</button>
            </div>
          </header>
          {s ? <TrendChart trend={s.trend} metric={metric} /> : <Skel h={230} r={14} />}
        </section>

        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>Top routes</h2><p>By tickets sold</p></div></header>
          {!s ? <div style={{ display: "grid", gap: 12 }}>{[0, 1, 2].map((i) => <Skel key={i} h={34} r={10} />)}</div> : s.topRoutes.length ? (
            <ol className="bop-top">
              {s.topRoutes.map((r) => (
                <li key={r.name}>
                  <div><strong>{r.name}</strong><span>{r.tickets} tickets</span></div>
                  <i style={{ width: `${Math.max(6, (r.tickets / s.topRoutes[0].tickets) * 100)}%` }} />
                </li>
              ))}
            </ol>
          ) : <p className="bus-hint">Sales will show up here after your first bookings.</p>}
        </section>
      </div>

      <div className="bop-dash-grid is-2">
        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>Today’s departures</h2><p>{dayLabel(today)}</p></div><Link to="/bus/operator/trips" className="bus-link">All trips</Link></header>
          {trips.loading ? <ListSkel rows={3} h={56} /> : trips.error ? <ErrorBox error={trips.error} onRetry={trips.refresh} /> : trips.data.items.length ? (
            <ul className="bop-list">
              {trips.data.items.map((t) => (
                <li key={t.id}>
                  <Link to={`/bus/operator/trips/${t.id}`} className="bop-list-row">
                    <span className="bop-time-badge">{eatTime(t.departureAt)}</span>
                    <span className="bop-list-main"><strong>{t.route.name}</strong><small>{t.seatsTaken}/{t.seats} seats · {t.ticketsSold} ticket{t.ticketsSold === 1 ? "" : "s"}</small></span>
                    <span>{t.delayMinutes ? <span className="bus-chip bus-chip-amber">+{t.delayMinutes}m</span> : null} <StatusChip status={t.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="No departures today">Your sessions create trips automatically. Add one under Sessions.</Empty>}
        </section>

        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>Quick actions</h2></div></header>
          <div className="bop-actions">
            <Link to="/bus/operator/tickets" className="bop-action"><IconQr width={22} height={22} /><strong>Verify a ticket</strong><small>Check a passenger in</small></Link>
            <Link to="/bus/operator/trips?new=1" className="bop-action"><IconCalendar width={22} height={22} /><strong>Add an extra trip</strong><small>A special departure</small></Link>
            <Link to="/bus/operator/routes?new=1" className="bop-action"><IconPin width={22} height={22} /><strong>Add a route</strong><small>New destination</small></Link>
            <Link to="/bus/operator/announcements" className="bop-action"><IconChat width={22} height={22} /><strong>Message customers</strong><small>Notices and offers</small></Link>
          </div>
        </section>
      </div>
    </>
  );
}
