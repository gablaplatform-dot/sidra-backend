import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { eatDate, eatTime, normalizeUgPhone, operatorApi, ugx } from "../../../lib/bus";
import { Avatar, Chip, Confirm, Empty, ErrorBox, Field, Meter, Modal, Panel, Segmented, SearchBox, Skel, Tabs, errMsg, useLoad, useOperator, useTitle } from "../../../components/bus/operator/ui";
import { IcAlert, IcBus, IcCheck, IcClock, IcPhone, IcPin, IcPrint, IcSeat, IcTicket, IcUsers, IcWhatsapp } from "../../../components/bus/operator/icons";
import { dayLabel, longDayLabel, occupancy, seatRows, tripStatus, useMedia, useNow } from "../../../components/bus/operator/util";

const QUICK_DELAYS = [15, 30, 45, 60, 90, 120];

function Ring({ pct = 0, size = 64, stroke = 8, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="bop-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct / 100))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <span>{children}</span>
    </span>
  );
}

const ContactButtons = ({ phone, size = "" }) => {
  const { t } = useTranslation();
  const wa = normalizeUgPhone(phone);
  if (!phone) return null;
  return (
    <span className="bop-contact">
      <a className={`bop-icon-btn ${size}`} href={`tel:${phone}`} aria-label={t("busOp.td.callPhone", { phone })} title={t("busOp.td.call")}><IcPhone size={17} /></a>
      {wa ? <a className={`bop-icon-btn ${size} is-wa`} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={t("busOp.td.msgWhatsapp")} title="WhatsApp"><IcWhatsapp size={17} /></a> : null}
    </span>
  );
};

function PassengerStatus({ p }) {
  const { t } = useTranslation();
  if (p.status === "used") return <Chip tone="green" dot>{t("busOp.ui.st.used")}{p.checkedInAt ? ` ${eatTime(p.checkedInAt)}` : ""}</Chip>;
  if (p.status === "cancelled") return <Chip tone="red" dot>{t("busOp.status.cancelled")}</Chip>;
  return <Chip tone="blue" dot>{t("busOp.ui.st.valid")}</Chip>;
}

// ---------------------------------------------------------------------------------------- seat map
function SeatMap({ total, bySeat, selected, onSelect }) {
  const { t } = useTranslation();
  const { rows } = useMemo(() => seatRows(total), [total]);
  const seat = (n) => {
    const p = bySeat.get(n);
    const state = !p ? "free" : p.status === "used" ? "in" : "taken";
    return (
      <button key={n} type="button" className={`bop-seat is-${state} ${selected === n ? "is-sel" : ""}`} onClick={() => onSelect(n)} aria-pressed={selected === n} aria-label={!p ? t("busOp.td.seatAriaFree", { n }) : t(state === "in" ? "busOp.td.seatAriaIn" : "busOp.td.seatAriaTaken", { n, name: p.passengerName })}>
        <span>{n}</span>
        {state === "in" ? <i><IcCheck size={11} strokeWidth={3.4} /></i> : null}
      </button>
    );
  };
  return (
    <div className="bop-bus" role="group" aria-label={t("busOp.td.seatMap")}>
      <div className="bop-bus-front"><span><IcBus size={18} />{t("busOp.td.front")}</span><em><b /> {t("busOp.td.driver")}</em></div>
      <div className="bop-bus-rows">
        {rows.map((r, i) => (r.bench ? (
          <div className="bop-seatrow is-bench" key={i}>{r.bench.map(seat)}</div>
        ) : (
          <div className="bop-seatrow" key={i}>
            <div className="bop-seatside" style={{ justifyContent: "flex-start" }}>{r.left.map(seat)}</div>
            <span className="bop-aisle" aria-hidden="true">{i + 1}</span>
            <div className="bop-seatside" style={{ justifyContent: "flex-end" }}>{r.right.map(seat)}</div>
          </div>
        )))}
      </div>
    </div>
  );
}

