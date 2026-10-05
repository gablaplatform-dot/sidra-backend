import React, { useMemo, useState } from "react";

import { dayLabel, operatorApi, todayEat } from "../../../lib/bus";
import { ALL_DAYS, Chip, Confirm, DayChips, Empty, ErrorBox, Field, Modal, PageHead, Skel, Switch, daysLabel, errMsg, timeLabel, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcArrowRight, IcClock, IcEdit, IcPlus } from "../../../components/bus/operator/icons";

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
  const set = (patch) => { setF((s) => ({ ...s, ...patch })); setError(""); };

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
        {editing ? <button className="bop-btn bop-btn-light bop-push-left" onClick={() => setConfirmRemove(true)} disabled={busy}>Stop session</button> : null}
        <button className="bop-btn bop-btn-light" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="bop-btn bop-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add session"}</button>
      </>}>
      <div className="bop-form">
        <Field label="Route">
          <select className="bop-select" value={f.routeId} onChange={(e) => set({ routeId: e.target.value })} disabled={editing}>
            {active.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="bop-grid2">
          <Field label="Departure time (EAT)"><input className="bop-input" type="time" value={f.departureTime} onChange={(e) => set({ departureTime: e.target.value })} /></Field>
          <Field label="Label (optional)"><input className="bop-input" placeholder="Morning bus" maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        </div>
        <div className="bop-field"><span className="bop-field-label">Runs on</span><DayChips value={f.daysOfWeek} onChange={(d) => set({ daysOfWeek: d })} /></div>
        <div className="bop-grid3">
          <Field label="Seats (optional)" hint="Defaults to the bus type"><input className="bop-input" type="number" min="1" max="120" inputMode="numeric" value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
          <Field label="Starts"><input className="bop-input" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label="Ends (optional)"><input className="bop-input" type="date" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        </div>
        {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
      </div>
      {confirmRemove ? (
        <Confirm title="Stop this session?" danger confirmLabel="Stop session" busy={busy} onCancel={() => setConfirmRemove(false)} onConfirm={remove}>
          <p>No new trips will be created from it. Trips that already have bookings are kept, so those passengers can still travel. You can bring it back later by resuming it.</p>
        </Confirm>
      ) : null}
    </Modal>
  );
}

function SessionCard({ s, busy, onToggle, onEdit }) {
  const [clock, mer] = timeLabel(s.departureTime).split(" ");
  return (
    <article className={`bop-card bop-session ${s.isActive ? "" : "is-paused"}`}>
      <div className="bop-session-time"><strong>{clock}<small>{mer}</small></strong>{s.name ? <span>{s.name}</span> : null}</div>
      <div className="bop-session-main">
        <DayChips value={s.daysOfWeek} readOnly />
        <small>{daysLabel(s.daysOfWeek)} · {s.seats} seats</small>
        <small>From {dayLabel(s.startDate)}{s.endDate ? ` until ${dayLabel(s.endDate)}` : ""}</small>
      </div>
      <div className="bop-session-actions">
        <label className="bop-session-switch"><span>{s.isActive ? "Active" : "Paused"}</span><Switch checked={s.isActive} busy={busy} onChange={() => onToggle(s)} label={s.isActive ? "Pause session" : "Resume session"} /></label>
        <button className="bop-icon-btn is-sm" onClick={() => onEdit(s)} aria-label="Edit session" title="Edit"><IcEdit size={17} /></button>
      </div>
    </article>
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
    map.forEach((g) => g.items.sort((a, b) => String(a.departureTime).localeCompare(String(b.departureTime))));
    return [...map.values()];
  }, [sessions.data]);
  const all = sessions.data?.items || [];
  const activeCount = all.filter((s) => s.isActive).length;

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
      <PageHead sub="Repeating departures. Set them once and trips are created for you." actions={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ session: null })}><IcPlus size={18} /> Add session</button>} />
      {all.length ? <div className="bop-chips bop-mb"><Chip tone="green" dot>{activeCount} active</Chip>{all.length - activeCount ? <Chip tone="amber" dot>{all.length - activeCount} paused</Chip> : null}<Chip>{groups.length} route{groups.length === 1 ? "" : "s"}</Chip></div> : null}
      <ErrorBox error={sessions.error || (error ? new Error(error) : null)} onRetry={sessions.error ? sessions.refresh : undefined} className="bop-mb" />
      {sessions.loading ? (
        <div className="bop-group" role="status" aria-busy="true" aria-label="Loading sessions"><Skel w={200} h={18} /><div className="bop-session-grid" style={{ marginTop: 14 }}>{[0, 1, 2, 3].map((i) => <div className="bop-card bop-session" key={i}><Skel w={70} h={34} /><div style={{ display: "grid", gap: 8 }}><Skel w="80%" h={20} /><Skel w="50%" h={11} /></div><Skel w={48} h={28} r={999} /></div>)}</div></div>
      ) : groups.length ? groups.map((g) => (
        <section key={g.route?.id || g.items[0].routeId} className="bop-group">
          <h2 className="bop-group-title">{g.route?.originName && g.route?.destinationName ? <>{g.route.originName}<IcArrowRight size={16} />{g.route.destinationName}</> : g.route?.name || "Route"}<Chip>{g.items.length} departure{g.items.length === 1 ? "" : "s"}</Chip></h2>
          <div className="bop-session-grid">
            {g.items.map((s) => <SessionCard key={s.id} s={s} busy={busyId === s.id} onToggle={toggle} onEdit={(x) => setModal({ session: x })} />)}
          </div>
        </section>
      )) : <Empty icon={<IcClock size={28} />} title="No sessions yet" action={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ session: null })}><IcPlus size={17} /> Add a session</button>}>A session creates trips automatically, for example “Kampala → Mbarara at 07:00 every day”.</Empty>}

      {modal ? <SessionModal session={modal.session} routes={routes.data?.items || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); sessions.reload(); }} /> : null}
    </>
  );
}
