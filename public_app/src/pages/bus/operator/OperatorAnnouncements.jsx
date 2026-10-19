import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { addDays, eatDate, eatTime, operatorApi, todayEat } from "../../../lib/bus";
import { Avatar, Chip, Confirm, Empty, ErrorBox, Field, PageHead, Panel, Skel, errMsg, useLoad, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcCheck, IcMail, IcMegaphone, IcUsers } from "../../../components/bus/operator/icons";
import { dateTimeLabel, dayLabel, timeAgo, useNow } from "../../../components/bus/operator/util";

// Labels live in busOp.ann.aud.<key>.{title,desc,confirm} and busOp.ann.kind.<key>.
const AUDIENCES = ["all", "upcoming", "trip"];
const KIND = {
  promotion: { tone: "orange" },
  notice: { tone: "blue" },
  cancellation: { tone: "red" },
  delay: { tone: "amber" }
};

function EmailPreview({ operator, form, trip }) {
  const { t } = useTranslation();
  const kind = KIND[form.kind] || KIND.notice;
  const paragraphs = (form.message.trim() ? form.message : t("busOp.ann.previewMessage")).split(/\n+/);
  return (
    <div className="bop-email" aria-label={t("busOp.ann.emailPreview")}>
      <div className="bop-email-bar"><i /><i /><i /><span>{t("busOp.ann.inbox")} · {operator.companyName}</span></div>
      <div className="bop-email-head">
        <Avatar name={operator.companyName} src={operator.logoUrl} size={44} square />
        <div><strong>{operator.companyName}</strong><small>{t("busOp.ann.viaGabla")}</small></div>
        <Chip tone={kind.tone}>{t(`busOp.ann.kind.${form.kind in KIND ? form.kind : "notice"}`)}</Chip>
      </div>
      <div className="bop-email-body">
        <h3 className={form.title.trim() ? "" : "is-placeholder"}>{form.title.trim() || t("busOp.ann.previewTitle")}</h3>
        {paragraphs.map((p, i) => <p key={i} className={form.message.trim() ? "" : "is-placeholder"}>{p}</p>)}
        {trip ? (
          <div className="bop-email-trip"><small>{t("busOp.ann.yourTrip")}</small><strong>{trip.route.name}</strong><span>{dayLabel(eatDate(trip.departureAt))} · {eatTime(trip.departureAt)}</span></div>
        ) : null}
      </div>
      <div className="bop-email-foot">{t("busOp.ann.footer", { company: operator.companyName, phone: operator.contactPhone || t("busOp.ann.us") })}</div>
    </div>
  );
}

