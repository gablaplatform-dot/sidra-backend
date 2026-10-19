import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { operatorApi, ugx } from "../../../lib/bus";
import RouteForm, { PriceInput, emptyRoute, routeFromApi, routePayload, validateRoute } from "../../../components/bus/operator/RouteForm";
import { Chip, Confirm, Empty, ErrorBox, Modal, PageHead, Skel, Switch, daysLabel, errMsg, timeLabel, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcBus, IcClock, IcEdit, IcPause, IcPin, IcPlay, IcPlus, IcRoute, IcTicket, IcTrash } from "../../../components/bus/operator/icons";
import { durationLabel } from "../../../components/bus/operator/util";

function RouteModal({ route, busTypes, onClose, onSaved }) {
  const { t } = useTranslation();
  const { toast } = useOperator();
  const editing = Boolean(route);
  const [value, setValue] = useState(() => (route ? routeFromApi(route) : emptyRoute()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const msg = validateRoute(value, { full: !editing });
    if (msg) return setError(msg);
    setBusy(true);
    setError("");
    try {
      if (editing) await operatorApi.patch(`/routes/${route.id}`, routePayload(value, { full: false }));
      else await operatorApi.post("/routes", routePayload(value));
      toast(editing ? t("busOp.rt.updated") : t("busOp.rt.added"));
      onSaved();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? t("busOp.rt.editTitle") : t("busOp.rt.addTitle")} subtitle={editing ? t("busOp.rt.editSub") : undefined} size="lg" onClose={busy ? () => {} : onClose}
      footer={<><button className="bop-btn bop-btn-light" onClick={onClose} disabled={busy}>{t("busOp.common.cancel")}</button><button className="bop-btn bop-btn-primary" onClick={save} disabled={busy}>{busy ? t("busOp.td.saving") : editing ? t("busOp.common.saveChanges") : t("busOp.rt.add")}</button></>}>
      <RouteForm value={value} onChange={(v) => { setValue(v); setError(""); }} busTypes={busTypes} full={!editing} />
      {error ? <div className="bop-alert is-error bop-mt" role="alert"><span>{error}</span></div> : null}
    </Modal>
  );
}

function TicketRow({ type, onChanged, onError }) {
  const { t } = useTranslation();
  const { toast } = useOperator();
  const [name, setName] = useState(type.name);
  const [price, setPrice] = useState(String(Math.round(Number(type.price))));
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const dirty = name.trim() !== type.name || Number(price) !== Math.round(Number(type.price));

  const patch = async (body, msg) => {
    setBusy(true);
    onError("");
    try {
      await operatorApi.patch(`/ticket-types/${type.id}`, body);
      if (msg) toast(msg);
      await onChanged();
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await operatorApi.del(`/ticket-types/${type.id}`);
      toast(t("busOp.rt.typeRemoved"));
      await onChanged();
    } catch (e) {
      onError(errMsg(e));
      setConfirmDel(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bop-rowline bop-tt ${type.isActive ? "" : "is-off"}`}>
      <input className="bop-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t("busOp.rt.ticketName")} />
      <PriceInput value={price} onChange={setPrice} aria-label={t("busOp.rt.price")} />
      <div className="bop-tt-actions">
        {dirty ? <button className="bop-btn bop-btn-primary bop-btn-sm" disabled={busy || !name.trim() || price === ""} onClick={() => patch({ name: name.trim(), price: Number(price) }, t("busOp.rt.saved"))}>{t("busOp.common.save")}</button> : null}
        <button className="bop-icon-btn" disabled={busy} onClick={() => patch({ isActive: !type.isActive }, type.isActive ? t("busOp.rt.stoppedSelling") : t("busOp.rt.onSaleAgain"))} aria-label={type.isActive ? t("busOp.rt.stopSelling") : t("busOp.rt.sellAgain")} title={type.isActive ? t("busOp.rt.onSaleTip") : t("busOp.rt.offSaleTip")}>{type.isActive ? <IcPause size={18} /> : <IcPlay size={18} />}</button>
        <button className="bop-icon-btn is-danger" disabled={busy} onClick={() => setConfirmDel(true)} aria-label={t("busOp.rt.deleteType")}><IcTrash size={18} /></button>
      </div>
      {confirmDel ? <Confirm title={t("busOp.rt.deleteTitle", { name: type.name })} danger confirmLabel={t("busOp.common.delete")} busy={busy} onCancel={() => setConfirmDel(false)} onConfirm={remove}><p>{t("busOp.rt.deleteBody")}</p></Confirm> : null}
    </div>
  );
}

function PricesModal({ routeId, routes, onClose, reload }) {
  const { t } = useTranslation();
  const { toast } = useOperator();
  const route = routes.find((r) => r.id === routeId);
  const [error, setError] = useState("");
  const [add, setAdd] = useState({ name: "", price: "" });
  const [busy, setBusy] = useState(false);

  if (!route) return null;
  const addType = async () => {
    if (!add.name.trim() || add.price === "") return setError(t("busOp.rt.newNeedsBoth"));
    setBusy(true);
    setError("");
    try {
      await operatorApi.post(`/routes/${route.id}/ticket-types`, { name: add.name.trim(), price: Number(add.price) });
      toast(t("busOp.rt.typeAdded"));
      setAdd({ name: "", price: "" });
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t("busOp.rt.prices")} subtitle={route.name} onClose={onClose} footer={<button className="bop-btn bop-btn-primary" onClick={onClose}>{t("busOp.common.done")}</button>}>
      <div className="bop-form">
        {route.ticketTypes.length ? route.ticketTypes.map((tt) => <TicketRow key={tt.id} type={tt} onChanged={reload} onError={setError} />) : <p className="bop-hint">{t("busOp.rt.noTypes")}</p>}
        <div className="bop-subsection">
          <div className="bop-subhead"><div><h3>{t("busOp.rt.addType")}</h3></div></div>
          <div className="bop-rowline">
            <input className="bop-input" placeholder={t("busOp.rt.newPh")} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} maxLength={60} aria-label={t("busOp.rt.newName")} />
            <PriceInput value={add.price} onChange={(price) => setAdd({ ...add, price })} aria-label={t("busOp.rt.newPrice")} />
            <button className="bop-btn bop-btn-light bop-btn-sm" onClick={addType} disabled={busy}><IcPlus size={16} /> {t("busOp.rt.addShort")}</button>
          </div>
        </div>
        {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
      </div>
    </Modal>
  );
}

function RouteCard({ route: r, sessions, onPrices, onEdit, onToggle }) {
  const { t } = useTranslation();
  const prices = r.ticketTypes.filter((tt) => tt.isActive).map((tt) => Number(tt.price));
  const from = prices.length ? Math.min(...prices) : null;
  return (
    <article className={`bop-card bop-route ${r.isActive ? "" : "is-paused"}`}>
      <header className="bop-route-head">
        <div className="bop-route-title">
          <h3>{r.name}</h3>
          <p>{r.busType ? <><IcBus size={14} />{r.busType.name} · </> : null}{durationLabel(r.durationMinutes)}</p>
        </div>
        <label className="bop-route-switch">
          <span className={r.isActive ? "is-live" : ""}>{r.isActive ? t("busOp.rt.live") : t("busOp.ui.st.paused")}</span>
          <Switch checked={r.isActive} onChange={() => onToggle(r)} label={r.isActive ? t("busOp.rt.pauseX", { name: r.name }) : t("busOp.rt.resumeX", { name: r.name })} />
        </label>
      </header>

      <div className="bop-ab">
        <div className="bop-ab-stop"><i /><small>{t("busOp.route.from")}</small><strong>{r.originName}</strong></div>
        <div className="bop-ab-line" aria-hidden="true"><span /><b><IcBus size={15} /></b><em>{durationLabel(r.durationMinutes)}</em><span /></div>
        <div className="bop-ab-stop is-end"><i /><small>{t("busOp.route.to")}</small><strong>{r.destinationName}</strong></div>
      </div>

      <ol className="bop-stops">
        <li><span><IcPin size={14} /></span><div><small>{t("busOp.route.boarding")}</small><strong>{r.boardingPoint || t("busOp.td.notSet")}</strong></div></li>
        <li><span><IcPin size={14} /></span><div><small>{t("busOp.rt.dropoff")}</small><strong>{r.dropoffPoint || t("busOp.td.notSet")}</strong></div></li>
      </ol>

      <div className="bop-route-block">
        <h4><IcTicket size={14} /> {t("busOp.rt.tickets")}{from !== null ? <em>{t("busOp.rt.fromPrice", { price: ugx(from) })}</em> : null}</h4>
        <div className="bop-chips">
          {r.ticketTypes.length ? r.ticketTypes.map((tt) => <Chip key={tt.id} tone={tt.isActive ? "orange" : "outline"}>{tt.name} · {ugx(tt.price)}{tt.isActive ? "" : ` (${t("busOp.rt.off")})`}</Chip>) : <Chip tone="red">{t("busOp.rt.noTypesChip")}</Chip>}
        </div>
      </div>

      <div className="bop-route-block">
        <h4><IcClock size={14} /> {t("busOp.nav.sessions")}</h4>
        <div className="bop-chips">
          {sessions.length ? sessions.map((s) => <Link key={s.id} to="/bus/operator/sessions" className={`bop-chip bop-sess-chip ${s.isActive ? "" : "is-off"}`}><b>{timeLabel(s.departureTime)}</b> {daysLabel(s.daysOfWeek).toLowerCase()}</Link>) : <span className="bop-hint">{t("busOp.rt.noDepartures")} <Link to="/bus/operator/sessions" className="bop-textlink">{t("busOp.ses.addTitle")}</Link></span>}
        </div>
      </div>

      <footer className="bop-route-foot">
        <button className="bop-btn bop-btn-light bop-btn-sm" onClick={() => onPrices(r)}><IcTicket size={16} /> {t("busOp.rt.prices")}</button>
        <button className="bop-btn bop-btn-light bop-btn-sm" onClick={() => onEdit(r)}><IcEdit size={16} /> {t("busOp.ob.edit")}</button>
        <Link to="/bus/operator/sessions" className="bop-btn bop-btn-light bop-btn-sm"><IcClock size={16} /> {t("busOp.nav.sessions")} ({r._count?.schedules ?? sessions.length})</Link>
      </footer>
    </article>
  );
}

export default function OperatorRoutes() {
  const { t } = useTranslation();
  const { toast } = useOperator();
  const [search, setSearch] = useSearchParams();
  const routes = useLoad(() => operatorApi.get("/routes"), []);
  const sessions = useLoad(() => operatorApi.get("/schedules"), []);
  const types = useLoad(() => operatorApi.get("/types"), []);
  const [modal, setModal] = useState(search.get("new") === "1" ? { kind: "edit", route: null } : null);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const items = routes.data?.items || [];
  const byRoute = useMemo(() => {
    const m = new Map();
    (sessions.data?.items || []).forEach((s) => (m.get(s.routeId) || m.set(s.routeId, []).get(s.routeId)).push(s));
    return m;
  }, [sessions.data]);
  const closeModal = () => { setModal(null); if (search.get("new")) setSearch({}, { replace: true }); };

  const doToggle = async () => {
    setBusy(true);
    setToggleError("");
    try {
      await operatorApi.patch(`/routes/${toggle.id}`, { isActive: !toggle.isActive });
      toast(toggle.isActive ? t("busOp.rt.paused") : t("busOp.rt.liveAgain"));
      setToggle(null);
      await routes.reload();
    } catch (e) {
      setToggleError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead sub={t("busOp.rt.sub")} actions={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}><IcPlus size={18} /> {t("busOp.rt.add")}</button>} />
      <ErrorBox error={routes.error} onRetry={routes.refresh} />
      {routes.loading ? (
        <div className="bop-route-grid" role="status" aria-busy="true" aria-label={t("busOp.rt.loading")}>
          {[0, 1, 2, 3].map((i) => <div className="bop-card bop-route" key={i}><Skel w="55%" h={18} /><Skel h={60} r={14} style={{ marginTop: 18 }} /><Skel w="80%" h={12} style={{ marginTop: 18 }} /><Skel w="60%" h={26} r={999} style={{ marginTop: 14 }} /><Skel h={38} r={10} style={{ marginTop: 20 }} /></div>)}
        </div>
      ) : items.length ? (
        <div className="bop-route-grid">
          {items.map((r) => <RouteCard key={r.id} route={r} sessions={byRoute.get(r.id) || []} onPrices={(x) => setModal({ kind: "prices", id: x.id })} onEdit={(x) => setModal({ kind: "edit", route: x })} onToggle={(x) => { setToggleError(""); setToggle(x); }} />)}
        </div>
      ) : <Empty icon={<IcRoute size={28} />} title={t("busOp.rt.empty")} action={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}><IcPlus size={17} /> {t("busOp.rt.addFirst")}</button>}>{t("busOp.rt.emptyHint")}</Empty>}

      {modal?.kind === "edit" ? <RouteModal route={modal.route} busTypes={types.data?.items || []} onClose={closeModal} onSaved={() => { closeModal(); routes.reload(); sessions.reload(); }} /> : null}
      {modal?.kind === "prices" ? <PricesModal routeId={modal.id} routes={items} onClose={closeModal} reload={routes.reload} /> : null}
      {toggle ? (
        <Confirm title={toggle.isActive ? t("busOp.rt.pauseTitle", { name: toggle.name }) : t("busOp.rt.resumeTitle", { name: toggle.name })} confirmLabel={toggle.isActive ? t("busOp.rt.pauseRoute") : t("busOp.rt.resumeRoute")} danger={toggle.isActive} busy={busy} error={toggleError ? new Error(toggleError) : null} onCancel={() => setToggle(null)} onConfirm={doToggle}>
          <p>{toggle.isActive ? t("busOp.rt.pauseBody") : t("busOp.rt.resumeBody")}</p>
        </Confirm>
      ) : null}
    </>
  );
}
