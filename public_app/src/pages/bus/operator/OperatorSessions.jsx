import React, { useMemo, useState } from "react";

import { dayLabel, operatorApi, todayEat } from "../../../lib/bus";
import { IconClockIcon } from "../../../components/icons";
import { ALL_DAYS, Confirm, DayChips, Empty, ErrorBox, Field, IconEdit, IconPause, IconPlay, IconPlus, ListSkel, Modal, PageHead, StatusChip, daysLabel, errMsg, timeLabel, useLoad, useOperator } from "../../../components/bus/operator/ui";

function SessionModal({ session, routes, onClose, onSaved }) {
  const { toast } = useOperator();
  const editing = Boolean(session);
  const active = routes.filter((r) => r.isActive || r.id === session?.routeId);
  const [f, setF] = useState(() => ({
    routeId: session?.routeId || active[0]?.id || "",
    departureTime: session?.departureTime || "08:00",
    name: session?.name || "",
    daysOfWeek: session?.daysOfWeek || ALL_DAYS,
    seats: session?.seats ? String(session.seats) : "",
    startDate: session?.startDate || todayEat(),
    endDate: session?.endDate || ""
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const save = async () => {
    if (!f.routeId) return setError("Choose a route.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.departureTime)) return setError("Choose a departure time.");
    if (!f.daysOfWeek.length) return setError("Pick at least one day of the week.");
    if (f.endDate && f.endDate < f.startDate) return setError("The end date can’t be before the start date.");
    setBusy(true);
    setError("");
    try {
      const body = {
        departureTime: f.departureTime,
        daysOfWeek: f.daysOfWeek,
        name: f.name.trim(),
        startDate: f.startDate,
        ...(f.seats ? { seats: Number(f.seats) } : {}),
        ...(editing ? { endDate: f.endDate || null } : f.endDate ? { endDate: f.endDate } : {})
      };
      if (editing) await operatorApi.patch(`/schedules/${session.id}`, body);
      else await operatorApi.post("/schedules", { routeId: f.routeId, ...body });
      toast(editing ? "Session updated" : "Session added. Trips will appear for the coming weeks.");
      onSaved();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await operatorApi.del(`/schedules/${session.id}`);
      toast("Session stopped");
      onSaved();
    } catch (e) {
      setError(errMsg(e));
      setConfirmRemove(false);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit session" : "Add a session"} subtitle="A session is a departure that repeats on the days you choose." onClose={busy ? () => {} : onClose}
      footer={<>
        {editing ? <button className="bus-btn bop-linkbtn bop-push-left" onClick={() => setConfirmRemove(true)} disabled={busy}>Stop session</button> : null}
        <button className="bus-btn bus-btn-light" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="bus-btn bus-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add session"}</button>
      </>}>
      <div className="bop-form">
        <Field label="Route">
          <select className="bus-select" value={f.routeId} onChange={(e) => set({ routeId: e.target.value })} disabled={editing}>
            {active.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="bop-grid2">
          <Field label="Departure time (EAT)"><input className="bus-input" type="time" value={f.departureTime} onChange={(e) => set({ departureTime: e.target.value })} /></Field>
          <Field label="Label (optional)"><input className="bus-input" placeholder="Morning bus" maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        </div>
        <div className="bus-field"><span>Runs on</span><DayChips value={f.daysOfWeek} onChange={(d) => set({ daysOfWeek: d })} /></div>
        <div className="bop-grid3">
          <Field label="Seats (optional)" hint="Defaults to the bus type"><input className="bus-input" type="number" min="1" max="120" inputMode="numeric" value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
          <Field label="Starts"><input className="bus-input" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label="Ends (optional)"><input className="bus-input" type="date" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        </div>
        {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
      </div>
      {confirmRemove ? (
        <Confirm title="Stop this session?" danger confirmLabel="Stop session" busy={busy} onCancel={() => setConfirmRemove(false)} onConfirm={remove}>
          <p>No new trips will be created from it. Trips that already have bookings are kept, so those passengers can still travel. You can bring it back later by resuming it.</p>
        </Confirm>
      ) : null}
    </Modal>
  );
}

export default function OperatorSessions() {
  const { toast } = useOperator();
  const sessions = useLoad(() => operatorApi.get("/schedules"), []);
  const routes = useLoad(() => operatorApi.get("/routes"), []);
  const [modal, setModal] = useState(null); // {session|null}
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const map = new Map();
    (sessions.data?.items || []).forEach((s) => {
      const g = map.get(s.routeId) || { route: s.route, items: [] };
      g.items.push(s);
      map.set(s.routeId, g);
    });
    return [...map.values()];
  }, [sessions.data]);

  const toggle = async (s) => {
    setBusyId(s.id);
    setError("");
    try {
      await operatorApi.patch(`/schedules/${s.id}`, { isActive: !s.isActive });
      toast(s.isActive ? "Session paused" : "Session resumed");
      await sessions.reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <PageHead title="Sessions" sub="Repeating departures. Set them once and trips are created for you." actions={<button className="bus-btn bus-btn-primary" onClick={() => setModal({ session: null })}><IconPlus width={18} height={18} /> Add session</button>} />
      <ErrorBox error={sessions.error || (error ? new Error(error) : null)} onRetry={sessions.error ? sessions.refresh : undefined} className="bop-mb" />
      {sessions.loading ? <ListSkel rows={4} h={86} /> : groups.length ? groups.map((g) => (
        <section key={g.route?.id || g.items[0].routeId} className="bop-group">
          <h2>{g.route?.name || "Route"}</h2>
          <div className="bop-stack">
            {g.items.map((s) => (
              <article key={s.id} className={`bus-card bop-session ${s.isActive ? "" : "is-paused"}`}>
                <div className="bop-session-time"><strong>{timeLabel(s.departureTime)}</strong>{s.name ? <small>{s.name}</small> : null}</div>
                <div className="bop-session-main">
                  <DayChips value={s.daysOfWeek} readOnly onChange={() => {}} />
                  <small>{daysLabel(s.daysOfWeek)} · {s.seats} seats · from {dayLabel(s.startDate)}{s.endDate ? ` until ${dayLabel(s.endDate)}` : ""}</small>
                </div>
                <div className="bop-session-actions">
                  <StatusChip status={s.isActive ? "active" : "paused"} />
                  <button className="bop-icon-btn" onClick={() => toggle(s)} disabled={busyId === s.id} aria-label={s.isActive ? "Pause session" : "Resume session"} title={s.isActive ? "Pause" : "Resume"}>{s.isActive ? <IconPause /> : <IconPlay />}</button>
                  <button className="bop-icon-btn" onClick={() => setModal({ session: s })} aria-label="Edit session" title="Edit"><IconEdit /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )) : <Empty icon={<IconClockIcon width={28} height={28} />} title="No sessions yet" action={<button className="bus-btn bus-btn-primary" onClick={() => setModal({ session: null })}>Add a session</button>}>A session creates trips automatically, for example “Kampala → Mbarara at 07:00 every day”.</Empty>}

      {modal ? <SessionModal session={modal.session} routes={routes.data?.items || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); sessions.reload(); }} /> : null}
    </>
  );
}
