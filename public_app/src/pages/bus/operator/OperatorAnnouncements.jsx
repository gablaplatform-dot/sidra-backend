import React, { useState } from "react";

import { addDays, dayLabel, eatDate, eatDateTimeLabel, eatTime, operatorApi, todayEat } from "../../../lib/bus";
import { IconChat } from "../../../components/icons";
import { Confirm, Empty, ErrorBox, Field, ListSkel, PageHead, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";

const AUDIENCES = [
  ["all", "Everyone who has travelled with us", "Every customer with a paid booking"],
  ["upcoming", "Customers with an upcoming trip", "Only people who still have a trip to take"],
  ["trip", "Passengers of one trip", "Everyone booked on a specific departure"]
];

export default function OperatorAnnouncements() {
  const { toast } = useOperator();
  const history = useLoad(() => operatorApi.get("/announcements"), []);
  const today = todayEat();
  const trips = useLoad(() => operatorApi.get("/trips", { from: today, to: addDays(today, 13), status: "scheduled" }), [today]);
  const [form, setForm] = useState({ kind: "notice", title: "", message: "", audience: "all", tripId: "" });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(""); setSent(""); };

  const validate = () => {
    if (form.title.trim().length < 2) return "Add a short title.";
    if (form.message.trim().length < 2) return "Write your message.";
    if (form.audience === "trip" && !form.tripId) return "Choose which trip to message.";
    return "";
  };
  const open = () => {
    const msg = validate();
    if (msg) return setError(msg);
    setConfirm(true);
  };
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { title: form.title.trim(), message: form.message.trim(), kind: form.kind, ...(form.audience === "trip" ? { audience: "all", tripId: form.tripId } : { audience: form.audience }) };
      const res = await operatorApi.post("/announcements", body);
      setSent(`Sent to ${res.recipients} customer${res.recipients === 1 ? "" : "s"}.`);
      toast(`Sent to ${res.recipients} customer${res.recipients === 1 ? "" : "s"}`);
      setForm({ kind: "notice", title: "", message: "", audience: "all", tripId: "" });
      setConfirm(false);
      history.reload();
    } catch (e) {
      setConfirm(false);
      setError(e.code === "BUS_NO_RECIPIENTS" ? "There’s nobody to send this to yet. Customers appear once they’ve paid for a ticket." : errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const tripItems = trips.data?.items || [];

  return (
    <>
      <PageHead title="Announcements" sub="Email your customers about changes, offers or news." />
      <div className="bop-two">
        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>New message</h2></div></header>
          <div className="bop-form">
            <div className="bop-seg bop-seg-wide" role="tablist" aria-label="Type of message">
              <button type="button" className={form.kind === "notice" ? "is-on" : ""} onClick={() => set({ kind: "notice" })}>Notice</button>
              <button type="button" className={form.kind === "promotion" ? "is-on" : ""} onClick={() => set({ kind: "promotion" })}>Promotion</button>
            </div>
            <Field label="Title"><input className="bus-input" maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.kind === "promotion" ? "20% off weekend trips" : "New boarding gate at the park"} /></Field>
            <Field label="Message" hint={`${form.message.length}/1500`}><textarea className="bus-textarea" rows={5} maxLength={1500} value={form.message} onChange={(e) => set({ message: e.target.value })} /></Field>
            <div className="bus-field">
              <span>Who should get it?</span>
              <div className="bop-radios">
                {AUDIENCES.map(([v, l, d]) => (
                  <label key={v} className={`bop-radio ${form.audience === v ? "is-on" : ""}`}>
                    <input type="radio" name="audience" checked={form.audience === v} onChange={() => set({ audience: v })} />
                    <span><strong>{l}</strong><small>{d}</small></span>
                  </label>
                ))}
              </div>
            </div>
            {form.audience === "trip" ? (
              <Field label="Trip">
                <select className="bus-select" value={form.tripId} onChange={(e) => set({ tripId: e.target.value })}>
                  <option value="">{trips.loading ? "Loading trips…" : "Choose a trip"}</option>
                  {tripItems.map((t) => <option key={t.id} value={t.id}>{dayLabel(eatDate(t.departureAt))} {eatTime(t.departureAt)} · {t.route.name} ({t.ticketsSold} tickets)</option>)}
                </select>
              </Field>
            ) : null}
            {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
            {sent ? <div className="bus-alert bus-alert-success" role="status">{sent}</div> : null}
            <button className="bus-btn bus-btn-primary" onClick={open}>Review and send</button>
          </div>
        </section>

        <section className="bus-card bop-panel">
          <header className="bop-panel-head"><div><h2>Sent messages</h2></div></header>
          <ErrorBox error={history.error} onRetry={history.refresh} />
          {history.loading ? <ListSkel rows={3} h={70} /> : history.data.items.length ? (
            <ul className="bop-list bop-history">
              {history.data.items.map((a) => (
                <li key={a.id}>
                  <div className="bop-hist-row">
                    <div className="bop-chips"><span className={`bus-chip ${a.kind === "promotion" ? "bus-chip-orange" : a.kind === "notice" ? "" : "bus-chip-amber"}`}>{a.kind === "promotion" ? "Promotion" : a.kind === "notice" ? "Notice" : a.kind}</span><span className="bus-chip bus-chip-green">{a.recipients} sent</span></div>
                    <strong>{a.title}</strong>
                    <p>{a.message}</p>
                    <small>{eatDateTimeLabel(a.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<IconChat width={26} height={26} />} title="Nothing sent yet">Your announcements will be listed here.</Empty>}
        </section>
      </div>

      {confirm ? (
        <Confirm title="Send this message?" confirmLabel="Send now" cancelLabel="Edit message" busy={busy} onCancel={() => setConfirm(false)} onConfirm={send}>
          <p>“{form.title.trim()}” will be emailed to {AUDIENCES.find((a) => a[0] === form.audience)[1].toLowerCase()}{form.audience === "trip" ? " you chose" : ""}. Messages can’t be recalled once sent.</p>
        </Confirm>
      ) : null}
    </>
  );
}
