import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { durationLabel, operatorApi, ugx } from "../../../lib/bus";
import RouteForm, { PriceInput, emptyRoute, routeFromApi, routePayload, validateRoute } from "../../../components/bus/operator/RouteForm";
import { Chip, Confirm, Empty, ErrorBox, Modal, PageHead, Skel, Switch, daysLabel, errMsg, timeLabel, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcBus, IcClock, IcEdit, IcPause, IcPin, IcPlay, IcPlus, IcRoute, IcTicket, IcTrash } from "../../../components/bus/operator/icons";

function RouteModal({ route, busTypes, onClose, onSaved }) {
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
      toast(editing ? "Route updated" : "Route added. Trips are being created from its departure times.");
      onSaved();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit route" : "Add a route"} subtitle={editing ? "Change prices with “Ticket prices” and departure times under Sessions." : undefined} size="lg" onClose={busy ? () => {} : onClose}
      footer={<><button className="bop-btn bop-btn-light" onClick={onClose} disabled={busy}>Cancel</button><button className="bop-btn bop-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add route"}</button></>}>
      <RouteForm value={value} onChange={(v) => { setValue(v); setError(""); }} busTypes={busTypes} full={!editing} />
      {error ? <div className="bop-alert is-error bop-mt" role="alert"><span>{error}</span></div> : null}
    </Modal>
  );
}

function TicketRow({ type, onChanged, onError }) {
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
      toast("Ticket type removed");
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
      <input className="bop-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Ticket name" />
      <PriceInput value={price} onChange={setPrice} aria-label="Price" />
      <div className="bop-tt-actions">
        {dirty ? <button className="bop-btn bop-btn-primary bop-btn-sm" disabled={busy || !name.trim() || price === ""} onClick={() => patch({ name: name.trim(), price: Number(price) }, "Saved")}>Save</button> : null}
        <button className="bop-icon-btn" disabled={busy} onClick={() => patch({ isActive: !type.isActive }, type.isActive ? "Stopped selling this ticket" : "On sale again")} aria-label={type.isActive ? "Stop selling this ticket" : "Sell this ticket again"} title={type.isActive ? "On sale. Click to stop selling" : "Not on sale. Click to sell again"}>{type.isActive ? <IcPause size={18} /> : <IcPlay size={18} />}</button>
        <button className="bop-icon-btn is-danger" disabled={busy} onClick={() => setConfirmDel(true)} aria-label="Delete ticket type"><IcTrash size={18} /></button>
      </div>
      {confirmDel ? <Confirm title={`Delete “${type.name}”?`} danger confirmLabel="Delete" busy={busy} onCancel={() => setConfirmDel(false)} onConfirm={remove}><p>Passengers who already bought this ticket keep it. If it has been sold, you may prefer to stop selling it instead.</p></Confirm> : null}
    </div>
  );
}

function PricesModal({ routeId, routes, onClose, reload }) {
  const { toast } = useOperator();
  const route = routes.find((r) => r.id === routeId);
  const [error, setError] = useState("");
  const [add, setAdd] = useState({ name: "", price: "" });
  const [busy, setBusy] = useState(false);

  if (!route) return null;
  const addType = async () => {
    if (!add.name.trim() || add.price === "") return setError("Enter a name and a price for the new ticket.");
    setBusy(true);
    setError("");
    try {
      await operatorApi.post(`/routes/${route.id}/ticket-types`, { name: add.name.trim(), price: Number(add.price) });
      toast("Ticket type added");
      setAdd({ name: "", price: "" });
      await reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Ticket prices" subtitle={route.name} onClose={onClose} footer={<button className="bop-btn bop-btn-primary" onClick={onClose}>Done</button>}>
      <div className="bop-form">
        {route.ticketTypes.length ? route.ticketTypes.map((t) => <TicketRow key={t.id} type={t} onChanged={reload} onError={setError} />) : <p className="bop-hint">No ticket types yet. Add your first below.</p>}
        <div className="bop-subsection">
          <div className="bop-subhead"><div><h3>Add a ticket type</h3></div></div>
          <div className="bop-rowline">
            <input className="bop-input" placeholder="e.g. VIP" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} maxLength={60} aria-label="New ticket name" />
            <PriceInput value={add.price} onChange={(price) => setAdd({ ...add, price })} aria-label="New ticket price" />
            <button className="bop-btn bop-btn-light bop-btn-sm" onClick={addType} disabled={busy}><IcPlus size={16} /> Add</button>
          </div>
        </div>
        {error ? <div className="bop-alert is-error" role="alert"><span>{error}</span></div> : null}
      </div>
    </Modal>
  );
}

