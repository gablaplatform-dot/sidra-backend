import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { addDays, eatTime, operatorApi, todayEat, ugx } from "../../../lib/bus";
import { Skel } from "../../../components/Skeleton";
import { Avatar, Empty, ErrorBox, Meter, PageHead, Panel, Segmented, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcArrowDown, IcArrowRight, IcArrowUp, IcBus, IcCalendarDay, IcCheck, IcChevronRight, IcMegaphone, IcPlus, IcRoute, IcScan, IcTicket, IcTrips, IcWallet } from "../../../components/bus/operator/icons";
import { SalesChart, Sparkline } from "../../../components/bus/operator/charts";
import { greeting, occupancy, pctChange, timeAgo, tripStatus, ugxShort, useNow } from "../../../components/bus/operator/util";

function Delta({ value, suffix }) {
  const { t } = useTranslation();
  if (suffix === undefined) suffix = t("busOp.dash.vsYesterday");
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="bop-delta-wrap"><span className="bop-delta is-flat">{t("busOp.dash.noChange")}</span><em>{suffix}</em></span>;
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
  const { t } = useTranslation();
  return (
    <div className="bop-kpis" role="status" aria-busy="true" aria-label={t("busOp.dash.loadingSales")}>
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
  const { t } = useTranslation();
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
    <section className="bop-board" aria-label={t("busOp.dash.todaysDepartures")}>
      <header className="bop-board-head">
        <div>
          <h2><span className="bop-board-dot" aria-hidden="true" />{showTomorrow ? t("busOp.dash.nextDepartures") : t("busOp.dash.todaysDepartures")}</h2>
          <p>{trips.loading ? t("busOp.dash.updating") : showTomorrow ? t("busOp.dash.tomorrowStarts", { time: eatTime(upcoming[0].departureAt) }) : items.length ? `${t("busOp.dash.tripsCount", { count: items.length })} · ${t("busOp.dash.nBoarding", { n: counts.boarding })} · ${t("busOp.dash.nUpcoming", { n: counts.left })}${counts.delayed ? ` · ${t("busOp.dash.nDelayed", { n: counts.delayed })}` : ""}` : t("busOp.dash.nothingToday")}</p>
        </div>
        <Link to="/bus/operator/trips" className="bop-board-link">{t("busOp.dash.allTrips")} <IcChevronRight size={16} /></Link>
      </header>
      {trips.loading && !trips.data ? (
        <div className="bop-board-body" role="status" aria-busy="true" aria-label={t("busOp.dash.loadingDepartures")}>
          {[0, 1, 2].map((i) => <div className="bop-board-row is-skel" key={i}><Skel w={64} h={22} className="bop-skel-dark" /><Skel w="60%" h={14} className="bop-skel-dark" /><Skel w="80%" h={8} className="bop-skel-dark" /><Skel w={84} h={26} r={999} className="bop-skel-dark" /></div>)}
        </div>
      ) : trips.error ? (
        <div className="bop-board-empty"><IcAlert size={20} /><p>{t("busOp.dash.tripsLoadFailed")}</p><button type="button" className="bop-btn bop-btn-sm bop-btn-ghost-light" onClick={trips.refresh}>{t("busOp.ui.tryAgain")}</button></div>
      ) : items.length ? (
        <div className="bop-board-body" role="table" aria-label={t("busOp.dash.departures")}>
          <div className="bop-board-cols" role="row"><span role="columnheader">{t("busOp.dash.colTime")}</span><span role="columnheader">{t("busOp.dash.colRoute")}</span><span role="columnheader">{t("busOp.dash.colSeats")}</span><span role="columnheader">{t("busOp.dash.colStatus")}</span></div>
          {items.map((trip) => {
            const st = tripStatus(trip, now);
            const occ = occupancy(trip);
            const [from, to] = [trip.route.originName, trip.route.destinationName];
            return (
              <Link key={trip.id} to={`/bus/operator/trips/${trip.id}`} className={`bop-board-row is-${st.key}`} role="row">
                <span className="bop-board-time" role="cell">{eatTime(trip.departureAt).replace(" ", "")}{trip.delayMinutes ? <small>+{trip.delayMinutes}m</small> : showTomorrow ? <small>{t("busOp.cal.tomorrow")}</small> : null}</span>
                <span className="bop-board-route" role="cell"><strong>{from && to ? <>{from}<IcArrowRight size={14} />{to}</> : trip.route.name}</strong><small>{trip.busType || t("busOp.dash.bus")}{trip.fromSchedule ? "" : ` · ${t("busOp.dash.extra")}`}</small></span>
                <span className="bop-board-seats" role="cell"><Meter pct={occ.pct} level={occ.level} /><em><b>{occ.taken}</b>/{occ.seats}</em></span>
                <span className="bop-board-status" role="cell"><span className={`bop-pill is-${st.tone} ${st.pulse ? "is-pulse" : ""}`}>{st.label}</span></span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bop-board-empty"><IcBus size={26} /><strong>{t("busOp.dash.noDepartures")}</strong><p>{t("busOp.dash.noDeparturesHint")}</p><Link to="/bus/operator/trips?new=1" className="bop-btn bop-btn-sm bop-btn-ghost-light">{t("busOp.dash.addExtraTrip")}</Link></div>
      )}
    </section>
  );
}

function NeedsAttention({ stats, tomorrow, loading }) {
  const { t } = useTranslation();
  const items = [];
  if (stats) {
    if (Number(stats.pendingRefunds) > 0) {
      items.push({ key: "refund", tone: "red", Icon: IcAlert, to: "/bus/operator/bookings?status=refund_due", title: t("busOp.dash.refundsPending", { count: Number(stats.pendingRefunds) }), sub: t("busOp.dash.refundsSub") });
    }
    const low = (tomorrow || []).filter((x) => x.status === "scheduled" && occupancy(x).pct < 25);
    if (low.length) {
      items.push({ key: "low", tone: "amber", Icon: IcCalendarDay, to: "/bus/operator/trips", title: t("busOp.dash.lowTrips", { count: low.length }), sub: low.length > 1 ? t("busOp.dash.lowSubMore", { route: low[0].route.name, time: eatTime(low[0].departureAt), count: low.length - 1 }) : t("busOp.dash.lowSub", { route: low[0].route.name, time: eatTime(low[0].departureAt) }) });
    }
    if (Number(stats.pendingPayouts) > 0) {
      items.push({ key: "payout", tone: "blue", Icon: IcWallet, to: "/bus/operator/payouts", title: t("busOp.dash.payoutInProgress", { amount: ugx(stats.pendingPayouts) }), sub: t("busOp.dash.payoutSub") });
    }
  }
  return (
    <Panel title={t("busOp.dash.needsAttention")} sub={stats ? (items.length ? t("busOp.dash.thingsToLook", { count: items.length }) : t("busOp.dash.caughtUp")) : " "} className="bop-attn">
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
        <div className="bop-clear"><span className="bop-tile is-green"><IcCheck size={20} strokeWidth={2.4} /></span><strong>{t("busOp.dash.allClear")}</strong><p>{t("busOp.dash.allClearHint")}</p></div>
      )}
    </Panel>
  );
}

function TopRoutes({ stats }) {
  const { t } = useTranslation();
  const routes = stats?.topRoutes || [];
  const max = Math.max(...routes.map((r) => r.tickets), 1);
  const total = routes.reduce((a, r) => a + r.tickets, 0) || 1;
  return (
    <Panel title={t("busOp.dash.topRoutes")} sub={t("busOp.dash.topRoutesSub")}>
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
        <p className="bop-hint">{t("busOp.dash.topRoutesEmpty")}</p>
      )}
    </Panel>
  );
}

