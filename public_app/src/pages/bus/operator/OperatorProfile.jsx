import React, { useState } from "react";
import { Link } from "react-router-dom";

import { isUgPhone, normalizeUgPhone, operatorApi } from "../../../lib/bus";
import DynamicField from "../../../components/DynamicField";
import { UGANDA_DISTRICTS } from "../../../components/bus/operator/districts";
import { Field, IconExternal, ImageField, PageHead, errMsg, uploadOperatorImage, useOperator } from "../../../components/bus/operator/ui";

const isEmptyAnswer = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export default function OperatorProfile() {
  const { operator, questions, reloadMe, toast } = useOperator();
  const [f, setF] = useState(() => ({
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
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => { setF((s) => ({ ...s, ...patch })); setError(""); };

  const save = async (e) => {
    e.preventDefault();
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
      <PageHead title="Company profile" sub="What passengers see on your public page." actions={<Link className="bus-btn bus-btn-light" to={`/bus/parks/${operator.slug}`} target="_blank" rel="noreferrer"><IconExternal width={17} height={17} /> View public page</Link>} />
      <form className="bus-card bop-panel bop-profile" onSubmit={save} noValidate>
        <div className="bop-form">
          <div className="bop-grid2">
            <Field label="Login email" hint="Contact Gabla to change this"><input className="bus-input" value={operator.email || ""} readOnly /></Field>
            <Field label="Gabla fee" hint="Set by Gabla"><input className="bus-input" value={`${Number(operator.commissionPercent)}% of each ticket`} readOnly /></Field>
          </div>
          <Field label="Company name"><input className="bus-input" value={f.companyName} onChange={(e) => set({ companyName: e.target.value })} maxLength={120} /></Field>
          <Field label="About your company"><textarea className="bus-textarea" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} /></Field>
          <div className="bop-grid2">
            <ImageField label="Logo" kind="logo" value={f.logoUrl} onChange={(v) => set({ logoUrl: v })} uploader={uploadOperatorImage} />
            <ImageField label="Cover photo" kind="cover" value={f.coverUrl} onChange={(v) => set({ coverUrl: v })} uploader={uploadOperatorImage} />
          </div>
          <div className="bop-grid2">
            <Field label="Contact phone"><input className="bus-input" type="tel" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} /></Field>
            <Field label="WhatsApp (optional)"><input className="bus-input" type="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
          </div>
          <div className="bop-park">
            <h3>Bus park</h3>
            <Field label="Bus park name"><input className="bus-input" value={f.parkName} onChange={(e) => set({ parkName: e.target.value })} maxLength={120} /></Field>
            <div className="bop-grid2">
              <Field label="District"><select className="bus-select" value={f.parkDistrict} onChange={(e) => set({ parkDistrict: e.target.value })}><option value="">Choose a district</option>{UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
              <Field label="Address / landmark"><input className="bus-input" value={f.parkAddress} onChange={(e) => set({ parkAddress: e.target.value })} maxLength={240} /></Field>
            </div>
          </div>
          <Field label="Number of buses"><input className="bus-input bop-narrow" type="number" min="0" max="5000" inputMode="numeric" value={f.fleetSize} onChange={(e) => set({ fleetSize: e.target.value })} /></Field>
          {questions.map((q) => (
            <div className="bus-field bop-dyn" key={q.key}>
              <span>{q.label}{q.required ? <b className="bop-req"> *</b> : <i> (optional)</i>}</span>
              <DynamicField field={q} value={f.customFields[q.key]} onChange={(v) => set({ customFields: { ...f.customFields, [q.key]: v } })} />
            </div>
          ))}
          {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}
          <div><button type="submit" className="bus-btn bus-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
        </div>
      </form>
    </>
  );
}
