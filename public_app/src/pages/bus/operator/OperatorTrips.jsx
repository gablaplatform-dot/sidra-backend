import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { addDays, dateParts, eatDate, eatTime, longDayLabel, operatorApi, todayEat, ugx } from "../../../lib/bus";
import { Chip, Empty, ErrorBox, Field, Meter, Modal, PageHead, Segmented, Skel, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcArrowRight, IcBus, IcChevronLeft, IcChevronRight, IcPlus, IcTrips } from "../../../components/bus/operator/icons";
import { occupancy, tripStatus, ugxShort, useNow } from "../../../components/bus/operator/util";

const STATUS_FILTERS = [["all", "All"], ["scheduled", "Upcoming"], ["departed", "Departed"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function NewTripModal({ routes, loading, onClose, onDone }) {
  const { toast } = useOperator();
  const active = routes.filter((r) => r.isActive);
  const [routeId, setRouteId] = useState(active[0]?.id || "");
  const [date, setDate] = useState(todayEat());
  const [time, setTime] = useState("08:00");
  const [seats, setSeats] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeId && active[0]) setRouteId(active[0].id);
  }, [active, routeId]);

  const save = async () => {
    if (!routeId) return setError("Choose a route first.");
    if (!date || !time) return setError("Choose the date and time.");
    setBusy(true);
    setError("");
    try {
      await operatorApi.post("/trips", { routeId, date, time, ...(seats ? { seats: Number(seats) } : {}) });
      toast("Extra trip added");
      onDone(date);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add an extra trip" subtitle="A one-off departure that doesn’t repeat, like an extra bus on a busy day." onClose={busy ? () => {} : onClose}
      footer={<><button className="bop-btn bop-btn-light" onClick={onClose} disabled={busy}>Cancel</button><button className="bop-btn bop-btn-primary" onClick={save} disabled={busy || !active.length}>{busy ? "Adding…" : "Add trip"}</button></>}>
      {loading ? <div style={{ display: "grid", gap: 12 }}><Skel h={46} r={12} /><Skel h={46} r={12} /></div> : !active.length ? <div className="bop-alert is-warn"><span>You need an active route first. Add one under Routes &amp; prices.</span></div> : (
        <div className="bop-form">
          <Field label="Route"><select className="bop-select" value={routeId} onChange={(e) => setRouteId(e.target.value)}>{active.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <div className="bop-grid2">
            <Field label="Date (EAT)"><input className="bop-input" type="date" min={todayEat()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Departure time"><input className="bop-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Field label="Seats (optional)" hint="Leave empty to use the seats of the route’s bus type."><input className="bop-input bop-narrow" type="number" min="1" max="120" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} /></Field>
          {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
        </div>
      )}
    </Modal>
  );
}

export function TripCard({ trip: t, now, showDate = false }) {
  const st = tripStatus(t, now);
  const occ = occupancy(t);
  const [from, to] = [t.route.originName, t.route.destinationName];
  const [clock, mer] = eatTime(t.departureAt).split(" ");
  return (
    <Link to={`/bus/operator/trips/${t.id}`} className={`bop-card bop-trip is-${st.key}`}>
      <span className="bop-trip-stripe" aria-hidden="true" />
      <div className="bop-trip-time">
        <strong>{clock}<small>{mer}</small></strong>
        {t.delayMinutes ? <em>+{t.delayMinutes} min</em> : showDate ? <em>{eatDate(t.departureAt)}</em> : null}
      </div>
      <div className="bop-trip-main">
        <strong className="bop-trip-route">{from && to ? <>{from}<IcArrowRight size={15} />{to}</> : t.route.name}</strong>
        <span className="bop-trip-meta"><IcBus size={14} />{t.busType || "Bus"}{t.fromSchedule ? "" : <Chip tone="orange">Extra trip</Chip>}</span>
      </div>
      <div className="bop-trip-occ">
        <Meter pct={occ.pct} level={occ.level} />
        <span><b>{occ.taken}</b> / {occ.seats} seats · {occ.pct}%</span>
      </div>
      <div className="bop-trip-rev"><strong>{ugx(t.revenue)}</strong><small>{t.ticketsSold} ticket{t.ticketsSold === 1 ? "" : "s"}</small></div>
      <div className="bop-trip-end"><Chip tone={st.tone === "grey" ? "" : st.tone} dot>{st.label}</Chip><IcChevronRight size={18} /></div>
    </Link>
  );
}

export default function OperatorTrips() {
  const [search, setSearch] = useSearchParams();
  const [start, setStart] = useState(todayEat());
  const end = addDays(start, 13);
  const [day, setDay] = useState(todayEat());
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(search.get("new") === "1");
  const now = useNow(30000);
  const stripRef = useRef(null);

  const trips = useLoad(() => operatorApi.get("/trips", { from: start, to: end }), [start]);
  const routes = useLoad(() => operatorApi.get("/routes"), []);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(start, i)), [start]);
  const byDay = useMemo(() => {
    const map = {};
    (trips.data?.items || []).forEach((t) => {
      const d = eatDate(t.departureAt);
      (map[d] ||= []).push(t);
    });
    return map;
  }, [trips.data]);

  const dayTrips = byDay[day] || [];
  const shown = dayTrips.filter((t) => status === "all" || (status === "scheduled" ? t.status === "scheduled" : t.status === status));
  const dayStats = useMemo(() => {
    const live = dayTrips.filter((t) => t.status !== "cancelled");
    return {
      trips: dayTrips.length,
      passengers: live.reduce((a, t) => a + (t.ticketsSold || 0), 0),
      revenue: live.reduce((a, t) => a + Number(t.revenue || 0), 0),
      fill: live.length ? Math.round((live.reduce((a, t) => a + occupancy(t).pct, 0) / live.length)) : 0
    };
  }, [dayTrips]);
  const counts = useMemo(() => {
    const c = { all: dayTrips.length };
    dayTrips.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [dayTrips]);

  useEffect(() => {
    const el = stripRef.current?.querySelector(".is-active");
    if (el && stripRef.current) {
      const box = stripRef.current;
      box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "auto" });
    }
  }, [day, start]);

  const shift = (n) => {
    const s = addDays(start, n);
    setStart(s);
    setDay(s);
  };
  const goToday = () => { setStart(todayEat()); setDay(todayEat()); };
  const closeAdd = () => {
    setAdding(false);
    if (search.get("new")) setSearch({}, { replace: true });
  };
  const first = dateParts(days[0]);
  const last = dateParts(days[13]);
  const monthLabel = first.m === last.m ? `${MONTHS[first.m]} ${first.y}` : `${first.month} – ${last.month} ${last.y}`;

  return (
    <>
      <PageHead sub="Every departure for the next two weeks. Times are East Africa Time." actions={<button className="bop-btn bop-btn-primary" onClick={() => setAdding(true)}><IcPlus size={18} /> Extra trip</button>} />

      <section className="bop-card bop-agenda">
        <div className="bop-agenda-head">
          <strong>{monthLabel}</strong>
          <div>
            {start !== todayEat() ? <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={goToday}>Today</button> : null}
            <button type="button" className="bop-icon-btn is-sm" onClick={() => shift(-14)} aria-label="Previous 14 days"><IcChevronLeft size={18} /></button>
            <button type="button" className="bop-icon-btn is-sm" onClick={() => shift(14)} aria-label="Next 14 days"><IcChevronRight size={18} /></button>
          </div>
        </div>
        <div className="bop-strip" role="tablist" aria-label="Choose a day" ref={stripRef}>
          {days.map((d) => {
            const p = dateParts(d);
            const count = byDay[d]?.length || 0;
            const isToday = d === todayEat();
            return (
              <button key={d} role="tab" type="button" aria-selected={d === day} className={`bop-day ${d === day ? "is-active" : ""} ${!count && !trips.loading ? "is-empty" : ""} ${isToday ? "is-today" : ""}`} onClick={() => setDay(d)}>
                <small>{isToday ? "Today" : p.weekday}</small>
                <strong>{p.d}</strong>
                <span>{trips.loading ? <i className="bop-day-dots is-skel" /> : count ? <><i />{count} trip{count === 1 ? "" : "s"}</> : "none"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="bop-daybar">
        <div>
          <h2>{longDayLabel(day)}</h2>
          <p>{trips.loading ? "Loading…" : dayStats.trips ? <><b>{dayStats.trips}</b> trip{dayStats.trips === 1 ? "" : "s"} · <b>{dayStats.passengers.toLocaleString("en-US")}</b> passengers · <b>UGX {ugxShort(dayStats.revenue)}</b> · {dayStats.fill}% average fill</> : "No trips on this day"}</p>
        </div>
        <Segmented label="Filter by status" value={status} onChange={setStatus} options={STATUS_FILTERS.map(([v, l]) => [v, l, trips.loading ? null : counts[v] ?? 0])} />
      </div>

      <ErrorBox error={trips.error} onRetry={trips.refresh} />
      {trips.loading ? (
        <div className="bop-stack" role="status" aria-busy="true" aria-label="Loading trips">
          {[0, 1, 2, 3].map((i) => <div className="bop-card bop-trip is-skel" key={i}><span className="bop-trip-stripe" /><Skel w={64} h={26} /><div style={{ display: "grid", gap: 8 }}><Skel w="70%" h={15} /><Skel w="40%" h={11} /></div><Skel h={8} r={999} /><Skel w={90} h={15} /><Skel w={84} h={26} r={999} /></div>)}
        </div>
      ) : shown.length ? (
        <div className="bop-stack">{shown.map((t) => <TripCard key={t.id} trip={t} now={now} />)}</div>
      ) : (
        <Empty icon={<IcTrips size={28} />} title={status === "all" ? "No trips on this day" : "No trips match this filter"} action={<button className="bop-btn bop-btn-light" onClick={() => setAdding(true)}><IcPlus size={17} /> Add an extra trip</button>}>
          Trips appear automatically from your sessions. Check the days your sessions run, or add a one-off trip.
        </Empty>
      )}

      {adding ? <NewTripModal routes={routes.data?.items || []} onClose={closeAdd} loading={routes.loading} onDone={(d) => { closeAdd(); if (d >= start && d <= end) setDay(d); else { setStart(d); setDay(d); } trips.refresh(); }} /> : null}
    </>
  );
}
