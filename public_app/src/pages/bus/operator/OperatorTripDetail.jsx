import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { dayLabel, eatDate, eatTime, longDayLabel, operatorApi } from "../../../lib/bus";
import { Skel } from "../../../components/Skeleton";
import { Confirm, Empty, ErrorBox, Field, IconPrint, ListSkel, Modal, StatusChip, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";

const QUICK_DELAYS = [15, 30, 45, 60, 90, 120];

export default function OperatorTripDetail() {
  const { tripId } = useParams();
  const { operator, toast } = useOperator();
  const trip = useLoad(() => operatorApi.get(`/trips/${tripId}`), [tripId]);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState(null); // "delay" | "cancel" | "depart" | "complete"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [delay, setDelay] = useState({ minutes: "30", note: "" });
  const [reason, setReason] = useState("");
  const [rowBusy, setRowBusy] = useState("");

  const t = trip.data;
  const passengers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (t?.passengers || []).filter((p) => !needle || [p.passengerName, p.phone, p.ticketNumber, p.reference, String(p.seatNumber)].some((v) => String(v ?? "").toLowerCase().includes(needle)));
  }, [t, q]);

  const close = () => { if (!busy) { setDialog(null); setError(""); } };
  const run = async (fn, message) => {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      toast(typeof message === "function" ? message(res) : message);
      setDialog(null);
      await trip.reload();
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

  if (trip.loading) {
    return <div role="status" aria-busy="true"><Skel w="30%" h={14} /><Skel w="55%" h={30} style={{ marginTop: 14 }} /><div style={{ marginTop: 20 }}><ListSkel rows={5} h={56} /></div></div>;
  }
  if (trip.error || !t) {
    return <><Link to="/bus/operator/trips" className="bus-link">Back to trips</Link><div style={{ marginTop: 14 }}><ErrorBox error={trip.error || new Error("Trip not found")} onRetry={trip.refresh} /></div></>;
  }

  const active = t.passengers.filter((p) => p.status !== "cancelled");
  const checked = active.filter((p) => p.status === "used").length;
  const date = eatDate(t.departureAt);
  const upcoming = t.status === "scheduled";
  const delayMinutes = Math.max(0, Math.min(720, Number(delay.minutes) || 0));

  return (
    <>
      <div className="bus-breadcrumb bop-no-print"><Link to="/bus/operator/trips">Trips</Link><span>/</span><span>{dayLabel(date)}</span></div>

      <div className="bop-tripdetail-head">
        <div>
          <h1>{t.route.name}</h1>
          <p>{longDayLabel(date)} · {eatTime(t.departureAt)} EAT{t.delayMinutes ? ` (delayed ${t.delayMinutes} min)` : ""}</p>
          <div className="bop-chips"><StatusChip status={t.status} />{t.delayMinutes ? <span className="bus-chip bus-chip-amber">Delayed {t.delayMinutes} min</span> : null}<span className="bus-chip">{t.seatsTaken}/{t.seats} seats</span>{t.route.boardingPoint ? <span className="bus-chip">Boarding: {t.route.boardingPoint}</span> : null}</div>
          {t.note ? <p className="bop-note">Note: {t.note}</p> : null}
        </div>
        <div className="bop-pagehead-actions bop-no-print">
          <button className="bus-btn bus-btn-light" onClick={() => window.print()}><IconPrint width={18} height={18} /> Print manifest</button>
          {upcoming ? <button className="bus-btn bus-btn-light" onClick={() => { setDelay({ minutes: String(t.delayMinutes || 30), note: t.note || "" }); setDialog("delay"); }}>Report delay</button> : null}
          {upcoming ? <button className="bus-btn bus-btn-navy" onClick={() => setDialog("depart")}>Mark departed</button> : null}
          {t.status === "departed" ? <button className="bus-btn bus-btn-navy" onClick={() => setDialog("complete")}>Mark completed</button> : null}
          {upcoming ? <button className="bus-btn bus-btn-danger" onClick={() => setDialog("cancel")}>Cancel trip</button> : null}
        </div>
      </div>

      <div className="bop-kpis bop-kpis-3 bop-no-print">
        <div className="bus-card bop-kpi"><small>Passengers</small><strong>{active.length}</strong><span>{t.seats - t.seatsTaken} seats left</span></div>
        <div className="bus-card bop-kpi"><small>Checked in</small><strong>{checked}/{active.length}</strong><span>{active.length - checked} still to board</span></div>
        <div className="bus-card bop-kpi"><small>Fill rate</small><strong>{t.seats ? Math.round((t.seatsTaken / t.seats) * 100) : 0}%</strong><span>{t.seatsTaken} of {t.seats} seats</span></div>
      </div>

      <section className="bus-card bop-panel bop-manifest">
        <header className="bop-panel-head">
          <div><h2>Passenger manifest</h2><p className="bop-print-only">{operator.companyName} · {t.route.name} · {longDayLabel(date)} {eatTime(t.departureAt)}</p></div>
          <input className="bus-input bop-search bop-no-print" type="search" placeholder="Search name, phone, ticket" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search passengers" />
        </header>
        {t.passengers.length === 0 ? <Empty title="No passengers yet">Tickets booked for this trip will appear here.</Empty> : passengers.length === 0 ? <p className="bus-hint">No passengers match “{q}”.</p> : (
          <div className="bop-tablewrap">
            <table className="bop-table">
              <thead><tr><th>Seat</th><th>Passenger</th><th>Ticket</th><th>Phone</th><th>Status</th><th className="bop-no-print" /></tr></thead>
              <tbody>
                {passengers.map((p) => (
                  <tr key={p.id || p.ticketNumber} className={p.status === "cancelled" ? "is-muted" : ""}>
                    <td data-label="Seat"><span className="bop-seat">{p.seatNumber}</span></td>
                    <td data-label="Passenger"><strong>{p.passengerName}</strong><small>{p.ticketTypeName}</small></td>
                    <td data-label="Ticket"><code>{p.ticketNumber}</code><small>{p.reference}</small></td>
                    <td data-label="Phone">{p.phone}</td>
                    <td data-label="Status">{p.status === "used" ? <span className="bus-chip bus-chip-green">Checked in{p.checkedInAt ? ` ${eatTime(p.checkedInAt)}` : ""}</span> : p.status === "cancelled" ? <span className="bus-chip bus-chip-red">Cancelled</span> : <span className="bus-chip bus-chip-orange">Not boarded</span>}</td>
                    <td className="bop-no-print">{p.status === "valid" && t.status !== "cancelled" ? <button className="bus-btn bus-btn-light bus-btn-sm" disabled={rowBusy === p.ticketNumber} onClick={() => checkIn(p)}>{rowBusy === p.ticketNumber ? "…" : "Check in"}</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog === "delay" ? (
        <Modal title="Report a delay" subtitle="Passengers with a ticket for this trip are emailed straight away." onClose={close}
          footer={<><button className="bus-btn bus-btn-light" onClick={close} disabled={busy}>Cancel</button><button className="bus-btn bus-btn-primary" disabled={busy} onClick={() => run(() => operatorApi.post(`/trips/${tripId}/delay`, { delayMinutes, note: delay.note.trim() }), (r) => (r?.notified ? `Delay saved. ${r.notified} passenger${r.notified === 1 ? "" : "s"} notified.` : "Delay saved"))}>{busy ? "Saving…" : delayMinutes ? "Notify passengers" : "Clear delay"}</button></>}>
          <div className="bop-form">
            <div className="bop-chips">{QUICK_DELAYS.map((m) => <button key={m} type="button" className={`bus-chip ${Number(delay.minutes) === m ? "is-active" : ""}`} onClick={() => setDelay({ ...delay, minutes: String(m) })}>{m >= 60 ? `${m / 60 === 1 ? "1 hour" : `${m / 60} hours`}` : `${m} min`}</button>)}</div>
            <Field label="Delay in minutes" hint="Set 0 to clear the delay."><input className="bus-input bop-narrow" type="number" min="0" max="720" value={delay.minutes} onChange={(e) => setDelay({ ...delay, minutes: e.target.value })} /></Field>
            <Field label="Message to passengers (optional)"><textarea className="bus-textarea" rows={3} maxLength={300} placeholder="e.g. The bus is stuck in traffic at Mukono." value={delay.note} onChange={(e) => setDelay({ ...delay, note: e.target.value })} /></Field>
            {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
          </div>
        </Modal>
      ) : null}

      {dialog === "cancel" ? (
        <Confirm title="Cancel this trip?" danger confirmLabel="Cancel trip" cancelLabel="Keep the trip" busy={busy} error={error ? new Error(error) : null} onCancel={close}
          onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/cancel`, { reason: reason.trim() }), (r) => `Trip cancelled. ${r?.notified || 0} passenger${r?.notified === 1 ? "" : "s"} emailed.`)}>
          <p>All {active.length} ticket{active.length === 1 ? "" : "s"} for this trip will be cancelled and passengers will be emailed. Their bookings are flagged for a refund and the takings are taken off your balance. This can’t be undone.</p>
          <Field label="Reason (shown to passengers)" className="bop-mt"><textarea className="bus-textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The bus broke down" /></Field>
        </Confirm>
      ) : null}

      {dialog === "depart" ? (
        <Confirm title="Mark as departed?" confirmLabel="Yes, it has left" cancelLabel="Not yet" busy={busy} error={error ? new Error(error) : null} onCancel={close} onConfirm={() => run(() => operatorApi.post(`/trips/${tripId}/status`, { status: "departed" }), "Marked as departed")}>
          <p>New bookings and delays will no longer be possible for this trip.</p>
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