function RouteCard({ route: r, sessions, onPrices, onEdit, onToggle }) {
  const prices = r.ticketTypes.filter((t) => t.isActive).map((t) => Number(t.price));
  const from = prices.length ? Math.min(...prices) : null;
  return (
    <article className={`bop-card bop-route ${r.isActive ? "" : "is-paused"}`}>
      <header className="bop-route-head">
        <div className="bop-route-title">
          <h3>{r.name}</h3>
          <p>{r.busType ? <><IcBus size={14} />{r.busType.name} · </> : null}{durationLabel(r.durationMinutes)}</p>
        </div>
        <label className="bop-route-switch">
          <span className={r.isActive ? "is-live" : ""}>{r.isActive ? "Live" : "Paused"}</span>
          <Switch checked={r.isActive} onChange={() => onToggle(r)} label={r.isActive ? `Pause ${r.name}` : `Resume ${r.name}`} />
        </label>
      </header>

      <div className="bop-ab">
        <div className="bop-ab-stop"><i /><small>From</small><strong>{r.originName}</strong></div>
        <div className="bop-ab-line" aria-hidden="true"><span /><b><IcBus size={15} /></b><em>{durationLabel(r.durationMinutes)}</em><span /></div>
        <div className="bop-ab-stop is-end"><i /><small>To</small><strong>{r.destinationName}</strong></div>
      </div>

      <ol className="bop-stops">
        <li><span><IcPin size={14} /></span><div><small>Boarding point</small><strong>{r.boardingPoint || "Not set"}</strong></div></li>
        <li><span><IcPin size={14} /></span><div><small>Drop-off</small><strong>{r.dropoffPoint || "Not set"}</strong></div></li>
      </ol>

      <div className="bop-route-block">
        <h4><IcTicket size={14} /> Tickets{from !== null ? <em>from {ugx(from)}</em> : null}</h4>
        <div className="bop-chips">
          {r.ticketTypes.length ? r.ticketTypes.map((t) => <Chip key={t.id} tone={t.isActive ? "orange" : "outline"}>{t.name} · {ugx(t.price)}{t.isActive ? "" : " (off)"}</Chip>) : <Chip tone="red">No ticket types. Add prices</Chip>}
        </div>
      </div>

      <div className="bop-route-block">
        <h4><IcClock size={14} /> Sessions</h4>
        <div className="bop-chips">
          {sessions.length ? sessions.map((s) => <Link key={s.id} to="/bus/operator/sessions" className={`bop-chip bop-sess-chip ${s.isActive ? "" : "is-off"}`}><b>{timeLabel(s.departureTime)}</b> {daysLabel(s.daysOfWeek).toLowerCase()}</Link>) : <span className="bop-hint">No departures yet. <Link to="/bus/operator/sessions" className="bop-textlink">Add a session</Link></span>}
        </div>
      </div>

      <footer className="bop-route-foot">
        <button className="bop-btn bop-btn-light bop-btn-sm" onClick={() => onPrices(r)}><IcTicket size={16} /> Ticket prices</button>
        <button className="bop-btn bop-btn-light bop-btn-sm" onClick={() => onEdit(r)}><IcEdit size={16} /> Edit</button>
        <Link to="/bus/operator/sessions" className="bop-btn bop-btn-light bop-btn-sm"><IcClock size={16} /> Sessions ({r._count?.schedules ?? sessions.length})</Link>
      </footer>
    </article>
  );
}

export default function OperatorRoutes() {
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
      toast(toggle.isActive ? "Route paused" : "Route is live again");
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
      <PageHead sub="Where your buses go and what tickets cost." actions={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}><IcPlus size={18} /> Add route</button>} />
      <ErrorBox error={routes.error} onRetry={routes.refresh} />
      {routes.loading ? (
        <div className="bop-route-grid" role="status" aria-busy="true" aria-label="Loading routes">
          {[0, 1, 2, 3].map((i) => <div className="bop-card bop-route" key={i}><Skel w="55%" h={18} /><Skel h={60} r={14} style={{ marginTop: 18 }} /><Skel w="80%" h={12} style={{ marginTop: 18 }} /><Skel w="60%" h={26} r={999} style={{ marginTop: 14 }} /><Skel h={38} r={10} style={{ marginTop: 20 }} /></div>)}
        </div>
      ) : items.length ? (
        <div className="bop-route-grid">
          {items.map((r) => <RouteCard key={r.id} route={r} sessions={byRoute.get(r.id) || []} onPrices={(x) => setModal({ kind: "prices", id: x.id })} onEdit={(x) => setModal({ kind: "edit", route: x })} onToggle={(x) => { setToggleError(""); setToggle(x); }} />)}
        </div>
      ) : <Empty icon={<IcRoute size={28} />} title="No routes yet" action={<button className="bop-btn bop-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}><IcPlus size={17} /> Add your first route</button>}>Add a route with ticket prices and departure times so passengers can book.</Empty>}

      {modal?.kind === "edit" ? <RouteModal route={modal.route} busTypes={types.data?.items || []} onClose={closeModal} onSaved={() => { closeModal(); routes.reload(); sessions.reload(); }} /> : null}
      {modal?.kind === "prices" ? <PricesModal routeId={modal.id} routes={items} onClose={closeModal} reload={routes.reload} /> : null}
      {toggle ? (
        <Confirm title={toggle.isActive ? `Pause “${toggle.name}”?` : `Resume “${toggle.name}”?`} confirmLabel={toggle.isActive ? "Pause route" : "Resume route"} danger={toggle.isActive} busy={busy} error={toggleError ? new Error(toggleError) : null} onCancel={() => setToggle(null)} onConfirm={doToggle}>
          <p>{toggle.isActive ? "Passengers won’t be able to find this route, and future trips with no bookings are removed. Trips that already have bookings stay." : "Passengers can find and book this route again."}</p>
        </Confirm>
      ) : null}
    </>
  );
}
