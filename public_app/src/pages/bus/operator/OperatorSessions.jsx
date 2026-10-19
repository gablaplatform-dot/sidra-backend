import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { operatorApi, todayEat } from "../../../lib/bus";
import { ALL_DAYS, Chip, Confirm, DayChips, Empty, ErrorBox, Field, Modal, PageHead, Skel, Switch, daysLabel, errMsg, timeLabel, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcArrowRight, IcClock, IcEdit, IcPlus } from "../../../components/bus/operator/icons";
import { dayLabel } from "../../../components/bus/operator/util";

function SessionModal({ session, routes, onClose, onSaved }) {
  const { t } = useTranslation();
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
    if (!f.routeId) return setError(t("busOp.ses.chooseRoute"));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.departureTime)) return setError(t("busOp.ses.chooseTime"));
    if (!f.daysOfWeek.length) return setError(t("busOp.ses.pickDay"));
    if (f.endDate && f.endDate < f.startDate) return setError(t("busOp.ses.endBeforeStart"));
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
      toast(editing ? t("busOp.ses.updated") : t("busOp.ses.added"));
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
      toast(t("busOp.ses.stopped"));
      onSaved();
    } catch (e) {
      setError(errMsg(e));
      setConfirmRemove(false);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? t("busOp.ses.editTitle") : t("busOp.ses.addTitle")} subtitle={t("busOp.ses.modalSub")} onClose={busy ? () => {} : onClose}
      footer={<>
        {editing ? <button className="bop-btn bop-btn-light bop-push-left" onClick={() => setConfirmRemove(true)} disabled={busy}>{t("busOp.ses.stop")}</button> : null}
        <button className="bop-btn bop-btn-light" onClick={onClose} disabled={busy}>{t("busOp.common.cancel")}</button>
        <button className="bop-btn bop-btn-primary" onClick={save} disabled={busy}>{busy ? t("busOp.td.saving") : editing ? t("busOp.common.saveChanges") : t("busOp.ses.add")}</button>
      </>}>
      <div className="bop-form">
        <Field label={t("busOp.dash.colRoute")}>
          <select className="bop-select" value={f.routeId} onChange={(e) => set({ routeId: e.target.value })} disabled={editing}>
            {active.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <div className="bop-grid2">
          <Field label={t("busOp.ses.depTimeEat")}><input className="bop-input" type="time" value={f.departureTime} onChange={(e) => set({ departureTime: e.target.value })} /></Field>
          <Field label={t("busOp.ses.labelOpt")}><input className="bop-input" placeholder={t("busOp.ses.labelPh")} maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        </div>
        <div className="bop-field"><span className="bop-field-label">{t("busOp.ses.runsOn")}</span><DayChips value={f.daysOfWeek} onChange={(d) => set({ daysOfWeek: d })} /></div>
        <div className="bop-grid3">
          <Field label={t("busOp.trips.seatsOpt")} hint={t("busOp.ses.seatsHint")}><input className="bop-input" type="number" min="1" max="120" inputMode="numeric" value={f.seats} onChange={(e) => set({ seats: e.target.value })} /></Field>
          <Field label={t("busOp.ses.starts")}><input className="bop-input" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label={t("busOp.ses.endsOpt")}><input className="bop-input" type="date" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        </div>
        {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
      </div>
      {confirmRemove ? (
        <Confirm title={t("busOp.ses.stopTitle")} danger confirmLabel={t("busOp.ses.stop")} busy={busy} onCancel={() => setConfirmRemove(false)} onConfirm={remove}>
          <p>{t("busOp.ses.stopBody")}</p>
        </Confirm>
      ) : null}
    </Modal>
  );
}