function SeatDetail({ seat, passenger, tripCancelled, onCheckIn, busy, trip }) {
  const { t } = useTranslation();
  if (!seat) {
    return (
      <div className="bop-seatdetail is-hint">
        <span className="bop-tile is-blue"><IcSeat size={22} /></span>
        <strong>{t("busOp.td.tapSeat")}</strong>
        <p>{t("busOp.td.tapSeatHint")}</p>
      </div>
    );
  }
  if (!passenger) {
    return (
      <div className="bop-seatdetail is-hint">
        <span className="bop-seatbadge is-free">{seat}</span>
        <strong>{t("busOp.td.seatFree", { n: seat })}</strong>
        <p>{t("busOp.td.seatFreeHint", { route: trip.route.name })}</p>
      </div>
    );
  }
  const used = passenger.status === "used";
  return (
    <div className="bop-seatdetail">
      <div className="bop-seatdetail-top">
        <span className={`bop-seatbadge ${used ? "is-in" : "is-taken"}`}>{seat}</span>
        <div><small>{t("busOp.brand.seat", { n: seat })}</small><strong>{passenger.passengerName}</strong></div>
      </div>
      <dl className="bop-facts">
        <div><dt>{t("busOp.td.ticket")}</dt><dd>{passenger.ticketTypeName}</dd></div>
        <div><dt>{t("busOp.td.ticketNo")}</dt><dd><code>{passenger.ticketNumber}</code></dd></div>
        <div><dt>{t("busOp.td.order")}</dt><dd><code>{passenger.reference}</code></dd></div>
        <div><dt>{t("busOp.td.phone")}</dt><dd>{passenger.phone || "-"}</dd></div>
      </dl>
      <div className="bop-seatdetail-status"><PassengerStatus p={passenger} /></div>
      <div className="bop-seatdetail-actions">
        <ContactButtons phone={passenger.phone} />
        {passenger.status === "valid" && !tripCancelled ? (
          <button type="button" className="bop-btn bop-btn-primary" disabled={busy} onClick={() => onCheckIn(passenger)}>{busy ? t("busOp.td.checkingIn") : t("busOp.td.checkIn")}</button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- page
export default function OperatorTripDetail() {
  const { t } = useTranslation();
  const { tripId } = useParams();
  const { operator, toast } = useOperator();
  const trip = useLoad(() => operatorApi.get(`/trips/${tripId}`), [tripId]);
  const now = useNow(30000);
  const isPhone = useMedia("(max-width: 767px)");
  const [tab, setTab] = useState("overview");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(null); // "delay" | "cancel" | "depart" | "complete"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [delay, setDelay] = useState({ minutes: "30", note: "" });
  const [reason, setReason] = useState("");
  const [rowBusy, setRowBusy] = useState("");
  const [selected, setSelected] = useState(null);

  const td = trip.data;
  const date = td ? eatDate(td.departureAt) : null;
  // The list endpoint knows the bus type and takings; fetch the day's trips to enrich the header.
  const extra = useLoad(() => (date ? operatorApi.get("/trips", { from: date, to: date }) : Promise.resolve(null)), [date]);
  const info = extra.data?.items?.find((x) => x.id === tripId);

  useTitle(td ? (td.route.destinationName ? t("busOp.td.titleFromTo", { from: td.route.originName || td.route.name, to: td.route.destinationName }) : td.route.originName || td.route.name) : t("busOp.nav.trip"), "/bus/operator/trips");

  const active = useMemo(() => (td?.passengers || []).filter((p) => p.status !== "cancelled"), [td]);
  const bySeat = useMemo(() => {
    const m = new Map();
    active.forEach((p) => m.set(Number(p.seatNumber), p));
    return m;
  }, [active]);
  const checked = active.filter((p) => p.status === "used").length;

  const passengers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (td?.passengers || []).filter((p) => {
      if (filter === "waiting" && p.status !== "valid") return false;
      if (filter === "in" && p.status !== "used") return false;
      return !needle || [p.passengerName, p.phone, p.ticketNumber, p.reference, String(p.seatNumber)].some((v) => String(v ?? "").toLowerCase().includes(needle));
    });
  }, [td, q, filter]);

  const byType = useMemo(() => {
    const m = new Map();
    active.forEach((p) => m.set(p.ticketTypeName || t("busOp.td.ticket"), (m.get(p.ticketTypeName || t("busOp.td.ticket")) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const recent = useMemo(() => active.filter((p) => p.checkedInAt).sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt)).slice(0, 5), [active]);

  useEffect(() => { setSelected(null); setTab("overview"); }, [tripId]);

  const close = () => { if (!busy) { setDialog(null); setError(""); } };
  const run = async (fn, message) => {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      toast(typeof message === "function" ? message(res) : message);
      setDialog(null);
      await trip.reload();
      extra.reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async (p) => {
    setRowBusy(p.ticketNumber);
    try {
      const res = await operatorApi.post("/tickets/check-in", { ticketNumber: p.ticketNumber });
      if (res.valid) toast(t("busOp.td.checkedInToast", { name: p.passengerName }));
      else toast(res.message || t("busOp.td.checkInFailed"), "error");
      await trip.reload();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setRowBusy("");
    }
  };

  if (trip.loading && !td) {
    return (
      <div role="status" aria-busy="true" aria-label={t("busOp.td.loadingTrip")}>
        <Skel h={210} r={20} />
        <div className="bop-kpis bop-kpis-3" style={{ marginTop: 16 }}>{[0, 1, 2].map((i) => <Skel key={i} h={96} r={18} />)}</div>
        <Skel h={320} r={18} style={{ marginTop: 16 }} />
      </div>
    );
  }
  if (trip.error || !td) {
    return <><div style={{ marginBottom: 14 }}><Link to="/bus/operator/trips" className="bop-textlink">{t("busOp.td.backToTrips")}</Link></div><ErrorBox error={trip.error || new Error(t("busOp.td.notFound"))} onRetry={trip.refresh} /></>;
  }

  const st = tripStatus(td, now);
  const occ = occupancy({ seats: td.seats, seatsTaken: td.seatsTaken });
  const upcoming = td.status === "scheduled";
  const delayMinutes = Math.max(0, Math.min(720, Number(delay.minutes) || 0));
  const effective = new Date(new Date(td.departureAt).getTime() + (td.delayMinutes || 0) * 60000);
  const [from, to] = [td.route.originName, td.route.destinationName];
  const selPassenger = selected ? bySeat.get(selected) : null;
  const freeSeats = Math.max(0, td.seats - active.length);

  return (
    <>
      {/* ---------- summary */}
      <section className="bop-tripsum bop-no-print">
        <div className="bop-tripsum-top">
          <div className="bop-tripsum-chips">
            <Chip tone={st.tone === "grey" ? "" : st.tone} dot className="bop-chip-light">{st.label}</Chip>
            {td.delayMinutes ? <Chip tone="amber" className="bop-chip-light"><IcClock size={13} /> {t("busOp.td.delayedMin", { n: td.delayMinutes })}</Chip> : null}
            {info && !info.fromSchedule ? <Chip tone="orange" className="bop-chip-light">{t("busOp.trips.extraTrip")}</Chip> : null}
          </div>
          <div className="bop-tripsum-actions">
            <button className="bop-btn bop-btn-ghost-light bop-btn-sm" onClick={() => window.print()}><IcPrint size={17} /> {t("busOp.td.printManifest")}</button>
            {upcoming ? <button className="bop-btn bop-btn-ghost-light bop-btn-sm" onClick={() => { setDelay({ minutes: String(td.delayMinutes || 30), note: td.note || "" }); setDialog("delay"); }}><IcClock size={17} /> {t("busOp.td.reportDelay")}</button> : null}
            {upcoming ? <button className="bop-btn bop-btn-primary bop-btn-sm" onClick={() => setDialog("depart")}>{t("busOp.td.markDeparted")}</button> : null}
            {td.status === "departed" ? <button className="bop-btn bop-btn-primary bop-btn-sm" onClick={() => setDialog("complete")}>{t("busOp.td.markCompleted")}</button> : null}
            {upcoming ? <button className="bop-btn bop-btn-danger-soft bop-btn-sm" onClick={() => setDialog("cancel")}>{t("busOp.td.cancelTrip")}</button> : null}
          </div>
        </div>

        <div className="bop-tripsum-route">
          <div className="bop-city"><small>{t("busOp.route.from")}</small><strong>{from || td.route.name}</strong></div>
          <div className="bop-line" aria-hidden="true"><span /><i><IcBus size={18} /></i><span /></div>
          <div className="bop-city is-end"><small>{t("busOp.route.to")}</small><strong>{to || "-"}</strong></div>
        </div>

        <dl className="bop-tripsum-facts">
          <div><dt>{t("busOp.td.departure")}</dt><dd>{eatTime(td.departureAt)}{td.delayMinutes ? <small>{t("busOp.td.nowTime", { time: eatTime(effective) })}</small> : null}</dd></div>
          <div><dt>{t("busOp.td.date")}</dt><dd>{dayLabel(date)}</dd></div>
          <div><dt>{t("busOp.td.boarding")}</dt><dd>{td.route.boardingPoint || t("busOp.td.notSet")}</dd></div>
          <div><dt>{t("busOp.dash.bus")}</dt><dd>{info?.busType || t("busOp.td.standard")}</dd></div>
          <div><dt>{t("busOp.dash.colSeats")}</dt><dd>{td.seatsTaken}<small>/ {td.seats}</small></dd></div>
        </dl>
        {td.note ? <p className="bop-tripsum-note"><IcAlert size={15} /> {td.note}</p> : null}
      </section>

      {/* ---------- tabs */}
      <div className="bop-no-print">
        <Tabs label={t("busOp.td.sections")} value={tab} onChange={setTab} tabs={[
          { key: "overview", label: t("busOp.td.overview") },
          { key: "passengers", label: t("busOp.td.passengers"), count: active.length },
          { key: "seats", label: t("busOp.dash.colSeats"), count: `${td.seatsTaken}/${td.seats}` }
        ]} />
      </div>

      {tab === "overview" ? (
        <div className="bop-no-print">
          <div className="bop-kpis bop-kpis-3">
            <div className="bop-card bop-stat">
              <span className="bop-tile is-blue"><IcUsers size={21} /></span>
              <div><small>{t("busOp.td.passengers")}</small><strong>{active.length}</strong><span>{t("busOp.td.seatsLeft", { count: freeSeats })}</span></div>
            </div>
            <div className="bop-card bop-stat">
              <Ring pct={active.length ? (checked / active.length) * 100 : 0} size={52} stroke={7}><b>{active.length ? Math.round((checked / active.length) * 100) : 0}</b></Ring>
              <div><small>{t("busOp.ui.st.used")}</small><strong>{checked}<em>/{active.length}</em></strong><span>{t("busOp.td.stillToBoard", { n: active.length - checked })}</span></div>
            </div>
            <div className="bop-card bop-stat">
              <Ring pct={occ.pct} size={52} stroke={7}><b>{occ.pct}</b></Ring>
              <div><small>{t("busOp.td.fillRate")}</small><strong>{occ.pct}%</strong><span>{info ? t("busOp.td.soldAmount", { amount: ugx(info.revenue) }) : t("busOp.td.seatsOf", { taken: td.seatsTaken, total: td.seats })}</span></div>
            </div>
          </div>

          <div className="bop-grid bop-grid-even">
            <Panel title={t("busOp.td.boardingProgress")} sub={td.status === "cancelled" ? t("busOp.td.tripWasCancelled") : t("busOp.td.onBoard", { checked, total: active.length })}>
              <div className="bop-boardbar">
                <Meter pct={active.length ? Math.round((checked / active.length) * 100) : 0} level="high" label={t("busOp.td.checkedInPassengers")} />
                <div><b>{checked}</b> {t("busOp.td.checkedInLower")} <i /> <b>{active.length - checked}</b> {t("busOp.td.waiting")}</div>
              </div>
              <h3 className="bop-subtitle">{t("busOp.td.latestCheckIns")}</h3>
              {recent.length ? (
                <ul className="bop-feed bop-feed-tight">
                  {recent.map((p) => (
                    <li key={p.id || p.ticketNumber}><div className="bop-feed-row"><Avatar name={p.passengerName} size={36} /><span className="bop-feed-main"><strong>{p.passengerName}</strong><small>{t("busOp.brand.seat", { n: p.seatNumber })} · {p.ticketTypeName}</small></span><span className="bop-feed-end"><Chip tone="green"><IcCheck size={12} strokeWidth={3} /> {eatTime(p.checkedInAt)}</Chip></span></div></li>
                  ))}
                </ul>
              ) : <p className="bop-hint"><Trans i18nKey="busOp.td.nobodyChecked" components={{ l: <Link to="/bus/operator/tickets" className="bop-textlink" /> }} /></p>}
            </Panel>
            <Panel title={t("busOp.td.ticketsByType")} sub={t("busOp.td.ticketsOnTrip", { count: active.length })}>
              {byType.length ? (
                <ul className="bop-hbars">
                  {byType.map(([name, n], i) => (
                    <li key={name}>
                      <div><strong>{name}</strong><em>{n}<small>{Math.round((n / active.length) * 100)}%</small></em></div>
                      <span className="bop-hbar"><i className={i === 0 ? "is-top" : ""} style={{ width: `${Math.max(5, (n / byType[0][1]) * 100)}%` }} /></span>
                    </li>
                  ))}
                </ul>
              ) : <Empty compact icon={<IcTicket size={22} />} title={t("busOp.td.noTickets")}>{t("busOp.td.noTicketsHint")}</Empty>}
              <div className="bop-detail-list">
                <div><IcPin size={16} /><span>{t("busOp.route.boarding")}</span><b>{td.route.boardingPoint || t("busOp.td.notSet")}</b></div>
                <div><IcClock size={16} /><span>{t("busOp.td.departs")}</span><b>{longDayLabel(date)} · {eatTime(td.departureAt)}</b></div>
                <div><IcBus size={16} /><span>{t("busOp.dash.bus")}</span><b>{info?.busType || t("busOp.td.standard")}</b></div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "passengers" ? (
        <section className="bop-no-print">
          <div className="bop-toolbar">
            <SearchBox value={q} onChange={setQ} placeholder={t("busOp.td.searchPh")} label={t("busOp.td.searchAria")} />
            <Segmented label={t("busOp.td.filterAria")} value={filter} onChange={setFilter} options={[["all", t("busOp.trips.f.all"), td.passengers.length], ["waiting", t("busOp.ui.st.valid"), active.length - checked], ["in", t("busOp.ui.st.used"), checked]]} />
          </div>
          {td.passengers.length === 0 ? <Empty icon={<IcUsers size={26} />} title={t("busOp.td.noPassengers")}>{t("busOp.td.noTicketsHint")}</Empty> : passengers.length === 0 ? <Empty compact icon={<IcUsers size={22} />} title={t("busOp.td.noPassengersMatch")}>{t("busOp.td.noPassengersMatchHint")}</Empty> : (
            <div className="bop-table is-passengers" role="table">
              <div className="bop-thead" role="row"><span role="columnheader">{t("busOp.td.seat")}</span><span role="columnheader">{t("busOp.td.passenger")}</span><span role="columnheader">{t("busOp.td.ticket")}</span><span role="columnheader">{t("busOp.td.phone")}</span><span role="columnheader">{t("busOp.dash.colStatus")}</span><span role="columnheader" /></div>
              {passengers.map((p) => (
                <div className={`bop-trow ${p.status === "cancelled" ? "is-muted" : ""}`} role="row" key={p.id || p.ticketNumber}>
                  <span className="c-seat" role="cell"><b className={`bop-seatbadge is-${p.status === "used" ? "in" : p.status === "cancelled" ? "off" : "taken"}`}>{p.seatNumber}</b></span>
                  <span className="c-who" role="cell"><Avatar name={p.passengerName} size={38} /><span><strong>{p.passengerName}</strong><small>{p.ticketTypeName}</small></span></span>
                  <span className="c-ticket" role="cell"><code>{p.ticketNumber}</code><small>{p.reference}</small></span>
                  <span className="c-phone" role="cell">{p.phone || "-"}</span>
                  <span className="c-status" role="cell"><PassengerStatus p={p} /></span>
                  <span className="c-actions" role="cell">
                    <ContactButtons phone={p.phone} size="is-sm" />
                    {p.status === "valid" && td.status !== "cancelled" ? <button type="button" className="bop-btn bop-btn-primary bop-btn-sm" disabled={rowBusy === p.ticketNumber} onClick={() => checkIn(p)}>{rowBusy === p.ticketNumber ? "…" : t("busOp.td.checkIn")}</button> : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "seats" ? (
        <section className="bop-seatlayout bop-no-print">
          <div className="bop-card bop-panel bop-seatpanel">
            <div className="bop-seatlegend" aria-label={t("busOp.td.legend")}>
              <span><i className="is-taken" />{t("busOp.td.taken")} <b>{active.length - checked}</b></span>
              <span><i className="is-in"><IcCheck size={9} strokeWidth={4} /></i>{t("busOp.ui.st.used")} <b>{checked}</b></span>
              <span><i className="is-free" />{t("busOp.td.free")} <b>{freeSeats}</b></span>
            </div>
            {td.seats > 0 ? <SeatMap total={td.seats} bySeat={bySeat} selected={selected} onSelect={(n) => setSelected(selected === n ? null : n)} /> : <Empty compact title={t("busOp.td.noSeats")}>{t("busOp.td.noSeatsHint")}</Empty>}
          </div>
          {!isPhone ? (
            <aside className="bop-card bop-panel bop-seataside">
              <SeatDetail seat={selected} passenger={selPassenger} tripCancelled={td.status === "cancelled"} onCheckIn={checkIn} busy={rowBusy === selPassenger?.ticketNumber} trip={td} />
            </aside>
          ) : null}
        </section>
      ) : null}
      {tab === "seats" && isPhone && selected ? (
        <Modal title={selPassenger ? t("busOp.td.passenger") : t("busOp.brand.seat", { n: selected })} onClose={() => setSelected(null)} size="sm">
          <SeatDetail seat={selected} passenger={selPassenger} tripCancelled={td.status === "cancelled"} onCheckIn={checkIn} busy={rowBusy === selPassenger?.ticketNumber} trip={td} />
        </Modal>
      ) : null}

      {/* ---------- printable manifest */}
      <section className="bop-print-only">
        <h2>{operator.companyName} · {t("busOp.td.manifest")}</h2>
        <p>{td.route.name} · {longDayLabel(date)} {eatTime(td.departureAt)} EAT · {t("busOp.td.passengersN", { count: active.length })}</p>
        <table>
          <thead><tr><th>{t("busOp.td.seat")}</th><th>{t("busOp.td.passenger")}</th><th>{t("busOp.td.ticket")}</th><th>{t("busOp.td.type")}</th><th>{t("busOp.td.phone")}</th><th>{t("busOp.td.boarded")}</th></tr></thead>
          <tbody>{(td.passengers || []).filter((p) => p.status !== "cancelled").map((p) => <tr key={p.id || p.ticketNumber}><td>{p.seatNumber}</td><td>{p.passengerName}</td><td>{p.ticketNumber}</td><td>{p.ticketTypeName}</td><td>{p.phone}</td><td>{p.status === "used" ? t("busOp.ob.yes") : "[  ]"}</td></tr>)}</tbody>
        </table>
      </section>

      {/* ---------- dialogs */}
      {dialog === "delay" ? (
        <Modal title={t("busOp.td.delayTitle")} subtitle={t("busOp.td.delaySub")} onClose={close}
          footer={<><button className="bop-btn bop-btn-light" onClick={close} disabled={busy}>{t("busOp.common.cancel")}</button><button className="bop-btn bop-btn-primary" disabled={busy} onClick={() => run(() => operatorApi.post(`/trips/${tripId}/delay`, { delayMinutes, note: delay.note.trim() }), (r) => (r?.notified ? t("busOp.td.delaySavedN", { count: r.notified }) : t("busOp.td.delaySaved")))}>{busy ? t("busOp.td.saving") : delayMinutes ? t("busOp.td.notify") : t("busOp.td.clearDelay")}</button></>}>
          <div className="bop-form">
            <div className="bop-chips">{QUICK_DELAYS.map((m) => <button key={m} type="button" className={`bop-chip ${Number(delay.minutes) === m ? "is-on" : ""}`} onClick={() => setDelay({ ...delay, minutes: String(m) })}>{m >= 60 ? t("busOp.td.hoursN", { count: m / 60 }) : t("busOp.dur.min", { n: m })}</button>)}</div>
            <Field label={t("busOp.td.delayMinutes")} hint={delayMinutes ? t("busOp.td.newDeparture", { time: eatTime(new Date(new Date(td.departureAt).getTime() + delayMinutes * 60000)) }) : t("busOp.td.set0")}><input className="bop-input bop-narrow" type="number" min="0" max="720" value={delay.minutes} onChange={(e) => setDelay({ ...delay, minutes: e.target.value })} /></Field>
            <Field label={t("busOp.td.msgOpt")}><textarea className="bop-textarea" rows={3} maxLength={300} placeholder={t("busOp.td.msgPh")} value={delay.note} onChange={(e) => setDelay({ ...delay, note: e.target.value })} /></Field>
            {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
          </div>
        </Modal>
      ) : null}

      {dialog === "cancel" ? (
        <Confirm title={t("busOp.td.cancelTitle")} danger confirmLabel={t("busOp.td.cancelTrip")} cancelLabel={t("busOp.td.keepTrip")} busy={busy} error={error ? new Error(error) : null} onCancel={close}
          onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/cancel`, { reason: reason.trim() }), (r) => t("busOp.td.cancelledToast", { count: r?.notified || 0 }))}>
          <p>{t("busOp.td.cancelBody", { count: active.length })}</p>
          <Field label={t("busOp.td.reasonLabel")}><textarea className="bop-textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("busOp.td.reasonPh")} /></Field>
        </Confirm>
      ) : null}

      {dialog === "depart" ? (
        <Confirm title={t("busOp.td.departTitle")} confirmLabel={t("busOp.td.departYes")} cancelLabel={t("busOp.td.notYet")} busy={busy} error={error ? new Error(error) : null} onCancel={close} onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/status`, { status: "departed" }), t("busOp.td.departedToast"))}>
          <p>{t("busOp.td.departBody", { checked, total: active.length })}</p>
        </Confirm>
      ) : null}
      {dialog === "complete" ? (
        <Confirm title={t("busOp.td.completeTitle")} confirmLabel={t("busOp.td.markCompleted")} cancelLabel={t("busOp.td.notYet")} busy={busy} error={error ? new Error(error) : null} onCancel={close} onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/status`, { status: "completed" }), t("busOp.td.completedToast"))}>
          <p>{t("busOp.td.completeBody")}</p>
        </Confirm>
      ) : null}
    </>
  );
}
