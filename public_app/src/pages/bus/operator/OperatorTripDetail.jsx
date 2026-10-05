import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { dayLabel, eatDate, eatTime, longDayLabel, normalizeUgPhone, operatorApi, ugx } from "../../../lib/bus";
import { Avatar, Chip, Confirm, Empty, ErrorBox, Field, Meter, Modal, Panel, Segmented, SearchBox, Skel, Tabs, errMsg, useLoad, useOperator, useTitle } from "../../../components/bus/operator/ui";
import { IcAlert, IcBus, IcCheck, IcClock, IcPhone, IcPin, IcPrint, IcSeat, IcTicket, IcUsers, IcWhatsapp } from "../../../components/bus/operator/icons";
import { occupancy, seatRows, tripStatus, useMedia, useNow } from "../../../components/bus/operator/util";

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
  const wa = normalizeUgPhone(phone);
  if (!phone) return null;
  return (
    <span className="bop-contact">
      <a className={`bop-icon-btn ${size}`} href={`tel:${phone}`} aria-label={`Call ${phone}`} title="Call"><IcPhone size={17} /></a>
      {wa ? <a className={`bop-icon-btn ${size} is-wa`} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp" title="WhatsApp"><IcWhatsapp size={17} /></a> : null}
    </span>
  );
};

function PassengerStatus({ p }) {
  if (p.status === "used") return <Chip tone="green" dot>Checked in{p.checkedInAt ? ` ${eatTime(p.checkedInAt)}` : ""}</Chip>;
  if (p.status === "cancelled") return <Chip tone="red" dot>Cancelled</Chip>;
  return <Chip tone="blue" dot>Not boarded</Chip>;
}