function SessionCard({ s, busy, onToggle, onEdit }) {
  const { t } = useTranslation();
  const [clock, mer] = timeLabel(s.departureTime).split(" ");
  return (
    <article className={`bop-card bop-session ${s.isActive ? "" : "is-paused"}`}>
      <div className="bop-session-time"><strong>{clock}<small>{mer}</small></strong>{s.name ? <span>{s.name}</span> : null}</div>
      <div className="bop-session-main">
        <DayChips value={s.daysOfWeek} readOnly />
        <small>{daysLabel(s.daysOfWeek)} · {t("busOp.dash.seats", { count: Number(s.seats) || 0 })}</small>
        <small>{s.endDate ? t("busOp.ses.fromUntil", { from: dayLabel(s.startDate), to: dayLabel(s.endDate) }) : t("busOp.ses.from", { from: dayLabel(s.startDate) })}</small>
      </div>
      <div className="bop-session-actions">
        <label className="bop-session-switch"><span>{s.isActive ? t("busOp.ui.st.active") : t("busOp.ui.st.paused")}</span><Switch checked={s.isActive} busy={busy} onChange={() => onToggle(s)} label={s.isActive ? t("busOp.ses.pause") : t("busOp.ses.resume")} /></label>
        <button className="bop-icon-btn is-sm" onClick={() => onEdit(s)} aria-label={t("busOp.ses.editTitle")} title={t("busOp.ob.edit")}><IcEdit size={17} /></button>
      </div>
    </article>
  );
}

export default function OperatorSessions() {
  const { t } = useTranslation();
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
      toast(s.isActive ? t("busOp.ses.paused") : t("busOp.ses.resumed"));
      await sessions.reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId("");
    }
  };

  return (
    <>
      <PageHead sub={t("busOp.ses.sub")} actions={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ session: null })}><IcPlus size={18} /> {t("busOp.ses.add")}</button>} />
      {all.length ? <div className="bop-chips bop-mb"><Chip tone="green" dot>{t("busOp.ses.nActive", { n: activeCount })}</Chip>{all.length - activeCount ? <Chip tone="amber" dot>{t("busOp.ses.nPaused", { n: all.length - activeCount })}</Chip> : null}<Chip>{t("busOp.ses.nRoutes", { count: groups.length })}</Chip></div> : null}
      <ErrorBox error={sessions.error || (error ? new Error(error) : null)} onRetry={sessions.error ? sessions.refresh : undefined} className="bop-mb" />
      {sessions.loading ? (
        <div className="bop-group" role="status" aria-busy="true" aria-label={t("busOp.ses.loading")}><Skel w={200} h={18} /><div className="bop-session-grid" style={{ marginTop: 14 }}>{[0, 1, 2, 3].map((i) => <div className="bop-card bop-session" key={i}><Skel w={70} h={34} /><div style={{ display: "grid", gap: 8 }}><Skel w="80%" h={20} /><Skel w="50%" h={11} /></div><Skel w={48} h={28} r={999} /></div>)}</div></div>
      ) : groups.length ? groups.map((g) => (
        <section key={g.route?.id || g.items[0].routeId} className="bop-group">
          <h2 className="bop-group-title">{g.route?.originName && g.route?.destinationName ? <>{g.route.originName}<IcArrowRight size={16} />{g.route.destinationName}</> : g.route?.name || t("busOp.dash.colRoute")}<Chip>{t("busOp.ses.nDepartures", { count: g.items.length })}</Chip></h2>
          <div className="bop-session-grid">
            {g.items.map((s) => <SessionCard key={s.id} s={s} busy={busyId === s.id} onToggle={toggle} onEdit={(x) => setModal({ session: x })} />)}
          </div>
        </section>
      )) : <Empty icon={<IcClock size={28} />} title={t("busOp.ses.empty")} action={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ session: null })}><IcPlus size={17} /> {t("busOp.ses.addTitle")}</button>}>{t("busOp.ses.emptyHint")}</Empty>}

      {modal ? <SessionModal session={modal.session} routes={routes.data?.items || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); sessions.reload(); }} /> : null}
    </>
  );
}
