import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDocumentSettings, saveDocumentSettings } from "../../lib/documents";
import { uploadFile } from "../../lib/storage";
import { IconBox, IconCash, IconCheck, IconImage, IconReceipt, IconSparkles, IconStore, IconWallet } from "../icons";
import { Skel } from "../Skeleton";
import { Accordion, ColorPalette, TextField, Toggle } from "./DocsFields";
import DocumentPreview from "./DocumentPreview";
import { SECTION_OF, clone, diffSettings, logoLikelyUnsupported, monogram, normalize, parseApiError, validateDraft } from "./docsModel";

const IconMail = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

const SECTIONS = [
  { key: "business", title: "Business details & logo", icon: <IconStore />, preview: "quotation" },
  { key: "look", title: "Look & feel", icon: <IconSparkles />, preview: "quotation" },
  { key: "quotation", title: "Quotation", icon: <IconReceipt />, preview: "quotation" },
  { key: "receipt", title: "Receipt", icon: <IconCheck />, preview: "receipt" },
  { key: "tax", title: "Tax (VAT)", icon: <IconCash />, preview: "quotation" },
  { key: "payment", title: "Payment details", icon: <IconWallet />, preview: "quotation" },
  { key: "email", title: "Email delivery", icon: <IconMail />, preview: null }
];

const StudioSkeleton = () => (
  <div className="docs-studio-grid" role="status" aria-busy="true">
    <span className="sr-only">Loading your document settings…</span>
    <div className="docs-form-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="docs-acc docs-acc-skel">
          <Skel h={42} w={42} r={12} />
          <div className="docs-acc-skel-text"><Skel h={15} w="46%" /><Skel h={12} w="72%" /></div>
        </div>
      ))}
    </div>
    <div className="docs-preview">
      <Skel h={44} w="100%" r={999} />
      <Skel h={560} w="100%" r={16} style={{ marginTop: 12 }} />
    </div>
  </div>
);