function RecentOrders({ orders, now }) {
  const { t } = useTranslation();
  const rows = useMemo(() => {
    const all = orders.data?.items || [];
    const live = all.filter((b) => new Date(b.createdAt).getTime() <= now + 5 * 60000);
    return (live.length ? live : all).slice(0, 6);
  }, [orders.data, now]);
  return (
    <Panel title={t("busOp.dash.recentOrders")} sub={t("busOp.dash.recentOrdersSub")} action={<Link to="/bus/operator/bookings" className="bop-textlink">{t("busOp.dash.viewAll")} <IcChevronRight size={15} /></Link>}>
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
                <span className="bop-feed-main"><strong>{b.passengerName}</strong><small>{b.route?.name} · {t("busOp.dash.seats", { count: Number(b.seatCount) || 0 })}</small></span>
                <span className="bop-feed-end"><strong>{ugx(b.total)}</strong><small>{timeAgo(b.createdAt, now)}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty compact icon={<IcTicket size={24} />} title={t("busOp.dash.noOrders")}>{t("busOp.dash.noOrdersHint")}</Empty>
      )}
    </Panel>
  );
}

function QuickActions() {
  const { t } = useTranslation();
  const actions = [
    { to: "/bus/operator/tickets", Icon: IcScan, title: t("busOp.dash.qaVerify"), sub: t("busOp.dash.qaVerifySub"), tone: "orange" },
    { to: "/bus/operator/trips?new=1", Icon: IcTrips, title: t("busOp.dash.addExtraTrip"), sub: t("busOp.dash.qaTripSub"), tone: "blue" },
    { to: "/bus/operator/routes?new=1", Icon: IcRoute, title: t("busOp.dash.qaRoute"), sub: t("busOp.dash.qaRouteSub"), tone: "green" },
    { to: "/bus/operator/announcements", Icon: IcMegaphone, title: t("busOp.dash.qaMessage"), sub: t("busOp.dash.qaMessageSub"), tone: "amber" }
  ];
  return (
    <Panel title={t("busOp.dash.quickActions")}>
      <div className="bop-actions">
        {actions.map(({ to, Icon, title, sub, tone }) => (
          <Link key={to} to={to} className="bop-action"><span className={`bop-tile is-${tone}`}><Icon size={20} /></span><strong>{title}</strong><small>{sub}</small></Link>
        ))}
      </div>
    </Panel>
  );
}

