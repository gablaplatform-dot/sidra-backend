import React, { useState } from "react";

import { addDays, dayLabel, eatDate, eatDateTimeLabel, eatTime, operatorApi, todayEat } from "../../../lib/bus";
import { Avatar, Chip, Confirm, Empty, ErrorBox, Field, PageHead, Panel, Skel, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcCheck, IcMail, IcMegaphone, IcUsers } from "../../../components/bus/operator/icons";
import { timeAgo, useNow } from "../../../components/bus/operator/util";

const AUDIENCES = [
  ["all", "Everyone who has travelled with us", "Every customer with a paid order"],
  ["upcoming", "Customers with an upcoming trip", "Only people who still have a trip to take"],
  ["trip", "Passengers of one trip", "Everyone booked on a specific departure"]
];
const KIND = {
  promotion: { label: "Promotion", tone: "orange" },
  notice: { label: "Notice", tone: "blue" },
  cancellation: { label: "Cancellation", tone: "red" },
  delay: { label: "Delay", tone: "amber" }
};

function EmailPreview({ operator, form, trip }) {
  const kind = KIND[form.kind] || KIND.notice;
  const paragraphs = (form.message.trim() ? form.message : "Your message appears here, exactly as passengers will read it.").split(/\n+/);
  return (
    <div className="bop-email" aria-label="Email preview">
      <div className="bop-email-bar"><i /><i /><i /><span>Inbox · {operator.companyName}</span></div>
      <div className="bop-email-head">
        <Avatar name={operator.companyName} src={operator.logoUrl} size={44} square />
        <div><strong>{operator.companyName}</strong><small>via Gabla Bus</small></div>
        <Chip tone={kind.tone}>{kind.label}</Chip>
      </div>
      <div className="bop-email-body">
        <h3 className={form.title.trim() ? "" : "is-placeholder"}>{form.title.trim() || "Your title goes here"}</h3>
        {paragraphs.map((p, i) => <p key={i} className={form.message.trim() ? "" : "is-placeholder"}>{p}</p>)}
        {trip ? (
          <div className="bop-email-trip"><small>Your trip</small><strong>{trip.route.name}</strong><span>{dayLabel(eatDate(trip.departureAt))} · {eatTime(trip.departureAt)}</span></div>
        ) : null}
      </div>
      <div className="bop-email-foot">Sent by {operator.companyName}. Questions? Reply to this email or call {operator.contactPhone || "us"}.</div>
    </div>
  );
}

export default function OperatorAnnouncements() {
  const { operator, toast } = useOperator();
  const now = useNow(60000);
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
  const chosenTrip = form.audience === "trip" ? tripItems.find((t) => t.id === form.tripId) : null;

  return (
    <>
      <PageHead sub="Email your customers about changes, offers or news." />
      <div className="bop-compose">
        <Panel title="New message" sub="Write it once. Everyone chosen below gets an email.">
          <div className="bop-form">
            <div className="bop-kinds" role="group" aria-label="Type of message">
              {[["notice", "Notice", "Changes and news", IcAlert], ["promotion", "Promotion", "Offers and discounts", IcMegaphone]].map(([v, l, d, Icon]) => (
                <button key={v} type="button" aria-pressed={form.kind === v} className={form.kind === v ? "is-on" : ""} onClick={() => set({ kind: v })}><span className={`bop-tile is-${v === "promotion" ? "orange" : "blue"}`}><Icon size={19} /></span><span><strong>{l}</strong><small>{d}</small></span></button>
              ))}
            </div>
            <Field label="Title"><input className="bop-input" maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.kind === "promotion" ? "20% off weekend trips" : "New boarding gate at the park"} /></Field>
            <Field label="Message" hint={`${form.message.length}/1500`}><textarea className="bop-textarea" rows={5} maxLength={1500} value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="Write what passengers need to know…" /></Field>
            <div className="bop-field">
              <span className="bop-field-label">Who should get it?</span>
              <div className="bop-radios">
                {AUDIENCES.map(([v, l, d]) => (
                  <label key={v} className={`bop-radio ${form.audience === v ? "is-on" : ""}`}>
                    <input type="radio" name="audience" checked={form.audience === v} onChange={() => set({ audience: v })} />
                    <span className="bop-radio-dot" aria-hidden="true" />
                    <span><strong>{l}</strong><small>{d}</small></span>
                  </label>
                ))}
              </div>
            </div>
            {form.audience === "trip" ? (
              <Field label="Trip">
                <select className="bop-select" value={form.tripId} onChange={(e) => set({ tripId: e.target.value })}>
                  <option value="">{trips.loading ? "Loading trips…" : "Choose a trip"}</option>
                  {tripItems.map((t) => <option key={t.id} value={t.id}>{dayLabel(eatDate(t.departureAt))} {eatTime(t.departureAt)} · {t.route.name} ({t.ticketsSold} tickets)</option>)}
                </select>
              </Field>
            ) : null}
            {error ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
            {sent ? <div className="bop-alert is-success" role="status"><IcCheck size={17} /><span>{sent}</span></div> : null}
            <button className="bop-btn bop-btn-primary bop-btn-lg" onClick={open}><IcMail size={19} /> Review and send</button>
          </div>
        </Panel>

        <aside className="bop-compose-preview">
          <div className="bop-preview-label"><IcMail size={16} /> Live email preview</div>
          <EmailPreview operator={operator} form={form} trip={chosenTrip} />
        </aside>
      </div>

      <Panel title="Sent messages" sub="Your last 50 announcements" className="bop-mt">
        <ErrorBox error={history.error} onRetry={history.refresh} />
        {history.loading ? (
          <div className="bop-timeline" role="status" aria-busy="true" aria-label="Loading messages">{[0, 1, 2].map((i) => <div className="bop-tl-item" key={i}><span className="bop-tl-dot" /><div style={{ display: "grid", gap: 8, flex: 1 }}><Skel w="30%" h={14} /><Skel w="80%" h={11} /></div></div>)}</div>
        ) : history.data?.items?.length ? (
          <ol className="bop-timeline">
            {history.data.items.map((a) => {
              const k = KIND[a.kind] || { label: a.kind, tone: "" };
              return (
                <li key={a.id} className={`bop-tl-item is-${k.tone || "grey"}`}>
                  <span className="bop-tl-dot" aria-hidden="true" />
                  <div className="bop-tl-body">
                    <div className="bop-tl-top"><strong>{a.title}</strong><span className="bop-tl-time" title={eatDateTimeLabel(a.createdAt)}>{timeAgo(a.createdAt, now)}</span></div>
                    <p>{a.message}</p>
                    <div className="bop-chips"><Chip tone={k.tone}>{k.label}</Chip><Chip tone="green"><IcUsers size={12} /> {a.recipients} sent</Chip></div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <Empty compact icon={<IcMegaphone size={24} />} title="Nothing sent yet">Your announcements will be listed here.</Empty>}
      </Panel>

      {confirm ? (
        <Confirm title="Send this message?" confirmLabel="Send now" cancelLabel="Edit message" busy={busy} onCancel={() => setConfirm(false)} onConfirm={send}>
          <p>“{form.title.trim()}” will be emailed to {AUDIENCES.find((a) => a[0] === form.audience)[1].toLowerCase()}{form.audience === "trip" ? " you chose" : ""}. Messages can’t be recalled once sent.</p>
        </Confirm>
      ) : null}
    </>
  );
}