function LogoField({ value, onChange, avatarUrl, businessName, error, notify }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [typeWarning, setTypeWarning] = useState(false);
  const unsupported = typeWarning || logoLikelyUnsupported(value);
  const effective = value || avatarUrl || "";

  const pick = async (event) => {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("error", "Please choose an image file (PNG or JPEG works best).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("error", "That image is over 5 MB. Please choose a smaller logo.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "document-logos", { register: false });
      onChange(url);
      setTypeWarning(!["image/png", "image/jpeg"].includes(file.type));
    } catch (uploadError) {
      notify("error", uploadError.message || "Unable to upload that logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="docs-field docs-logo">
      <span className="docs-label" id="docs-logo-label">Logo</span>
      <div className="docs-logo-row">
        <div className="docs-logo-thumb" aria-hidden="true">
          {effective ? <img src={effective} alt="" /> : <span>{monogram(businessName)}</span>}
        </div>
        <div className="docs-logo-actions">
          <div className="docs-btn-row">
            <button type="button" className="docs-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-describedby="docs-logo-hint">
              <IconImage /> {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
            </button>
            {value ? (
              <button type="button" className="docs-btn is-quiet" onClick={() => { onChange(""); setTypeWarning(false); }}>Remove</button>
            ) : null}
            {avatarUrl && value !== avatarUrl ? (
              <button type="button" className="docs-btn is-quiet" onClick={() => { onChange(avatarUrl); setTypeWarning(false); }}>Use my profile photo</button>
            ) : null}
          </div>
          <input ref={fileRef} id="docs-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="docs-file" onChange={pick} aria-labelledby="docs-logo-label" tabIndex={-1} />
          <p id="docs-logo-hint" className="docs-hint">
            {value
              ? "Your uploaded logo appears in the document header."
              : avatarUrl
                ? "No logo uploaded, so your profile photo is used."
                : "No logo yet. A monogram of your business name is used instead."}{" "}
            Use a square PNG or JPEG, ideally at least 300 px.
          </p>
        </div>
      </div>
      {unsupported ? (
        <p className="docs-warning" role="alert">
          PDFs can only show PNG or JPEG logos, so this file will appear as a monogram on your documents. Upload a PNG or JPEG{avatarUrl ? ", or use your profile photo" : ""}.
        </p>
      ) : null}
      {error ? <p className="docs-error" role="alert">{error}</p> : null}
    </div>
  );
}

export default function DocumentStudio({ provider, onDirtyChange, active = true }) {
  const [state, setState] = useState({ status: "loading", error: "" });
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [open, setOpen] = useState({ business: true, look: true });
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewType, setPreviewType] = useState("quotation");
  const toastTimer = useRef(null);

  const notify = useCallback((tone, text) => {
    clearTimeout(toastTimer.current);
    setToast({ tone, text, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), tone === "error" ? 7000 : 3800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(() => {
    setState({ status: "loading", error: "" });
    getDocumentSettings()
      .then((result) => {
        setSaved(result.settings);
        setDraft(clone(result.settings));
        setDefaults(result.defaults);
        setState({ status: "ready", error: "" });
      })
      .catch((error) => setState({ status: "error", error: error.message || "Unable to load your document settings." }));
  }, []);
  useEffect(load, [load]);

  const dirty = useMemo(() => (saved && draft ? JSON.stringify(normalize(saved)) !== JSON.stringify(normalize(draft)) : false), [saved, draft]);
  const liveErrors = useMemo(() => (draft ? validateDraft(draft) : {}), [draft]);
  const errors = { ...serverErrors, ...liveErrors };
  const valid = Object.keys(liveErrors).length === 0;
  const normalizedDraft = useMemo(() => (draft ? normalize(draft) : null), [draft]);
  const previewPatch = useMemo(() => (saved && draft ? diffSettings(saved, draft) : {}), [saved, draft]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const sectionErrors = useMemo(() => {
    const counts = {};
    for (const path of Object.keys(errors)) {
      const key = SECTION_OF(path);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [errors]);

  const set = (path) => (value) => {
    const [section, key] = path.split(".");
    setDraft((d) => ({ ...d, [section]: { ...d[section], [key]: value } }));
    setServerErrors((e) => {
      if (!e[path]) return e;
      const { [path]: _drop, ...rest } = e;
      return rest;
    });
  };
  const f = (path) => {
    const [section, key] = path.split(".");
    return { value: draft[section][key], onChange: set(path), path, error: errors[path] };
  };

  const toggleSection = (section) => {
    const willOpen = !open[section.key];
    setOpen((o) => ({ ...o, [section.key]: willOpen }));
    if (willOpen && section.preview) setPreviewType(section.preview);
  };

  const discard = () => {
    setDraft(clone(saved));
    setServerErrors({});
    notify("info", "Changes discarded.");
  };

  const save = async () => {
    if (!valid) {
      setOpen((o) => {
        const next = { ...o };
        for (const path of Object.keys(liveErrors)) next[SECTION_OF(path)] = true;
        return next;
      });
      notify("error", "Please fix the highlighted fields first.");
      return;
    }
    const patch = diffSettings(saved, draft);
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      const result = await saveDocumentSettings(patch);
      setSaved(result.settings);
      setDraft(clone(result.settings));
      setDefaults(result.defaults);
      setServerErrors({});
      notify("success", "Saved. New quotations and receipts will use this design.");
    } catch (error) {
      const parsed = parseApiError(error.message);
      if (parsed.path) {
        setServerErrors((e) => ({ ...e, [parsed.path]: parsed.message }));
        setOpen((o) => ({ ...o, [SECTION_OF(parsed.path)]: true }));
        notify("error", `Couldn't save: ${parsed.message}`);
      } else {
        notify("error", error.message || "Unable to save your changes.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (state.status === "loading") return <StudioSkeleton />;
  if (state.status === "error") {
    return (
      <div className="docs-state">
        <IconBox />
        <h3>We couldn&apos;t load your document settings</h3>
        <p>{state.error}</p>
        <button type="button" className="docs-btn is-primary" onClick={load}>Try again</button>
      </div>
    );
  }

  const q = draft.quotation;
  const summaries = {
    business: draft.brand.businessName || "Name, contact details and logo",
    look: `Accent ${draft.brand.accentColor} · ${[draft.options.showItemNumbers && "item numbers", draft.options.showAmountInWords && "amount in words", draft.options.showQrCode && "QR code"].filter(Boolean).join(", ") || "plain"}`,
    quotation: `${q.title} · ${String(q.prefix).toUpperCase()}-… · valid ${q.validityDays} days`,
    receipt: `${draft.receipt.title} · ${String(draft.receipt.prefix).toUpperCase()}-…`,
    tax: draft.tax.enabled ? `${draft.tax.label || "VAT"} ${draft.tax.percent}% ${draft.tax.inclusive ? "included in prices" : "added on top"}` : "Off — no tax shown",
    payment: draft.payment.mobileMoneyNumber || draft.payment.bankDetails || draft.payment.instructions ? "Shown on quotations" : "How buyers can pay you",
    email: `${draft.email.sendQuotation ? "Quotations on" : "Quotations off"} · ${draft.email.sendReceipt ? "Receipts on" : "Receipts off"}`
  };

  return (
    <div className="docs-studio" hidden={!active}>
      <div className="docs-studio-grid">
        <div className="docs-form-col">
          <Accordion id="docs-sec-business" icon={SECTIONS[0].icon} title={SECTIONS[0].title} summary={summaries.business} open={open.business} onToggle={() => toggleSection(SECTIONS[0])} errorCount={sectionErrors.business}>
            <p className="docs-section-intro">Leave a field blank to use the details from your profile.</p>
            <LogoField value={draft.brand.logoUrl} onChange={set("brand.logoUrl")} avatarUrl={provider?.media?.avatarUrl || ""} businessName={draft.brand.businessName} error={errors["brand.logoUrl"]} notify={notify} />
            <div className="docs-grid2">
              <TextField id="docs-businessName" label="Business name" {...f("brand.businessName")} autoComplete="organization" />
              <TextField id="docs-tagline" label="Tagline (optional)" {...f("brand.tagline")} placeholder="e.g. Genuine phones & accessories" />
            </div>
            <TextField id="docs-address" label="Address" {...f("brand.address")} multiline rows={2} autoComplete="street-address" />
            <div className="docs-grid2">
              <TextField id="docs-phone" label="Phone" {...f("brand.phone")} type="tel" autoComplete="tel" />
              <TextField id="docs-email" label="Email" {...f("brand.email")} type="email" autoComplete="email" />
              <TextField id="docs-website" label="Website" {...f("brand.website")} placeholder="www.mybusiness.com" autoComplete="url" />
              <TextField id="docs-taxId" label="Tax ID / TIN (optional)" {...f("brand.taxId")} hint="Printed in the header when you add one." />
            </div>
          </Accordion>

          <Accordion id="docs-sec-look" icon={SECTIONS[1].icon} title={SECTIONS[1].title} summary={summaries.look} open={open.look} onToggle={() => toggleSection(SECTIONS[1])} errorCount={sectionErrors.look}>
            <ColorPalette id="docs-accent" value={draft.brand.accentColor} onChange={set("brand.accentColor")} error={errors["brand.accentColor"]} />
            <div className="docs-switch-list">
              <Toggle id="docs-opt-numbers" label="Number the items" hint="Adds a 1, 2, 3… column to the items table." checked={draft.options.showItemNumbers} onChange={set("options.showItemNumbers")} />
              <Toggle id="docs-opt-words" label="Show the total in words" hint="e.g. “One million two hundred fifty thousand Uganda shillings only”." checked={draft.options.showAmountInWords} onChange={set("options.showAmountInWords")} />
              <Toggle id="docs-opt-qr" label="Show a QR code" hint="Lets the buyer scan to open the order." checked={draft.options.showQrCode} onChange={set("options.showQrCode")} />
            </div>
          </Accordion>

          <Accordion id="docs-sec-quotation" icon={SECTIONS[2].icon} title={SECTIONS[2].title} summary={summaries.quotation} open={open.quotation} onToggle={() => toggleSection(SECTIONS[2])} errorCount={sectionErrors.quotation}>
            <div className="docs-grid2">
              <TextField id="docs-q-title" label="Document title" {...f("quotation.title")} />
              <TextField id="docs-q-prefix" label="Number prefix" {...f("quotation.prefix")} onChange={(v) => set("quotation.prefix")(v.toUpperCase())} hint={`Numbers look like ${String(q.prefix || "QT").toUpperCase()}-${new Date().getFullYear()}-0001.`} />
              <TextField id="docs-q-days" label="Valid for" {...f("quotation.validityDays")} inputMode="numeric" suffix="days" />
            </div>
            <TextField id="docs-q-intro" label="Intro message" {...f("quotation.intro")} multiline rows={3} onReset={() => set("quotation.intro")(defaults.quotation.intro)} hint="A short greeting shown above the items." />
            <TextField id="docs-q-terms" label="Terms & conditions" {...f("quotation.terms")} multiline rows={6} onReset={() => set("quotation.terms")(defaults.quotation.terms)} hint="One term per line. Printed at the bottom of every quotation." />
            <Toggle id="docs-q-sign" label="Add a signature line" hint="Prints a signature area with your name and title." checked={q.showSignature} onChange={set("quotation.showSignature")} />
            {q.showSignature ? (
              <div className="docs-grid2">
                <TextField id="docs-q-sname" label="Signatory name" {...f("quotation.signatoryName")} placeholder="e.g. Grace Akello" />
                <TextField id="docs-q-stitle" label="Signatory title" {...f("quotation.signatoryTitle")} placeholder="e.g. Sales manager" />
              </div>
            ) : null}
          </Accordion>

          <Accordion id="docs-sec-receipt" icon={SECTIONS[3].icon} title={SECTIONS[3].title} summary={summaries.receipt} open={open.receipt} onToggle={() => toggleSection(SECTIONS[3])} errorCount={sectionErrors.receipt}>
            <div className="docs-grid2">
              <TextField id="docs-r-title" label="Document title" {...f("receipt.title")} />
              <TextField id="docs-r-prefix" label="Number prefix" {...f("receipt.prefix")} onChange={(v) => set("receipt.prefix")(v.toUpperCase())} hint={`Numbers look like ${String(draft.receipt.prefix || "RC").toUpperCase()}-${new Date().getFullYear()}-0001.`} />
            </div>
            <TextField id="docs-r-thanks" label="Thank-you message" {...f("receipt.thankYou")} multiline rows={3} onReset={() => set("receipt.thankYou")(defaults.receipt.thankYou)} />
            <TextField id="docs-r-foot" label="Footer note (optional)" {...f("receipt.footerNote")} multiline rows={2} placeholder="e.g. Goods once sold are not returnable." />
          </Accordion>

          <Accordion id="docs-sec-tax" icon={SECTIONS[4].icon} title={SECTIONS[4].title} summary={summaries.tax} open={open.tax} onToggle={() => toggleSection(SECTIONS[4])} errorCount={sectionErrors.tax}>
            <Toggle id="docs-t-on" label="Show VAT on documents" hint="Uganda’s standard VAT rate is 18%. Only turn this on if your business is VAT-registered." checked={draft.tax.enabled} onChange={set("tax.enabled")} />
            {draft.tax.enabled ? (
              <>
                <div className="docs-grid2">
                  <TextField id="docs-t-label" label="Tax label" {...f("tax.label")} placeholder="VAT" />
                  <TextField id="docs-t-pct" label="Rate" {...f("tax.percent")} inputMode="decimal" suffix="%" />
                </div>
                <Toggle id="docs-t-inc" label="Prices already include tax" hint={draft.tax.inclusive ? "Your listed prices are final. The tax amount is shown as part of the total, not added to it." : "Tax is added on top of your listed prices, so the buyer pays more than the price shown."} checked={draft.tax.inclusive} onChange={set("tax.inclusive")} />
              </>
            ) : null}
          </Accordion>

          <Accordion id="docs-sec-payment" icon={SECTIONS[5].icon} title={SECTIONS[5].title} summary={summaries.payment} open={open.payment} onToggle={() => toggleSection(SECTIONS[5])} errorCount={sectionErrors.payment}>
            <p className="docs-section-intro">Shown on quotations so buyers know how to pay you.</p>
            <TextField id="docs-p-instr" label="Payment instructions" {...f("payment.instructions")} multiline rows={3} placeholder="e.g. Pay on delivery, or send mobile money before pickup." />
            <div className="docs-grid2">
              <TextField id="docs-p-mm" label="Mobile money number" {...f("payment.mobileMoneyNumber")} type="tel" placeholder="e.g. 0771 000 000" />
              <TextField id="docs-p-mmname" label="Mobile money account name" {...f("payment.mobileMoneyName")} />
            </div>
            <TextField id="docs-p-bank" label="Bank details" {...f("payment.bankDetails")} multiline rows={3} placeholder={"Bank, account name, account number"} />
          </Accordion>

          <Accordion id="docs-sec-email" icon={SECTIONS[6].icon} title={SECTIONS[6].title} summary={summaries.email} open={open.email} onToggle={() => toggleSection(SECTIONS[6])} errorCount={sectionErrors.email}>
            <div className="docs-switch-list">
              <Toggle id="docs-e-q" label="Email the quotation automatically" hint="Sent to the buyer when they place a cash or pay-on-delivery order." checked={draft.email.sendQuotation} onChange={set("email.sendQuotation")} />
              <Toggle id="docs-e-r" label="Email the receipt automatically" hint="Sent as soon as an order is paid (mobile money, or cash collected on delivery)." checked={draft.email.sendReceipt} onChange={set("email.sendReceipt")} />
            </div>
            <p className="docs-hint">The buyer needs an email address on their order. You can always resend a document from “Issued documents”.</p>
          </Accordion>
        </div>

        <DocumentPreview draft={normalizedDraft} patch={previewPatch} valid={valid} active={active} type={previewType} onTypeChange={setPreviewType} />
      </div>

      <div className={`docs-savebar${dirty ? " is-dirty" : ""}`} role="region" aria-label="Save changes">
        <p className="docs-save-status" role="status" aria-live="polite">
          {saving ? <><span className="docs-spinner" aria-hidden="true" /> Saving…</> : dirty ? <><span className="docs-dot is-warn" aria-hidden="true" /> Unsaved changes</> : <><span className="docs-dot is-ok" aria-hidden="true" /> All changes saved</>}
        </p>
        <div className="docs-save-actions">
          <button type="button" className="docs-btn" onClick={discard} disabled={!dirty || saving}>Discard</button>
          <button type="button" className="docs-btn is-primary" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      {toast ? (
        <div className={`docs-toast is-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">×</button>
        </div>
      ) : null}
    </div>
  );
}