// ---------------------------------------------------------------------------------------- seat map
function SeatMap({ total, bySeat, selected, onSelect }) {
  const { rows } = useMemo(() => seatRows(total), [total]);
  const seat = (n) => {
    const p = bySeat.get(n);
    const state = !p ? "free" : p.status === "used" ? "in" : "taken";
    return (
      <button key={n} type="button" className={`bop-seat is-${state} ${selected === n ? "is-sel" : ""}`} onClick={() => onSelect(n)} aria-pressed={selected === n} aria-label={`Seat ${n}, ${p ? `${p.passengerName}, ${state === "in" ? "checked in" : "not boarded"}` : "free"}`}>
        <span>{n}</span>
        {state === "in" ? <i><IcCheck size={11} strokeWidth={3.4} /></i> : null}
      </button>
    );
  };
  return (
    <div className="bop-bus" role="group" aria-label="Seat map">
      <div className="bop-bus-front"><span><IcBus size={18} />Front</span><em><b /> Driver</em></div>
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
  if (!seat) {
    return (
      <div className="bop-seatdetail is-hint">
        <span className="bop-tile is-blue"><IcSeat size={22} /></span>
        <strong>Tap a seat</strong>
        <p>See who is sitting there, call them, or check them in.</p>
      </div>
    );
  }
  if (!passenger) {
    return (
      <div className="bop-seatdetail is-hint">
        <span className="bop-seatbadge is-free">{seat}</span>
        <strong>Seat {seat} is free</strong>
        <p>No ticket has been sold for this seat on {trip.route.name}.</p>
      </div>
    );
  }
  const used = passenger.status === "used";
  return (
    <div className="bop-seatdetail">
      <div className="bop-seatdetail-top">
        <span className={`bop-seatbadge ${used ? "is-in" : "is-taken"}`}>{seat}</span>
        <div><small>Seat {seat}</small><strong>{passenger.passengerName}</strong></div>
      </div>
      <dl className="bop-facts">
        <div><dt>Ticket</dt><dd>{passenger.ticketTypeName}</dd></div>
        <div><dt>Ticket no.</dt><dd><code>{passenger.ticketNumber}</code></dd></div>
        <div><dt>Order</dt><dd><code>{passenger.reference}</code></dd></div>
        <div><dt>Phone</dt><dd>{passenger.phone || "-"}</dd></div>
      </dl>
      <div className="bop-seatdetail-status"><PassengerStatus p={passenger} /></div>
      <div className="bop-seatdetail-actions">
        <ContactButtons phone={passenger.phone} />
        {passenger.status === "valid" && !tripCancelled ? (
          <button type="button" className="bop-btn bop-btn-primary" disabled={busy} onClick={() => onCheckIn(passenger)}>{busy ? "Checking in…" : "Check in"}</button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- page
export default function OperatorTripDetail() {
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

  const t = trip.data;
  const date = t ? eatDate(t.departureAt) : null;
  // The list endpoint knows the bus type and takings; fetch the day's trips to enrich the header.
  const extra = useLoad(() => (date ? operatorApi.get("/trips", { from: date, to: date }) : Promise.resolve(null)), [date]);
  const info = extra.data?.items?.find((x) => x.id === tripId);

  useTitle(t ? `${t.route.originName || t.route.name}${t.route.destinationName ? ` to ${t.route.destinationName}` : ""}` : "Trip", "/bus/operator/trips");

  const active = useMemo(() => (t?.passengers || []).filter((p) => p.status !== "cancelled"), [t]);
  const bySeat = useMemo(() => {
    const m = new Map();
    active.forEach((p) => m.set(Number(p.seatNumber), p));
    return m;
  }, [active]);
  const checked = active.filter((p) => p.status === "used").length;

  const passengers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (t?.passengers || []).filter((p) => {
      if (filter === "waiting" && p.status !== "valid") return false;
      if (filter === "in" && p.status !== "used") return false;
      return !needle || [p.passengerName, p.phone, p.ticketNumber, p.reference, String(p.seatNumber)].some((v) => String(v ?? "").toLowerCase().includes(needle));
    });
  }, [t, q, filter]);

  const byType = useMemo(() => {
    const m = new Map();
    active.forEach((p) => m.set(p.ticketTypeName || "Ticket", (m.get(p.ticketTypeName || "Ticket") || 0) + 1));
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
      if (res.valid) toast(`${p.passengerName} checked in`);
      else toast(res.message || "Couldn’t check in this ticket", "error");
      await trip.reload();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setRowBusy("");
    }
  };

  if (trip.loading && !t) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading trip">
        <Skel h={210} r={20} />
        <div className="bop-kpis bop-kpis-3" style={{ marginTop: 16 }}>{[0, 1, 2].map((i) => <Skel key={i} h={96} r={18} />)}</div>
        <Skel h={320} r={18} style={{ marginTop: 16 }} />
      </div>
    );
  }
  if (trip.error || !t) {
    return <><div style={{ marginBottom: 14 }}><Link to="/bus/operator/trips" className="bop-textlink">Back to trips</Link></div><ErrorBox error={trip.error || new Error("Trip not found")} onRetry={trip.refresh} /></>;
  }

  const st = tripStatus(t, now);
  const occ = occupancy({ seats: t.seats, seatsTaken: t.seatsTaken });
  const upcoming = t.status === "scheduled";
  const delayMinutes = Math.max(0, Math.min(720, Number(delay.minutes) || 0));
  const effective = new Date(new Date(t.departureAt).getTime() + (t.delayMinutes || 0) * 60000);
  const [from, to] = [t.route.originName, t.route.destinationName];
  const selPassenger = selected ? bySeat.get(selected) : null;
  const freeSeats = Math.max(0, t.seats - active.length);

  return (
    <>
      {/* ---------- summary */}
      <section className="bop-tripsum bop-no-print">
        <div className="bop-tripsum-top">
          <div className="bop-tripsum-chips">
            <Chip tone={st.tone === "grey" ? "" : st.tone} dot className="bop-chip-light">{st.label}</Chip>
            {t.delayMinutes ? <Chip tone="amber" className="bop-chip-light"><IcClock size={13} /> Delayed {t.delayMinutes} min</Chip> : null}
            {info && !info.fromSchedule ? <Chip tone="orange" className="bop-chip-light">Extra trip</Chip> : null}
          </div>
          <div className="bop-tripsum-actions">
            <button className="bop-btn bop-btn-ghost-light bop-btn-sm" onClick={() => window.print()}><IcPrint size={17} /> Print manifest</button>
            {upcoming ? <button className="bop-btn bop-btn-ghost-light bop-btn-sm" onClick={() => { setDelay({ minutes: String(t.delayMinutes || 30), note: t.note || "" }); setDialog("delay"); }}><IcClock size={17} /> Report delay</button> : null}
            {upcoming ? <button className="bop-btn bop-btn-primary bop-btn-sm" onClick={() => setDialog("depart")}>Mark departed</button> : null}
            {t.status === "departed" ? <button className="bop-btn bop-btn-primary bop-btn-sm" onClick={() => setDialog("complete")}>Mark completed</button> : null}
            {upcoming ? <button className="bop-btn bop-btn-danger-soft bop-btn-sm" onClick={() => setDialog("cancel")}>Cancel trip</button> : null}
          </div>
        </div>

        <div className="bop-tripsum-route">
          <div className="bop-city"><small>From</small><strong>{from || t.route.name}</strong></div>
          <div className="bop-line" aria-hidden="true"><span /><i><IcBus size={18} /></i><span /></div>
          <div className="bop-city is-end"><small>To</small><strong>{to || "-"}</strong></div>
        </div>

        <dl className="bop-tripsum-facts">
          <div><dt>Departure</dt><dd>{eatTime(t.departureAt)}{t.delayMinutes ? <small>now {eatTime(effective)}</small> : null}</dd></div>
          <div><dt>Date</dt><dd>{dayLabel(date)}</dd></div>
          <div><dt>Boarding</dt><dd>{t.route.boardingPoint || "Not set"}</dd></div>
          <div><dt>Bus</dt><dd>{info?.busType || "Standard"}</dd></div>
          <div><dt>Seats</dt><dd>{t.seatsTaken}<small>/ {t.seats}</small></dd></div>
        </dl>
        {t.note ? <p className="bop-tripsum-note"><IcAlert size={15} /> {t.note}</p> : null}
      </section>

      {/* ---------- tabs */}
      <div className="bop-no-print">
        <Tabs label="Trip sections" value={tab} onChange={setTab} tabs={[
          { key: "overview", label: "Overview" },
          { key: "passengers", label: "Passengers", count: active.length },
          { key: "seats", label: "Seats", count: `${t.seatsTaken}/${t.seats}` }
        ]} />
      </div>

      {tab === "overview" ? (
        <div className="bop-no-print">
          <div className="bop-kpis bop-kpis-3">
            <div className="bop-card bop-stat">
              <span className="bop-tile is-blue"><IcUsers size={21} /></span>
              <div><small>Passengers</small><strong>{active.length}</strong><span>{freeSeats} seat{freeSeats === 1 ? "" : "s"} left</span></div>
            </div>
            <div className="bop-card bop-stat">
              <Ring pct={active.length ? (checked / active.length) * 100 : 0} size={52} stroke={7}><b>{active.length ? Math.round((checked / active.length) * 100) : 0}</b></Ring>
              <div><small>Checked in</small><strong>{checked}<em>/{active.length}</em></strong><span>{active.length - checked} still to board</span></div>
            </div>
            <div className="bop-card bop-stat">
              <Ring pct={occ.pct} size={52} stroke={7}><b>{occ.pct}</b></Ring>
              <div><small>Fill rate</small><strong>{occ.pct}%</strong><span>{info ? `${ugx(info.revenue)} sold` : `${t.seatsTaken} of ${t.seats} seats`}</span></div>
            </div>
          </div>

          <div className="bop-grid bop-grid-even">
            <Panel title="Boarding progress" sub={t.status === "cancelled" ? "This trip was cancelled" : `${checked} of ${active.length} passengers on board`}>
              <div className="bop-boardbar">
                <Meter pct={active.length ? Math.round((checked / active.length) * 100) : 0} level="high" label="Checked-in passengers" />
                <div><b>{checked}</b> checked in <i /> <b>{active.length - checked}</b> waiting</div>
              </div>
              <h3 className="bop-subtitle">Latest check-ins</h3>
              {recent.length ? (
                <ul className="bop-feed bop-feed-tight">
                  {recent.map((p) => (
                    <li key={p.id || p.ticketNumber}><div className="bop-feed-row"><Avatar name={p.passengerName} size={36} /><span className="bop-feed-main"><strong>{p.passengerName}</strong><small>Seat {p.seatNumber} · {p.ticketTypeName}</small></span><span className="bop-feed-end"><Chip tone="green"><IcCheck size={12} strokeWidth={3} /> {eatTime(p.checkedInAt)}</Chip></span></div></li>
                  ))}
                </ul>
              ) : <p className="bop-hint">Nobody has been checked in yet. Use <Link to="/bus/operator/tickets" className="bop-textlink">Verify tickets</Link> at the gate.</p>}
            </Panel>
            <Panel title="Tickets by type" sub={`${active.length} ticket${active.length === 1 ? "" : "s"} on this trip`}>
              {byType.length ? (
                <ul className="bop-hbars">
                  {byType.map(([name, n], i) => (
                    <li key={name}>
                      <div><strong>{name}</strong><em>{n}<small>{Math.round((n / active.length) * 100)}%</small></em></div>
                      <span className="bop-hbar"><i className={i === 0 ? "is-top" : ""} style={{ width: `${Math.max(5, (n / byType[0][1]) * 100)}%` }} /></span>
                    </li>
                  ))}
                </ul>
              ) : <Empty compact icon={<IcTicket size={22} />} title="No tickets yet">Tickets booked for this trip will appear here.</Empty>}
              <div className="bop-detail-list">
                <div><IcPin size={16} /><span>Boarding point</span><b>{t.route.boardingPoint || "Not set"}</b></div>
                <div><IcClock size={16} /><span>Departs</span><b>{longDayLabel(date)} · {eatTime(t.departureAt)}</b></div>
                <div><IcBus size={16} /><span>Bus</span><b>{info?.busType || "Standard"}</b></div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "passengers" ? (
        <section className="bop-no-print">
          <div className="bop-toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="Search name, phone, ticket or seat" label="Search passengers" />
            <Segmented label="Filter passengers" value={filter} onChange={setFilter} options={[["all", "All", t.passengers.length], ["waiting", "Not boarded", active.length - checked], ["in", "Checked in", checked]]} />
          </div>
          {t.passengers.length === 0 ? <Empty icon={<IcUsers size={26} />} title="No passengers yet">Tickets booked for this trip will appear here.</Empty> : passengers.length === 0 ? <Empty compact icon={<IcUsers size={22} />} title="No passengers match">Try another name, phone number or ticket number.</Empty> : (
            <div className="bop-table is-passengers" role="table">
              <div className="bop-thead" role="row"><span role="columnheader">Seat</span><span role="columnheader">Passenger</span><span role="columnheader">Ticket</span><span role="columnheader">Phone</span><span role="columnheader">Status</span><span role="columnheader" /></div>
              {passengers.map((p) => (
                <div className={`bop-trow ${p.status === "cancelled" ? "is-muted" : ""}`} role="row" key={p.id || p.ticketNumber}>
                  <span className="c-seat" role="cell"><b className={`bop-seatbadge is-${p.status === "used" ? "in" : p.status === "cancelled" ? "off" : "taken"}`}>{p.seatNumber}</b></span>
                  <span className="c-who" role="cell"><Avatar name={p.passengerName} size={38} /><span><strong>{p.passengerName}</strong><small>{p.ticketTypeName}</small></span></span>
                  <span className="c-ticket" role="cell"><code>{p.ticketNumber}</code><small>{p.reference}</small></span>
                  <span className="c-phone" role="cell">{p.phone || "-"}</span>
                  <span className="c-status" role="cell"><PassengerStatus p={p} /></span>
                  <span className="c-actions" role="cell">
                    <ContactButtons phone={p.phone} size="is-sm" />
                    {p.status === "valid" && t.status !== "cancelled" ? <button type="button" className="bop-btn bop-btn-primary bop-btn-sm" disabled={rowBusy === p.ticketNumber} onClick={() => checkIn(p)}>{rowBusy === p.ticketNumber ? "…" : "Check in"}</button> : null}
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
            <div className="bop-seatlegend" aria-label="Legend">
              <span><i className="is-taken" />Taken <b>{active.length - checked}</b></span>
              <span><i className="is-in"><IcCheck size={9} strokeWidth={4} /></i>Checked in <b>{checked}</b></span>
              <span><i className="is-free" />Free <b>{freeSeats}</b></span>
            </div>
            {t.seats > 0 ? <SeatMap total={t.seats} bySeat={bySeat} selected={selected} onSelect={(n) => setSelected(selected === n ? null : n)} /> : <Empty compact title="No seats">This trip has no seats configured.</Empty>}
          </div>
          {!isPhone ? (
            <aside className="bop-card bop-panel bop-seataside">
              <SeatDetail seat={selected} passenger={selPassenger} tripCancelled={t.status === "cancelled"} onCheckIn={checkIn} busy={rowBusy === selPassenger?.ticketNumber} trip={t} />
            </aside>
          ) : null}
        </section>
      ) : null}
      {tab === "seats" && isPhone && selected ? (
        <Modal title={selPassenger ? "Passenger" : `Seat ${selected}`} onClose={() => setSelected(null)} size="sm">
          <SeatDetail seat={selected} passenger={selPassenger} tripCancelled={t.status === "cancelled"} onCheckIn={checkIn} busy={rowBusy === selPassenger?.ticketNumber} trip={t} />
        </Modal>
      ) : null}

      {/* ---------- printable manifest */}
      <section className="bop-print-only">
        <h2>{operator.companyName} · Passenger manifest</h2>
        <p>{t.route.name} · {longDayLabel(date)} {eatTime(t.departureAt)} EAT · {active.length} passengers</p>
        <table>
          <thead><tr><th>Seat</th><th>Passenger</th><th>Ticket</th><th>Type</th><th>Phone</th><th>Boarded</th></tr></thead>
          <tbody>{(t.passengers || []).filter((p) => p.status !== "cancelled").map((p) => <tr key={p.id || p.ticketNumber}><td>{p.seatNumber}</td><td>{p.passengerName}</td><td>{p.ticketNumber}</td><td>{p.ticketTypeName}</td><td>{p.phone}</td><td>{p.status === "used" ? "Yes" : "[  ]"}</td></tr>)}</tbody>
        </table>
      </section>

      {/* ---------- dialogs */}
      {dialog === "delay" ? (
        <Modal title="Report a delay" subtitle="Passengers with a ticket for this trip are emailed straight away." onClose={close}
          footer={<><button className="bop-btn bop-btn-light" onClick={close} disabled={busy}>Cancel</button><button className="bop-btn bop-btn-primary" disabled={busy} onClick={() => run(() => operatorApi.post(`/trips/${tripId}/delay`, { delayMinutes, note: delay.note.trim() }), (r) => (r?.notified ? `Delay saved. ${r.notified} passenger${r.notified === 1 ? "" : "s"} notified.` : "Delay saved"))}>{busy ? "Saving…" : delayMinutes ? "Notify passengers" : "Clear delay"}</button></>}>
          <div className="bop-form">
            <div className="bop-chips">{QUICK_DELAYS.map((m) => <button key={m} type="button" className={`bop-chip ${Number(delay.minutes) === m ? "is-on" : ""}`} onClick={() => setDelay({ ...delay, minutes: String(m) })}>{m >= 60 ? `${m / 60 === 1 ? "1 hour" : `${m / 60} hours`}` : `${m} min`}</button>)}</div>
            <Field label="Delay in minutes" hint={delayMinutes ? `New departure: ${eatTime(new Date(new Date(t.departureAt).getTime() + delayMinutes * 60000))}` : "Set 0 to clear the delay."}><input className="bop-input bop-narrow" type="number" min="0" max="720" value={delay.minutes} onChange={(e) => setDelay({ ...delay, minutes: e.target.value })} /></Field>
            <Field label="Message to passengers (optional)"><textarea className="bop-textarea" rows={3} maxLength={300} placeholder="e.g. The bus is stuck in traffic at Mukono." value={delay.note} onChange={(e) => setDelay({ ...delay, note: e.target.value })} /></Field>
            {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
          </div>
        </Modal>
      ) : null}

      {dialog === "cancel" ? (
        <Confirm title="Cancel this trip?" danger confirmLabel="Cancel trip" cancelLabel="Keep the trip" busy={busy} error={error ? new Error(error) : null} onCancel={close}
          onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/cancel`, { reason: reason.trim() }), (r) => `Trip cancelled. ${r?.notified || 0} passenger${r?.notified === 1 ? "" : "s"} emailed.`)}>
          <p>All {active.length} ticket{active.length === 1 ? "" : "s"} for this trip will be cancelled and passengers will be emailed. Their bookings are flagged for a refund and the takings are taken off your balance. This can’t be undone.</p>
          <Field label="Reason (shown to passengers)"><textarea className="bop-textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The bus broke down" /></Field>
        </Confirm>
      ) : null}

      {dialog === "depart" ? (
        <Confirm title="Mark as departed?" confirmLabel="Yes, it has left" cancelLabel="Not yet" busy={busy} error={error ? new Error(error) : null} onCancel={close} onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/status`, { status: "departed" }), "Marked as departed")}>
          <p>{checked} of {active.length} passengers are checked in. New bookings and delays will no longer be possible for this trip.</p>
        </Confirm>
      ) : null}
      {dialog === "complete" ? (
        <Confirm title="Mark as completed?" confirmLabel="Mark completed" cancelLabel="Not yet" busy={busy} error={error ? new Error(error) : null} onCancel={close} onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/status`, { status: "completed" }), "Marked as completed")}>
          <p>Use this once the bus has reached its destination.</p>
        </Confirm>
      ) : null}
    </>
  );
}