export default function OperatorAnnouncements() {
  const { t } = useTranslation();
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
    if (form.title.trim().length < 2) return t("busOp.ann.vTitle");
    if (form.message.trim().length < 2) return t("busOp.ann.vMessage");
    if (form.audience === "trip" && !form.tripId) return t("busOp.ann.vTrip");
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
      setSent(t("busOp.ann.sentTo", { count: Number(res.recipients) || 0 }));
      toast(t("busOp.ann.sentTo", { count: Number(res.recipients) || 0 }));
      setForm({ kind: "notice", title: "", message: "", audience: "all", tripId: "" });
      setConfirm(false);
      history.reload();
    } catch (e) {
      setConfirm(false);
      setError(e.code === "BUS_NO_RECIPIENTS" ? t("busOp.ann.noRecipients") : errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const tripItems = trips.data?.items || [];
  const chosenTrip = form.audience === "trip" ? tripItems.find((x) => x.id === form.tripId) : null;

  return (
    <>
      <PageHead sub={t("busOp.ann.sub")} />
      <div className="bop-compose">
        <Panel title={t("busOp.ann.newMessage")} sub={t("busOp.ann.newMessageSub")}>
          <div className="bop-form">
            <div className="bop-kinds" role="group" aria-label={t("busOp.ann.typeOfMessage")}>
              {[["notice", IcAlert], ["promotion", IcMegaphone]].map(([v, Icon]) => (
                <button key={v} type="button" aria-pressed={form.kind === v} className={form.kind === v ? "is-on" : ""} onClick={() => set({ kind: v })}><span className={`bop-tile is-${v === "promotion" ? "orange" : "blue"}`}><Icon size={19} /></span><span><strong>{t(`busOp.ann.kind.${v}`)}</strong><small>{t(`busOp.ann.kindDesc.${v}`)}</small></span></button>
              ))}
            </div>
            <Field label={t("busOp.ann.title")}><input className="bop-input" maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.kind === "promotion" ? t("busOp.ann.titlePhPromo") : t("busOp.ann.titlePhNotice")} /></Field>
            <Field label={t("busOp.ann.message")} hint={`${form.message.length}/1500`}><textarea className="bop-textarea" rows={5} maxLength={1500} value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder={t("busOp.ann.messagePh")} /></Field>
            <div className="bop-field">
              <span className="bop-field-label">{t("busOp.ann.whoGets")}</span>
              <div className="bop-radios">
                {AUDIENCES.map((v) => (
                  <label key={v} className={`bop-radio ${form.audience === v ? "is-on" : ""}`}>
                    <input type="radio" name="audience" checked={form.audience === v} onChange={() => set({ audience: v })} />
                    <span className="bop-radio-dot" aria-hidden="true" />
                    <span><strong>{t(`busOp.ann.aud.${v}.title`)}</strong><small>{t(`busOp.ann.aud.${v}.desc`)}</small></span>
                  </label>
                ))}
              </div>
            </div>
            {form.audience === "trip" ? (
              <Field label={t("busOp.nav.trip")}>
                <select className="bop-select" value={form.tripId} onChange={(e) => set({ tripId: e.target.value })}>
                  <option value="">{trips.loading ? t("busOp.ann.loadingTrips") : t("busOp.ann.chooseTrip")}</option>
                  {tripItems.map((trip) => <option key={trip.id} value={trip.id}>{dayLabel(eatDate(trip.departureAt))} {eatTime(trip.departureAt)} · {trip.route.name} ({t("busOp.chart.tickets", { count: Number(trip.ticketsSold) || 0 })})</option>)}
                </select>
              </Field>
            ) : null}
            {error ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
            {sent ? <div className="bop-alert is-success" role="status"><IcCheck size={17} /><span>{sent}</span></div> : null}
            <button className="bop-btn bop-btn-primary bop-btn-lg" onClick={open}><IcMail size={19} /> {t("busOp.ann.reviewSend")}</button>
          </div>
        </Panel>

        <aside className="bop-compose-preview">
          <div className="bop-preview-label"><IcMail size={16} /> {t("busOp.ann.livePreview")}</div>
          <EmailPreview operator={operator} form={form} trip={chosenTrip} />
        </aside>
      </div>

      <Panel title={t("busOp.ann.sentMessages")} sub={t("busOp.ann.last50")} className="bop-mt">
        <ErrorBox error={history.error} onRetry={history.refresh} />
        {history.loading ? (
          <div className="bop-timeline" role="status" aria-busy="true" aria-label={t("busOp.ann.loadingMessages")}>{[0, 1, 2].map((i) => <div className="bop-tl-item" key={i}><span className="bop-tl-dot" /><div style={{ display: "grid", gap: 8, flex: 1 }}><Skel w="30%" h={14} /><Skel w="80%" h={11} /></div></div>)}</div>
        ) : history.data?.items?.length ? (
          <ol className="bop-timeline">
            {history.data.items.map((a) => {
              const k = { ...(KIND[a.kind] || { tone: "" }), label: t(`busOp.ann.kind.${a.kind}`, { defaultValue: a.kind }) };
              return (
                <li key={a.id} className={`bop-tl-item is-${k.tone || "grey"}`}>
                  <span className="bop-tl-dot" aria-hidden="true" />
                  <div className="bop-tl-body">
                    <div className="bop-tl-top"><strong>{a.title}</strong><span className="bop-tl-time" title={dateTimeLabel(a.createdAt)}>{timeAgo(a.createdAt, now)}</span></div>
                    <p>{a.message}</p>
                    <div className="bop-chips"><Chip tone={k.tone}>{k.label}</Chip><Chip tone="green"><IcUsers size={12} /> {t("busOp.ann.nSent", { n: a.recipients })}</Chip></div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <Empty compact icon={<IcMegaphone size={24} />} title={t("busOp.ann.nothingSent")}>{t("busOp.ann.nothingSentHint")}</Empty>}
      </Panel>

      {confirm ? (
        <Confirm title={t("busOp.ann.confirmTitle")} confirmLabel={t("busOp.ann.sendNow")} cancelLabel={t("busOp.ann.editMessage")} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send}>
          <p>{t(`busOp.ann.aud.${form.audience}.confirm`, { title: form.title.trim() })}</p>
        </Confirm>
      ) : null}
    </>
  );
}
