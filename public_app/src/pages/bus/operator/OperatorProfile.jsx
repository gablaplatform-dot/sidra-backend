import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
  return (
    <div className="bop-pubcard">
      <div className="bop-pubcard-cover" style={f.coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(9,22,48,0.1), rgba(9,22,48,0.65)), url(${f.coverUrl})` } : undefined}>
        <span className="bop-pubcard-tag">Public page preview</span>
      </div>
      <div className="bop-pubcard-body">
        <Avatar name={f.companyName || "B"} src={f.logoUrl} size={64} square className="bop-pubcard-logo" />
        <h3>{f.companyName || "Your company"}</h3>
        <p className="bop-pubcard-sub"><IcPin size={14} /> {f.parkName || "Bus park"}{f.parkDistrict ? `, ${f.parkDistrict}` : ""}</p>
        <div className="bop-chips">
          {operator.ratingCount ? <Chip tone="amber"><IcStar size={12} /> {Number(operator.ratingAvg).toFixed(1)} ({operator.ratingCount})</Chip> : null}
          {f.fleetSize ? <Chip><IcBus size={12} /> {f.fleetSize} buses</Chip> : null}
          {f.contactPhone ? <Chip><IcPhone size={12} /> {f.contactPhone}</Chip> : null}
        </div>
        {f.description ? <p className="bop-pubcard-desc">{f.description}</p> : <p className="bop-pubcard-desc is-placeholder">Add a short description so passengers know why to travel with you.</p>}
        <Link className="bop-btn bop-btn-light bop-btn-block" to={`/bus/parks/${operator.slug}`} target="_blank" rel="noreferrer"><IcExternal size={17} /> View public page</Link>
      </div>
    </div>
  );
}

export default function OperatorProfile() {
  const { operator, questions, reloadMe, toast } = useOperator();
  const initial = useMemo(() => initialOf(operator), [operator]);
  const [f, setF] = useState(() => initialOf(operator));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => { setF((s) => ({ ...s, ...patch })); setError(""); };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async (e) => {
    e?.preventDefault();
    if (f.companyName.trim().length < 2) return setError("Enter your company name.");
    if (!isUgPhone(f.contactPhone)) return setError("Enter a valid Ugandan contact phone number.");
    if (f.whatsapp.trim() && !isUgPhone(f.whatsapp)) return setError("The WhatsApp number isn’t valid.");
    if (!f.parkName.trim() || !f.parkDistrict) return setError("Enter your bus park name and district.");
    const fleet = Number(f.fleetSize);
    if (f.fleetSize === "" || !Number.isInteger(fleet) || fleet < 0) return setError("Enter how many buses you operate.");
    for (const q of questions) if (q.required && isEmptyAnswer(f.customFields[q.key])) return setError(`Please answer: ${q.label}`);
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
      toast("Profile saved");
      await reloadMe();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead sub="What passengers see on your public page." />
      <form className="bop-profile" onSubmit={save} noValidate>
        <div className="bop-profile-main">
          <Panel title="Company" sub="Your name and story">
            <div className="bop-form">
              <Field label="Company name"><input className="bop-input" value={f.companyName} onChange={(e) => set({ companyName: e.target.value })} maxLength={120} /></Field>
              <Field label="About your company" hint={`${f.description.length}/2000`}><textarea className="bop-textarea" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} /></Field>
            </div>
          </Panel>
          <Panel title="Branding" sub="A square logo and a wide photo of your buses">
            <div className="bop-form">
              <ImageField label="Logo" kind="logo" value={f.logoUrl} onChange={(v) => set({ logoUrl: v })} uploader={uploadOperatorImage} />
              <ImageField label="Cover photo" kind="cover" value={f.coverUrl} onChange={(v) => set({ coverUrl: v })} uploader={uploadOperatorImage} />
            </div>
          </Panel>
          <Panel title="Contact" sub="Passengers and Gabla use these numbers">
            <div className="bop-grid2">
              <Field label="Contact phone"><input className="bop-input" type="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
              <Field label="WhatsApp (optional)"><input className="bop-input" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
            </div>
          </Panel>
          <Panel title="Bus park" sub="Where passengers find your buses">
            <div className="bop-form">
              <Field label="Bus park name"><input className="bop-input" value={f.parkName} onChange={(e) => set({ parkName: e.target.value })} maxLength={120} /></Field>
              <div className="bop-grid2">
                <Field label="District"><select className="bop-select" value={f.parkDistrict} onChange={(e) => set({ parkDistrict: e.target.value })}><option value="">Choose a district</option>{UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
                <Field label="Address / landmark"><input className="bop-input" value={f.parkAddress} onChange={(e) => set({ parkAddress: e.target.value })} maxLength={240} /></Field>
              </div>
            </div>
          </Panel>
          <Panel title="Fleet" sub="A few details about your operation">
            <div className="bop-form">
              <Field label="Number of buses"><input className="bop-input bop-narrow" type="number" min="0" max="5000" inputMode="numeric" value={f.fleetSize} onChange={(e) => set({ fleetSize: e.target.value })} /></Field>
              {questions.map((q) => (
                <div className="bop-dyn" key={q.key}>
                  <span>{q.label}{q.required ? <b className="bop-req"> *</b> : <i> (optional)</i>}</span>
                  <DynamicField field={q} value={f.customFields[q.key]} onChange={(v) => set({ customFields: { ...f.customFields, [q.key]: v } })} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Account" sub="Managed by Gabla">
            <div className="bop-grid2">
              <Field label="Login email" hint="Contact Gabla to change this"><input className="bop-input" value={operator.email || ""} readOnly /></Field>
              <Field label="Gabla fee" hint="Set by Gabla"><input className="bop-input" value={`${Number(operator.commissionPercent)}% of each ticket`} readOnly /></Field>
            </div>
          </Panel>
        </div>

        <aside className="bop-profile-side">
          <PublicPreview f={f} operator={operator} />
          <div className="bop-trust"><IcShield size={18} /><span>Changes go live on your public page as soon as you save.</span></div>
        </aside>

        <div className={`bop-savebar ${dirty ? "is-visible" : ""}`} role="region" aria-label="Save changes">
          <div className="bop-savebar-in">
            <span className="bop-savebar-msg">{error ? <><IcAlert size={17} /> {error}</> : <><i /> You have unsaved changes</>}</span>
            <div>
              <button type="button" className="bop-btn bop-btn-light" onClick={() => { setF(initial); setError(""); }} disabled={busy}>Discard</button>
              <button type="submit" className="bop-btn bop-btn-primary" disabled={busy}>{busy ? "Saving…" : <><IcCheck size={17} strokeWidth={2.6} /> Save changes</>}</button>
            </div>
          </div>
        </div>
        {error && !dirty ? <div className="bop-alert is-error" role="alert"><IcAlert size={17} /><span>{error}</span></div> : null}
      </form>
    </>
  );
}
