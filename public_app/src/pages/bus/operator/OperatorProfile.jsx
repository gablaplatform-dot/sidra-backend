import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { isUgPhone, normalizeUgPhone, operatorApi } from "../../../lib/bus";
import DynamicField from "../../../components/DynamicField";
import { UGANDA_DISTRICTS } from "../../../components/bus/operator/districts";
import { Avatar, Chip, Field, ImageField, PageHead, Panel, errMsg, uploadOperatorImage, useOperator } from "../../../components/bus/operator/ui";
import { IcAlert, IcBus, IcCheck, IcExternal, IcPhone, IcPin, IcShield, IcStar } from "../../../components/bus/operator/icons";

const isEmptyAnswer = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

const initialOf = (operator) => ({
  companyName: operator.companyName || "",
  description: operator.description || "",
  logoUrl: operator.logoUrl || "",
  coverUrl: operator.coverUrl || "",
  contactPhone: operator.contactPhone || "",
  whatsapp: operator.whatsapp || "",
  parkName: operator.parkName || "",
  parkDistrict: operator.parkDistrict || "",
  parkAddress: operator.parkAddress || "",
  fleetSize: String(operator.fleetSize ?? ""),
  customFields: operator.customFields || {}
});

function PublicPreview({ f, operator }) {
  const { t } = useTranslation();
  return (
    <div className="bop-pubcard">
      <div className="bop-pubcard-cover" style={f.coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(9,22,48,0.1), rgba(9,22,48,0.65)), url(${f.coverUrl})` } : undefined}>
        <span className="bop-pubcard-tag">{t("busOp.pf.preview")}</span>
      </div>
      <div className="bop-pubcard-body">
        <Avatar name={f.companyName || "B"} src={f.logoUrl} size={64} square className="bop-pubcard-logo" />
        <h3>{f.companyName || t("busOp.pf.yourCompany")}</h3>
        <p className="bop-pubcard-sub"><IcPin size={14} /> {f.parkName || t("busOp.pf.busPark")}{f.parkDistrict ? `, ${f.parkDistrict}` : ""}</p>
        <div className="bop-chips">
          {operator.ratingCount ? <Chip tone="amber"><IcStar size={12} /> {Number(operator.ratingAvg).toFixed(1)} ({operator.ratingCount})</Chip> : null}
          {f.fleetSize ? <Chip><IcBus size={12} /> {t("busOp.pf.busesN", { count: Number(f.fleetSize) || 0, n: f.fleetSize })}</Chip> : null}
          {f.contactPhone ? <Chip><IcPhone size={12} /> {f.contactPhone}</Chip> : null}
        </div>
        {f.description ? <p className="bop-pubcard-desc">{f.description}</p> : <p className="bop-pubcard-desc is-placeholder">{t("busOp.pf.descPlaceholder")}</p>}
        <Link className="bop-btn bop-btn-light bop-btn-block" to={`/bus/parks/${operator.slug}`} target="_blank" rel="noreferrer"><IcExternal size={17} /> {t("busOp.portal.viewPublic")}</Link>
      </div>
    </div>
  );
}

export default function OperatorProfile() {
  const { t } = useTranslation();
  const { operator, questions, reloadMe, toast } = useOperator();
  const initial = useMemo(() => initialOf(operator), [operator]);
  const [f, setF] = useState(() => initialOf(operator));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => { setF((s) => ({ ...s, ...patch })); setError(""); };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async (e) => {
    e?.preventDefault();
    if (f.companyName.trim().length < 2) return setError(t("busOp.ob.vCompany"));
    if (!isUgPhone(f.contactPhone)) return setError(t("busOp.pf.vPhone"));
    if (f.whatsapp.trim() && !isUgPhone(f.whatsapp)) return setError(t("busOp.pf.vWhatsapp"));
    if (!f.parkName.trim() || !f.parkDistrict) return setError(t("busOp.pf.vPark"));
    const fleet = Number(f.fleetSize);
    if (f.fleetSize === "" || !Number.isInteger(fleet) || fleet < 0) return setError(t("busOp.pf.vFleet"));
    for (const q of questions) if (q.required && isEmptyAnswer(f.customFields[q.key])) return setError(t("busOp.ob.vAnswer", { question: q.label }));
    setBusy(true);
    try {
      await operatorApi.patch("/me", {
        companyName: f.companyName.trim(),
        description: f.description.trim(),
        logoUrl: f.logoUrl || "",
        coverUrl: f.coverUrl || "",
        contactPhone: normalizeUgPhone(f.contactPhone),
        whatsapp: f.whatsapp.trim() ? normalizeUgPhone(f.whatsapp) : "",
        parkName: f.parkName.trim(),
        parkDistrict: f.parkDistrict,
        parkAddress: f.parkAddress.trim(),
        fleetSize: fleet,
        customFields: f.customFields
      });
      toast(t("busOp.pf.saved"));
      await reloadMe();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead sub={t("busOp.pf.sub")} />
      <form className="bop-profile" onSubmit={save} noValidate>
        <div className="bop-profile-main">
          <Panel title={t("busOp.ob.rvCompany")} sub={t("busOp.pf.companySub")}>
            <div className="bop-form">
              <Field label={t("busOp.ob.companyName")}><input className="bop-input" value={f.companyName} onChange={(e) => set({ companyName: e.target.value })} maxLength={120} /></Field>
              <Field label={t("busOp.pf.about")} hint={`${f.description.length}/2000`}><textarea className="bop-textarea" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} /></Field>
            </div>
          </Panel>
          <Panel title={t("busOp.pf.branding")} sub={t("busOp.pf.brandingSub")}>
            <div className="bop-form">
              <ImageField label={t("busOp.ui.logo")} kind="logo" value={f.logoUrl} onChange={(v) => set({ logoUrl: v })} uploader={uploadOperatorImage} />
              <ImageField label={t("busOp.ob.coverPhoto")} kind="cover" value={f.coverUrl} onChange={(v) => set({ coverUrl: v })} uploader={uploadOperatorImage} />
            </div>
          </Panel>
          <Panel title={t("busOp.pf.contact")} sub={t("busOp.pf.contactSub")}>
            <div className="bop-grid2">
              <Field label={t("busOp.ob.contactPhone")}><input className="bop-input" type="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
              <Field label={t("busOp.ob.whatsapp")}><input className="bop-input" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
            </div>
          </Panel>
          <Panel title={t("busOp.pf.busPark")} sub={t("busOp.pf.parkSub")}>
            <div className="bop-form">
              <Field label={t("busOp.ob.parkName")}><input className="bop-input" value={f.parkName} onChange={(e) => set({ parkName: e.target.value })} maxLength={120} /></Field>
              <div className="bop-grid2">
                <Field label={t("busOp.ob.district")}><select className="bop-select" value={f.parkDistrict} onChange={(e) => set({ parkDistrict: e.target.value })}><option value="">{t("busOp.ob.chooseDistrict")}</option>{UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
                <Field label={t("busOp.pf.address")}><input className="bop-input" value={f.parkAddress} onChange={(e) => set({ parkAddress: e.target.value })} maxLength={240} /></Field>
              </div>
            </div>
          </Panel>
          <Panel title={t("busOp.ob.rvFleet")} sub={t("busOp.pf.fleetSub")}>
            <div className="bop-form">
              <Field label={t("busOp.pf.numBuses")}><input className="bop-input bop-narrow" type="number" min="0" max="5000" inputMode="numeric" value={f.fleetSize} onChange={(e) => set({ fleetSize: e.target.value })} /></Field>
              {questions.map((q) => (
                <div className="bop-dyn" key={q.key}>
                  <span>{q.label}{q.required ? <b className="bop-req"> *</b> : <i> ({t("busOp.ob.optional")})</i>}</span>
                  <DynamicField field={q} value={f.customFields[q.key]} onChange={(v) => set({ customFields: { ...f.customFields, [q.key]: v } })} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={t("busOp.pf.account")} sub={t("busOp.pf.accountSub")}>
            <div className="bop-grid2">
              <Field label={t("busOp.pf.loginEmail")} hint={t("busOp.pf.loginEmailHint")}><input className="bop-input" value={operator.email || ""} readOnly /></Field>
              <Field label={t("busOp.pf.fee")} hint={t("busOp.pf.feeHint")}><input className="bop-input" value={t("busOp.pf.feeValue", { pct: Number(operator.commissionPercent) })} readOnly /></Field>
            </div>
          </Panel>
        </div>

        <aside className="bop-profile-side">
          <PublicPreview f={f} operator={operator} />
          <div className="bop-trust"><IcShield size={18} /><span>{t("busOp.pf.goLive")}</span></div>
        </aside>

        <div className={`bop-savebar ${dirty ? "is-visible" : ""}`} role="region" aria-label={t("busOp.common.saveChanges")}>
          <div className="bop-savebar-in">
            <span className="bop-savebar-msg">{error ? <><IcAlert size={17} /> {error}</> : <><i /> {t("busOp.pf.unsaved")}</>}</span>
            <div>
              <button type="button" className="bop-btn bop-btn-light" onClick={() => { setF(initial); setError(""); }} disabled={busy}>{t("busOp.pf.discard")}</button>
              <button type="submit" className="bop-btn bop-btn-primary" disabled={busy}>{busy ? t("busOp.td.saving") : <><IcCheck size={17} strokeWidth={2.6} /> {t("busOp.common.saveChanges")}</>}</button>
            </div>
          </div>
        </div>
        {error && !dirty ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
      </form>
    </>
  );
}
