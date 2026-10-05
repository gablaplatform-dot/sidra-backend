import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { durationLabel, operatorApi, ugx } from "../../../lib/bus";
import { IconBus, IconPin } from "../../../components/icons";
import RouteForm, { PriceInput, emptyRoute, routeFromApi, routePayload, validateRoute } from "../../../components/bus/operator/RouteForm";
import { Confirm, Empty, ErrorBox, IconEdit, IconPause, IconPlay, IconPlus, IconTrash, ListSkel, Modal, PageHead, StatusChip, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";

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
      footer={<><button className="bus-btn bus-btn-light" onClick={onClose} disabled={busy}>Cancel</button><button className="bus-btn bus-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add route"}</button></>}>
      <RouteForm value={value} onChange={setValue} busTypes={busTypes} full={!editing} />
      {error ? <div className="bus-alert bus-alert-error bop-mt" role="alert">{error}</div> : null}
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
      <input className="bus-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Ticket name" />
      <PriceInput value={price} onChange={setPrice} aria-label="Price" />
      <div className="bop-tt-actions">
        {dirty ? <button className="bus-btn bus-btn-primary bus-btn-sm" disabled={busy || !name.trim() || price === ""} onClick={() => patch({ name: name.trim(), price: Number(price) }, "Saved")}>Save</button> : null}
        <button className="bop-icon-btn" disabled={busy} onClick={() => patch({ isActive: !type.isActive }, type.isActive ? "Stopped selling this ticket" : "On sale again")} aria-label={type.isActive ? "Stop selling this ticket" : "Sell this ticket again"} title={type.isActive ? "On sale. Click to stop selling" : "Not on sale. Click to sell again"}>{type.isActive ? <IconPause /> : <IconPlay />}</button>
        <button className="bop-icon-btn is-danger" disabled={busy} onClick={() => setConfirmDel(true)} aria-label="Delete ticket type"><IconTrash /></button>
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
    <Modal title="Ticket prices" subtitle={route.name} onClose={onClose} footer={<button className="bus-btn bus-btn-primary" onClick={onClose}>Done</button>}>
      <div className="bop-form">
        {route.ticketTypes.length ? route.ticketTypes.map((t) => <TicketRow key={t.id} type={t} onChanged={reload} onError={setError} />) : <p className="bus-hint">No ticket types yet. Add your first below.</p>}
        <div className="bop-subsection">
          <div className="bop-subhead"><div><h3>Add a ticket type</h3></div></div>
          <div className="bop-rowline">
            <input className="bus-input" placeholder="e.g. VIP" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} maxLength={60} />
            <PriceInput value={add.price} onChange={(price) => setAdd({ ...add, price })} />
            <button className="bus-btn bus-btn-light bus-btn-sm" onClick={addType} disabled={busy}><IconPlus width={16} height={16} /> Add</button>
          </div>
        </div>
        {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
      </div>
    </Modal>
  );
}

export default function OperatorRoutes() {
  const { toast } = useOperator();
  const [search, setSearch] = useSearchParams();
  const routes = useLoad(() => operatorApi.get("/routes"), []);
  const types = useLoad(() => operatorApi.get("/types"), []);
  const [modal, setModal] = useState(search.get("new") === "1" ? { kind: "edit", route: null } : null);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const items = routes.data?.items || [];
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
      <PageHead title="Routes & prices" sub="Where your buses go and what tickets cost." actions={<button className="bus-btn bus-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}><IconPlus width={18} height={18} /> Add route</button>} />
      <ErrorBox error={routes.error} onRetry={routes.refresh} />
      {routes.loading ? <ListSkel rows={3} h={150} /> : items.length ? (
        <div className="bop-stack">
          {items.map((r) => (
            <article key={r.id} className={`bus-card bop-route ${r.isActive ? "" : "is-paused"}`}>
              <div className="bop-route-top">
                <div>
                  <h3>{r.name}</h3>
                  <p>{r.originName} → {r.destinationName} · {durationLabel(r.durationMinutes)}{r.busType ? ` · ${r.busType.name}` : ""}</p>
                </div>
                <StatusChip status={r.isActive ? "active" : "paused"} />
              </div>
              <div className="bop-route-points">
                <span><IconPin width={14} height={14} /> Boarding: {r.boardingPoint || "Not set"}</span>
                <span><IconPin width={14} height={14} /> Drop-off: {r.dropoffPoint || "Not set"}</span>
              </div>
              <div className="bop-chips">
                {r.ticketTypes.length ? r.ticketTypes.map((t) => <span key={t.id} className={`bus-chip ${t.isActive ? "bus-chip-orange" : ""}`}>{t.name}: {ugx(t.price)}{t.isActive ? "" : " (off)"}</span>) : <span className="bus-chip bus-chip-red">No ticket types, add prices</span>}
              </div>
              <div className="bop-route-actions">
                <button className="bus-btn bus-btn-light bus-btn-sm" onClick={() => setModal({ kind: "prices", id: r.id })}>Ticket prices</button>
                <button className="bus-btn bus-btn-light bus-btn-sm" onClick={() => setModal({ kind: "edit", route: r })}><IconEdit width={15} height={15} /> Edit</button>
                <Link to="/bus/operator/sessions" className="bus-btn bus-btn-light bus-btn-sm">Sessions ({r._count?.schedules ?? 0})</Link>
                <button className="bus-btn bus-btn-sm bop-linkbtn" onClick={() => { setToggleError(""); setToggle(r); }}>{r.isActive ? "Pause route" : "Resume route"}</button>
              </div>
            </article>
          ))}
        </div>
      ) : <Empty icon={<IconBus width={28} height={28} />} title="No routes yet" action={<button className="bus-btn bus-btn-primary" onClick={() => setModal({ kind: "edit", route: null })}>Add your first route</button>}>Add a route with ticket prices and departure times so passengers can book.</Empty>}

      {modal?.kind === "edit" ? <RouteModal route={modal.route} busTypes={types.data?.items || []} onClose={closeModal} onSaved={() => { closeModal(); routes.reload(); }} /> : null}
      {modal?.kind === "prices" ? <PricesModal routeId={modal.id} routes={items} onClose={closeModal} reload={routes.reload} /> : null}
      {toggle ? (
        <Confirm title={toggle.isActive ? `Pause “${toggle.name}”?` : `Resume “${toggle.name}”?`} confirmLabel={toggle.isActive ? "Pause route" : "Resume route"} danger={toggle.isActive} busy={busy} error={toggleError ? new Error(toggleError) : null} onCancel={() => setToggle(null)} onConfirm={doToggle}>
          <p>{toggle.isActive ? "Passengers won’t be able to find this route, and future trips with no bookings are removed. Trips that already have bookings stay." : "Passengers can find and book this route again."}</p>
        </Confirm>
      ) : null}
    </>
  );
}
