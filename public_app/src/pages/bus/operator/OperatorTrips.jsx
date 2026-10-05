import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { addDays, dayLabel, dateParts, eatDate, eatTime, longDayLabel, operatorApi, todayEat, ugx } from "../../../lib/bus";
import { IconCalendar } from "../../../components/icons";
import { Empty, ErrorBox, Field, IconChevronRight, IconPlus, ListSkel, Modal, PageHead, StatusChip, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";

const STATUS_FILTERS = [["all", "All"], ["scheduled", "Scheduled"], ["departed", "Departed"], ["completed", "Completed"], ["cancelled", "Cancelled"]];

function NewTripModal({ routes, loading, onClose, onDone }) {
  const { toast } = useOperator();
  const active = routes.filter((r) => r.isActive);
  const [routeId, setRouteId] = useState(active[0]?.id || "");
  const [date, setDate] = useState(todayEat());
  const [time, setTime] = useState("08:00");
  const [seats, setSeats] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    <Modal title="Add an extra trip" subtitle="A one-off departure that doesn’t repeat, like an extra bus on a busy day." onClose={onClose}
      footer={<><button className="bus-btn bus-btn-light" onClick={onClose} disabled={busy}>Cancel</button><button className="bus-btn bus-btn-primary" onClick={save} disabled={busy || !active.length}>{busy ? "Adding…" : "Add trip"}</button></>}>
      {loading ? <ListSkel rows={2} h={56} /> : !active.length ? <div className="bus-alert bus-alert-warn">You need an active route first. Add one under Routes & prices.</div> : (
        <div className="bop-form">
          <Field label="Route"><select className="bus-select" value={routeId} onChange={(e) => setRouteId(e.target.value)}>{active.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <div className="bop-grid2">
            <Field label="Date (EAT)"><input className="bus-input" type="date" min={todayEat()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Departure time"><input className="bus-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Field label="Seats (optional)" hint="Leave empty to use the seats of the route’s bus type."><input className="bus-input bop-narrow" type="number" min="1" max="120" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} /></Field>
          {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
        </div>
      )}
    </Modal>
  );
}

export default function OperatorTrips() {
  const [search, setSearch] = useSearchParams();
  const [start, setStart] = useState(todayEat());
  const end = addDays(start, 13);
  const [day, setDay] = useState(todayEat());
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(search.get("new") === "1");

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

  const shown = (byDay[day] || []).filter((t) => status === "all" || t.status === status);
  const shift = (n) => {
    const s = addDays(start, n);
    setStart(s);
    setDay(s);
  };
  const closeAdd = () => {
    setAdding(false);
    if (search.get("new")) setSearch({}, { replace: true });
  };

  return (
    <>
      <PageHead title="Trips" sub="Every departure, 14 days at a time. Times are East Africa Time." actions={<button className="bus-btn bus-btn-primary" onClick={() => setAdding(true)}><IconPlus width={18} height={18} /> Extra trip</button>} />

      <div className="bop-strip-head">
        <button className="bus-btn bus-btn-light bus-btn-sm" onClick={() => shift(-14)}>Earlier</button>
        <strong>{dayLabel(days[0])} – {dayLabel(days[13])}</strong>
        <button className="bus-btn bus-btn-light bus-btn-sm" onClick={() => shift(14)}>Later</button>
      </div>
      <div className="bus-datestrip" role="tablist" aria-label="Choose a day">
        {days.map((d) => {
          const p = dateParts(d);
          const count = byDay[d]?.length || 0;
          return (
            <button key={d} role="tab" aria-selected={d === day} className={`bus-day ${d === day ? "is-active" : ""} ${!count ? "is-empty" : ""}`} onClick={() => setDay(d)}>
              <small>{d === todayEat() ? "Today" : p.weekday}</small>
              <strong>{p.d}</strong>
              <span>{trips.loading ? "·" : count ? `${count} trip${count === 1 ? "" : "s"}` : "none"}</span>
            </button>
          );
        })}
      </div>

      <div className="bus-filter-row">
        {STATUS_FILTERS.map(([v, l]) => <button key={v} className={`bus-chip ${status === v ? "is-active" : ""}`} onClick={() => setStatus(v)}>{l}</button>)}
      </div>

      <h2 className="bop-daytitle">{longDayLabel(day)}</h2>
      <ErrorBox error={trips.error} onRetry={trips.refresh} />
      {trips.loading ? <ListSkel rows={4} h={84} /> : shown.length ? (
        <div className="bop-stack">
          {shown.map((t) => {
            const pct = t.seats ? Math.min(100, Math.round((t.seatsTaken / t.seats) * 100)) : 0;
            return (
              <Link key={t.id} to={`/bus/operator/trips/${t.id}`} className={`bus-card bop-trip ${t.status === "cancelled" ? "is-cancelled" : ""}`}>
                <div className="bop-trip-time"><strong>{eatTime(t.departureAt)}</strong>{t.delayMinutes ? <span className="bus-chip bus-chip-amber">Delayed {t.delayMinutes}m</span> : null}</div>
                <div className="bop-trip-main">
                  <strong>{t.route.name}</strong>
                  <small>{t.busType || "Bus"}{t.fromSchedule ? "" : " · Extra trip"} · {ugx(t.revenue)} from {t.ticketsSold} ticket{t.ticketsSold === 1 ? "" : "s"}</small>
                  <div className="bop-meter" aria-label={`${t.seatsTaken} of ${t.seats} seats taken`}><i style={{ width: `${pct}%` }} className={pct >= 90 ? "is-full" : ""} /></div>
                  <small>{t.seatsTaken}/{t.seats} seats taken</small>
                </div>
                <div className="bop-trip-end"><StatusChip status={t.status} /><IconChevronRight width={18} height={18} /></div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon={<IconCalendar width={28} height={28} />} title={status === "all" ? "No trips on this day" : `No ${status} trips on this day`} action={<button className="bus-btn bus-btn-light" onClick={() => setAdding(true)}>Add an extra trip</button>}>
          Trips appear automatically from your sessions. Check the days your sessions run, or add a one-off trip.
        </Empty>
      )}

      {adding ? <NewTripModal routes={routes.data?.items || []} onClose={closeAdd} loading={routes.loading} onDone={(d) => { closeAdd(); if (d >= start && d <= end) setDay(d); else { setStart(d); setDay(d); } trips.refresh(); }} /> : null}
    </>
  );
}
