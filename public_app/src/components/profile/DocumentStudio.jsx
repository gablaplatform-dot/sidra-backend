import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
  { key: "business", icon: <IconStore />, preview: "quotation" },
  { key: "look", icon: <IconSparkles />, preview: "quotation" },
  { key: "quotation", icon: <IconReceipt />, preview: "quotation" },
  { key: "receipt", icon: <IconCheck />, preview: "receipt" },
  { key: "tax", icon: <IconCash />, preview: "quotation" },
  { key: "payment", icon: <IconWallet />, preview: "quotation" },
  { key: "email", icon: <IconMail />, preview: null }
];

const StudioSkeleton = () => {
  const { t } = useTranslation();
  return (
  <div className="docs-studio-grid" role="status" aria-busy="true">
    <span className="sr-only">{t("docs.studio.loading")}</span>
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
};

function LogoField({ value, onChange, avatarUrl, businessName, error, notify }) {
  const { t } = useTranslation();
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
      notify("error", t("docs.studio.errNotImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("error", t("docs.studio.errTooBig"));
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, "document-logos", { register: false });
      onChange(url);
      setTypeWarning(!["image/png", "image/jpeg"].includes(file.type));
    } catch (uploadError) {
      notify("error", uploadError.message || t("docs.studio.errUpload"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="docs-field docs-logo">
      <span className="docs-label" id="docs-logo-label">{t("docs.studio.logo")}</span>
      <div className="docs-logo-row">
        <div className="docs-logo-thumb" aria-hidden="true">
          {effective ? <img src={effective} alt="" /> : <span>{monogram(businessName)}</span>}
        </div>
        <div className="docs-logo-actions">
          <div className="docs-btn-row">
            <button type="button" className="docs-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-describedby="docs-logo-hint">
              <IconImage /> {uploading ? t("docs.studio.uploading") : value ? t("docs.studio.replaceLogo") : t("docs.studio.uploadLogo")}
            </button>
            {value ? (
              <button type="button" className="docs-btn is-quiet" onClick={() => { onChange(""); setTypeWarning(false); }}>{t("docs.studio.remove")}</button>
            ) : null}
            {avatarUrl && value !== avatarUrl ? (
              <button type="button" className="docs-btn is-quiet" onClick={() => { onChange(avatarUrl); setTypeWarning(false); }}>{t("docs.studio.useProfilePhoto")}</button>
            ) : null}
          </div>
          <input ref={fileRef} id="docs-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="docs-file" onChange={pick} aria-labelledby="docs-logo-label" tabIndex={-1} />
          <p id="docs-logo-hint" className="docs-hint">
            {value
              ? t("docs.studio.logoHintUploaded")
              : avatarUrl
                ? t("docs.studio.logoHintAvatar")
                : t("docs.studio.logoHintNone")}{" "}
            {t("docs.studio.logoHintSize")}
          </p>
        </div>
      </div>
      {unsupported ? (
        <p className="docs-warning" role="alert">
          {t(avatarUrl ? "docs.studio.logoUnsupportedAvatar" : "docs.studio.logoUnsupported")}
        </p>
      ) : null}
      {error ? <p className="docs-error" role="alert">{error}</p> : null}
    </div>
  );
}

export default function DocumentStudio({ provider, onDirtyChange, active = true }) {
  const { t } = useTranslation();
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
      .catch((error) => setState({ status: "error", error: error.message || t("docs.studio.errLoad") }));
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
    notify("info", t("docs.studio.discarded"));
  };

  const save = async () => {
    if (!valid) {
      setOpen((o) => {
        const next = { ...o };
        for (const path of Object.keys(liveErrors)) next[SECTION_OF(path)] = true;
        return next;
      });
      notify("error", t("docs.studio.fixFirst"));
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
      notify("success", t("docs.studio.saved"));
    } catch (error) {
      const parsed = parseApiError(error.message);
      if (parsed.path) {
        setServerErrors((e) => ({ ...e, [parsed.path]: parsed.message }));
        setOpen((o) => ({ ...o, [SECTION_OF(parsed.path)]: true }));
        notify("error", t("docs.studio.couldntSave", { message: parsed.message }));
      } else {
        notify("error", error.message || t("docs.studio.errSave"));
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
        <h3>{t("docs.studio.loadFailed")}</h3>
        <p>{state.error}</p>
        <button type="button" className="docs-btn is-primary" onClick={load}>{t("docs.studio.tryAgain")}</button>
      </div>
    );
  }

  const q = draft.quotation;
  const summaries = {
    business: draft.brand.businessName || t("docs.studio.sum.business"),
    look: t("docs.studio.sum.look", { color: draft.brand.accentColor, options: [draft.options.showItemNumbers && t("docs.studio.sum.itemNumbers"), draft.options.showAmountInWords && t("docs.studio.sum.amountWords"), draft.options.showQrCode && t("docs.studio.sum.qr")].filter(Boolean).join(", ") || t("docs.studio.sum.plain") }),
    quotation: t("docs.studio.sum.quotation", { title: q.title, prefix: String(q.prefix).toUpperCase(), days: q.validityDays }),
    receipt: `${draft.receipt.title} · ${String(draft.receipt.prefix).toUpperCase()}-…`,
    tax: draft.tax.enabled ? t(draft.tax.inclusive ? "docs.studio.sum.taxIncluded" : "docs.studio.sum.taxOnTop", { label: draft.tax.label || "VAT", percent: draft.tax.percent }) : t("docs.studio.sum.taxOff"),
    payment: draft.payment.mobileMoneyNumber || draft.payment.bankDetails || draft.payment.instructions ? t("docs.studio.sum.paymentShown") : t("docs.studio.sum.paymentHow"),
    email: `${draft.email.sendQuotation ? t("docs.studio.sum.quotesOn") : t("docs.studio.sum.quotesOff")} · ${draft.email.sendReceipt ? t("docs.studio.sum.receiptsOn") : t("docs.studio.sum.receiptsOff")}`
  };

  return (
    <div className="docs-studio" hidden={!active}>
      <div className="docs-studio-grid">
        <div className="docs-form-col">
          <Accordion id="docs-sec-business" icon={SECTIONS[0].icon} title={t("docs.studio.sections.business")} summary={summaries.business} open={open.business} onToggle={() => toggleSection(SECTIONS[0])} errorCount={sectionErrors.business}>
            <p className="docs-section-intro">{t("docs.studio.businessIntro")}</p>
            <LogoField value={draft.brand.logoUrl} onChange={set("brand.logoUrl")} avatarUrl={provider?.media?.avatarUrl || ""} businessName={draft.brand.businessName} error={errors["brand.logoUrl"]} notify={notify} />
            <div className="docs-grid2">
              <TextField id="docs-businessName" label={t("docs.studio.businessName")} {...f("brand.businessName")} autoComplete="organization" />
              <TextField id="docs-tagline" label={t("docs.studio.tagline")} {...f("brand.tagline")} placeholder={t("docs.studio.taglinePlaceholder")} />
            </div>
            <TextField id="docs-address" label={t("docs.studio.address")} {...f("brand.address")} multiline rows={2} autoComplete="street-address" />
            <div className="docs-grid2">
              <TextField id="docs-phone" label={t("docs.studio.phone")} {...f("brand.phone")} type="tel" autoComplete="tel" />
              <TextField id="docs-email" label={t("docs.studio.email")} {...f("brand.email")} type="email" autoComplete="email" />
              <TextField id="docs-website" label={t("docs.studio.website")} {...f("brand.website")} placeholder="www.mybusiness.com" autoComplete="url" />
              <TextField id="docs-taxId" label={t("docs.studio.taxId")} {...f("brand.taxId")} hint={t("docs.studio.taxIdHint")} />
            </div>
          </Accordion>

          <Accordion id="docs-sec-look" icon={SECTIONS[1].icon} title={t("docs.studio.sections.look")} summary={summaries.look} open={open.look} onToggle={() => toggleSection(SECTIONS[1])} errorCount={sectionErrors.look}>
            <ColorPalette id="docs-accent" value={draft.brand.accentColor} onChange={set("brand.accentColor")} error={errors["brand.accentColor"]} />
            <div className="docs-switch-list">
              <Toggle id="docs-opt-numbers" label={t("docs.studio.numberItems")} hint={t("docs.studio.numberItemsHint")} checked={draft.options.showItemNumbers} onChange={set("options.showItemNumbers")} />
              <Toggle id="docs-opt-words" label={t("docs.studio.totalWords")} hint={t("docs.studio.totalWordsHint")} checked={draft.options.showAmountInWords} onChange={set("options.showAmountInWords")} />
              <Toggle id="docs-opt-qr" label={t("docs.studio.qr")} hint={t("docs.studio.qrHint")} checked={draft.options.showQrCode} onChange={set("options.showQrCode")} />
            </div>
          </Accordion>

          <Accordion id="docs-sec-quotation" icon={SECTIONS[2].icon} title={t("docs.studio.sections.quotation")} summary={summaries.quotation} open={open.quotation} onToggle={() => toggleSection(SECTIONS[2])} errorCount={sectionErrors.quotation}>
            <div className="docs-grid2">
              <TextField id="docs-q-title" label={t("docs.studio.docTitle")} {...f("quotation.title")} />
              <TextField id="docs-q-prefix" label={t("docs.studio.prefix")} {...f("quotation.prefix")} onChange={(v) => set("quotation.prefix")(v.toUpperCase())} hint={t("docs.studio.prefixHint", { example: `${String(q.prefix || "QT").toUpperCase()}-${new Date().getFullYear()}-0001` })} />
              <TextField id="docs-q-days" label={t("docs.studio.validFor")} {...f("quotation.validityDays")} inputMode="numeric" suffix={t("docs.studio.days")} />
            </div>
            <TextField id="docs-q-intro" label={t("docs.studio.intro")} {...f("quotation.intro")} multiline rows={3} onReset={() => set("quotation.intro")(defaults.quotation.intro)} hint={t("docs.studio.introHint")} />
            <TextField id="docs-q-terms" label={t("docs.studio.terms")} {...f("quotation.terms")} multiline rows={6} onReset={() => set("quotation.terms")(defaults.quotation.terms)} hint={t("docs.studio.termsHint")} />
            <Toggle id="docs-q-sign" label={t("docs.studio.signature")} hint={t("docs.studio.signatureHint")} checked={q.showSignature} onChange={set("quotation.showSignature")} />
            {q.showSignature ? (
              <div className="docs-grid2">
                <TextField id="docs-q-sname" label={t("docs.studio.signName")} {...f("quotation.signatoryName")} placeholder={t("docs.studio.signNamePlaceholder")} />
                <TextField id="docs-q-stitle" label={t("docs.studio.signTitle")} {...f("quotation.signatoryTitle")} placeholder={t("docs.studio.signTitlePlaceholder")} />
              </div>
            ) : null}
          </Accordion>

          <Accordion id="docs-sec-receipt" icon={SECTIONS[3].icon} title={t("docs.studio.sections.receipt")} summary={summaries.receipt} open={open.receipt} onToggle={() => toggleSection(SECTIONS[3])} errorCount={sectionErrors.receipt}>
            <div className="docs-grid2">
              <TextField id="docs-r-title" label={t("docs.studio.docTitle")} {...f("receipt.title")} />
              <TextField id="docs-r-prefix" label={t("docs.studio.prefix")} {...f("receipt.prefix")} onChange={(v) => set("receipt.prefix")(v.toUpperCase())} hint={t("docs.studio.prefixHint", { example: `${String(draft.receipt.prefix || "RC").toUpperCase()}-${new Date().getFullYear()}-0001` })} />
            </div>
            <TextField id="docs-r-thanks" label={t("docs.studio.thanks")} {...f("receipt.thankYou")} multiline rows={3} onReset={() => set("receipt.thankYou")(defaults.receipt.thankYou)} />
            <TextField id="docs-r-foot" label={t("docs.studio.footerNote")} {...f("receipt.footerNote")} multiline rows={2} placeholder={t("docs.studio.footerPlaceholder")} />
          </Accordion>

          <Accordion id="docs-sec-tax" icon={SECTIONS[4].icon} title={t("docs.studio.sections.tax")} summary={summaries.tax} open={open.tax} onToggle={() => toggleSection(SECTIONS[4])} errorCount={sectionErrors.tax}>
            <Toggle id="docs-t-on" label={t("docs.studio.showVat")} hint={t("docs.studio.showVatHint")} checked={draft.tax.enabled} onChange={set("tax.enabled")} />
            {draft.tax.enabled ? (
              <>
                <div className="docs-grid2">
                  <TextField id="docs-t-label" label={t("docs.studio.taxLabel")} {...f("tax.label")} placeholder="VAT" />
                  <TextField id="docs-t-pct" label={t("docs.studio.rate")} {...f("tax.percent")} inputMode="decimal" suffix="%" />
                </div>
                <Toggle id="docs-t-inc" label={t("docs.studio.pricesIncludeTax")} hint={draft.tax.inclusive ? t("docs.studio.inclusiveHint") : t("docs.studio.exclusiveHint")} checked={draft.tax.inclusive} onChange={set("tax.inclusive")} />
              </>
            ) : null}
          </Accordion>

          <Accordion id="docs-sec-payment" icon={SECTIONS[5].icon} title={t("docs.studio.sections.payment")} summary={summaries.payment} open={open.payment} onToggle={() => toggleSection(SECTIONS[5])} errorCount={sectionErrors.payment}>
            <p className="docs-section-intro">{t("docs.studio.paymentIntro")}</p>
            <TextField id="docs-p-instr" label={t("docs.studio.paymentInstructions")} {...f("payment.instructions")} multiline rows={3} placeholder={t("docs.studio.paymentInstructionsPlaceholder")} />
            <div className="docs-grid2">
              <TextField id="docs-p-mm" label={t("docs.studio.mmNumber")} {...f("payment.mobileMoneyNumber")} type="tel" placeholder={t("docs.studio.mmNumberPlaceholder")} />
              <TextField id="docs-p-mmname" label={t("docs.studio.mmName")} {...f("payment.mobileMoneyName")} />
            </div>
            <TextField id="docs-p-bank" label={t("docs.studio.bank")} {...f("payment.bankDetails")} multiline rows={3} placeholder={t("docs.studio.bankPlaceholder")} />
          </Accordion>

          <Accordion id="docs-sec-email" icon={SECTIONS[6].icon} title={t("docs.studio.sections.email")} summary={summaries.email} open={open.email} onToggle={() => toggleSection(SECTIONS[6])} errorCount={sectionErrors.email}>
            <div className="docs-switch-list">
              <Toggle id="docs-e-q" label={t("docs.studio.emailQuote")} hint={t("docs.studio.emailQuoteHint")} checked={draft.email.sendQuotation} onChange={set("email.sendQuotation")} />
              <Toggle id="docs-e-r" label={t("docs.studio.emailReceipt")} hint={t("docs.studio.emailReceiptHint")} checked={draft.email.sendReceipt} onChange={set("email.sendReceipt")} />
            </div>
            <p className="docs-hint">{t("docs.studio.emailNote")}</p>
          </Accordion>
        </div>

        <DocumentPreview draft={normalizedDraft} patch={previewPatch} valid={valid} active={active} type={previewType} onTypeChange={setPreviewType} />
      </div>

      <div className={`docs-savebar${dirty ? " is-dirty" : ""}`} role="region" aria-label={t("docs.studio.saveRegion")}>
        <p className="docs-save-status" role="status" aria-live="polite">
          {saving ? <><span className="docs-spinner" aria-hidden="true" /> {t("docs.studio.saving")}</> : dirty ? <><span className="docs-dot is-warn" aria-hidden="true" /> {t("docs.studio.unsaved")}</> : <><span className="docs-dot is-ok" aria-hidden="true" /> {t("docs.studio.allSaved")}</>}
        </p>
        <div className="docs-save-actions">
          <button type="button" className="docs-btn" onClick={discard} disabled={!dirty || saving}>{t("docs.studio.discard")}</button>
          <button type="button" className="docs-btn is-primary" onClick={save} disabled={!dirty || saving}>{saving ? t("docs.studio.saving") : t("docs.studio.saveChanges")}</button>
        </div>
      </div>

      {toast ? (
        <div className={`docs-toast is-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t("docs.studio.dismiss")}>×</button>
        </div>
      ) : null}
    </div>
  );
}