export default function OperatorDashboard() {
  const { t } = useTranslation();
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
        sub={t("busOp.dash.sub")}
        actions={<><Link to="/bus/operator/trips?new=1" className="bop-btn bop-btn-light"><IcPlus size={18} /> {t("busOp.dash.extraTrip")}</Link><Link to="/bus/operator/announcements" className="bop-btn bop-btn-light bop-hide-sm"><IcMegaphone size={18} /> {t("busOp.dash.qaMessage")}</Link></>}
      />

      <ErrorBox error={stats.error} onRetry={stats.refresh} className="bop-mb" />

      {!s ? <KpiSkeleton /> : (
        <div className="bop-kpis">
          <Kpi tone="orange" icon={<IcTicket size={19} />} label={t("busOp.dash.kpiSales")} prefix="UGX" value={Number(s.today.revenue).toLocaleString("en-US")} delta={pctChange(s.today.revenue, yRev)} spark={rev} sparkLabel={t("busOp.dash.sparkSales")} />
          <Kpi tone="blue" icon={<IcScan size={19} />} label={t("busOp.dash.kpiTickets")} value={s.today.tickets.toLocaleString("en-US")} delta={pctChange(s.today.tickets, yTix)} spark={tix} sparkLabel={t("busOp.dash.sparkTickets")} sub={t("busOp.dash.orders", { count: Number(s.today.bookings) || 0 })} />
          <Kpi tone="navy" icon={<IcCalendarDay size={19} />} label={t("busOp.dash.kpiMonth")} prefix="UGX" value={ugxShort(s.month.revenue)} sub={`${t("busOp.dash.ticketsN", { count: Number(s.month.tickets) || 0, n: s.month.tickets.toLocaleString("en-US") })} · ${t("busOp.dash.orders", { count: Number(s.month.bookings) || 0 })}`} spark={running(rev)} sparkLabel={t("busOp.dash.sparkRunning")} />
          <Kpi tone="dark" icon={<IcWallet size={19} />} label={t("busOp.dash.kpiWallet")} prefix="UGX" value={Number(s.walletBalance).toLocaleString("en-US")} sub={Number(s.pendingPayouts) > 0 ? t("busOp.dash.payoutPending", { amount: ugxShort(s.pendingPayouts) }) : t("busOp.dash.afterFee", { pct: Number(s.commissionPercent) })} spark={running(rev, fee)} sparkLabel={t("busOp.dash.sparkNet")} />
        </div>
      )}

      <div className="bop-grid bop-grid-main">
        <Panel
          className="bop-hero-chart"
          title={t("busOp.dash.salesTitle")}
          sub={s ? (metric === "revenue" ? t("busOp.dash.weekAllTimeSales", { week: ugx(weekTotal), all: ugx(s.allTime.revenue) }) : t("busOp.dash.weekAllTimeTickets", { week: weekTickets.toLocaleString("en-US"), all: s.allTime.tickets.toLocaleString("en-US") })) : " "}
          action={<Segmented label={t("busOp.dash.chartMetric")} value={metric} onChange={setMetric} options={[["revenue", t("busOp.dash.metricSales")], ["tickets", t("busOp.dash.metricTickets")]]} />}
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
