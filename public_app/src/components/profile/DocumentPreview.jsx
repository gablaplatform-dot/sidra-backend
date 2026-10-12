import React, { useEffect, useRef, useState } from "react";

import { fetchPreviewPdf, openPdfWith } from "../../lib/documents";
import { IconReceipt } from "../icons";
import { Skel } from "../Skeleton";
import { monogram } from "./docsModel";

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);
  return matches;
};

const TYPES = [
  { key: "quotation", label: "Quotation" },
  { key: "receipt", label: "Receipt" }
];

const TypeToggle = ({ type, onChange }) => (
  <div className="docs-type-toggle" role="group" aria-label="Preview document type">
    {TYPES.map((item) => (
      <button key={item.key} type="button" className={type === item.key ? "is-active" : ""} aria-pressed={type === item.key} onClick={() => onChange(item.key)}>
        {item.label}
      </button>
    ))}
  </div>
);

// A tiny HTML miniature of the document so phones (which can't show PDFs inline) still get instant feedback.
const PaperMock = ({ settings, type }) => {
  const { brand, quotation, receipt } = settings;
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accentColor) ? brand.accentColor : "#0b2046";
  const title = type === "receipt" ? receipt.title : quotation.title;
  const prefix = type === "receipt" ? receipt.prefix : quotation.prefix;
  return (
    <div className="docs-paper" aria-hidden="true">
      <div className="docs-paper-head" style={{ background: accent }}>
        <span className="docs-paper-logo">
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : monogram(brand.businessName)}
        </span>
        <span className="docs-paper-name">{brand.businessName || "Your business"}</span>
        <span className="docs-paper-title">{title || "Document"}</span>
      </div>
      <div className="docs-paper-body">
        <div className="docs-paper-meta">
          <span>{String(prefix || "").toUpperCase()}-2026-0042</span>
          <span>Prepared for Aisha N.</span>
        </div>
        <div className="docs-paper-line" /><div className="docs-paper-line" /><div className="docs-paper-line is-short" />
        <div className="docs-paper-total" style={{ background: accent }}><span>Total</span><strong>UGX 1,250,000</strong></div>
      </div>
    </div>
  );
};

// Live PDF preview of the UNSAVED draft. Desktop: an inline viewer that refreshes (debounced) while editing.
// Phones/tablets: a preview card with an "Open PDF" button, because mobile browsers can't inline PDFs.
export default function DocumentPreview({ draft, patch, valid, type, onTypeChange, active = true }) {
  const compact = useMediaQuery("(max-width: 900px), (pointer: coarse)");
  // Only the edited settings are sent; the server fills in everything else (saved settings, then profile).
  const payload = JSON.stringify(patch);
  const [view, setView] = useState({ url: null, status: "loading", error: "" });
  const urlRef = useRef(null);
  const [openError, setOpenError] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  useEffect(() => {
    if (compact || !valid || !active) return undefined;
    const controller = new AbortController();
    setView((v) => ({ ...v, status: v.url ? "updating" : "loading", error: "" }));
    const timer = setTimeout(async () => {
      try {
        const blob = await fetchPreviewPdf(type, JSON.parse(payload), { signal: controller.signal });
        const next = URL.createObjectURL(blob);
        const previous = urlRef.current;
        urlRef.current = next;
        setView({ url: next, status: "ready", error: "" });
        if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1500);
      } catch (error) {
        if (error.name === "AbortError") return;
        setView((v) => ({ ...v, status: "error", error: error.message || "Unable to build the preview." }));
      }
    }, urlRef.current ? 600 : 50);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [type, payload, compact, valid, active]);

  const openPreview = async () => {
    setOpenError("");
    setOpening(true);
    try {
      await openPdfWith(() => fetchPreviewPdf(type, JSON.parse(payload)), `${type}-preview.pdf`);
    } catch (error) {
      setOpenError(error.message || "Unable to build the preview.");
    } finally {
      setOpening(false);
    }
  };

  const label = type === "receipt" ? "receipt" : "quotation";

  return (
    <aside className="docs-preview" aria-label="Document preview">
      <div className="docs-preview-bar">
        <TypeToggle type={type} onChange={onTypeChange} />
        {!compact ? (
          <button type="button" className="docs-open-link" onClick={openPreview} disabled={opening || !valid}>
            {opening ? "Opening…" : "Open preview PDF ↗"}
          </button>
        ) : null}
      </div>

      {compact ? (
        <div className="docs-preview-card">
          <PaperMock settings={draft} type={type} />
          <p className="docs-preview-note">
            Phones can&apos;t show PDFs inside the page. Tap below to see your <strong>{label}</strong> exactly as the buyer will receive it, using the changes you&apos;ve made so far.
          </p>
          <button type="button" className="docs-preview-cta" onClick={openPreview} disabled={opening || !valid}>
            {opening ? "Building PDF…" : `Open preview PDF`}
          </button>
          {!valid ? <p className="docs-error">Fix the highlighted fields to preview.</p> : null}
          {openError ? <p className="docs-error" role="alert">{openError}</p> : null}
          <p className="docs-hint">Sample content is used for the items and buyer.</p>
        </div>
      ) : (
        <div className="docs-preview-stage" aria-busy={view.status === "loading" || view.status === "updating"}>
          {view.url ? (
            <iframe title={`Live ${label} preview`} className="docs-preview-frame" src={`${view.url}#toolbar=0&navpanes=0&view=FitH`} />
          ) : view.status === "error" ? null : (
            <div className="docs-preview-skel" role="status">
              <span className="sr-only">Building preview…</span>
              <Skel h={64} w="100%" r={10} />
              <div className="docs-preview-skel-row"><Skel h={90} w="100%" r={10} /><Skel h={90} w="100%" r={10} /></div>
              <Skel h={26} w="100%" r={8} />
              <Skel h={18} w="92%" r={6} /><Skel h={18} w="86%" r={6} /><Skel h={18} w="90%" r={6} />
              <Skel h={44} w="45%" r={10} style={{ marginLeft: "auto" }} />
              <Skel h={80} w="100%" r={10} />
            </div>
          )}
          {view.status === "updating" ? <div className="docs-preview-updating" role="status"><span className="docs-spinner" aria-hidden="true" /> Updating preview…</div> : null}
          {!valid ? (
            <div className="docs-preview-paused" role="status">Preview paused — fix the highlighted fields to refresh it.</div>
          ) : null}
          {view.status === "error" && valid ? (
            <div className="docs-preview-error" role="alert">
              <IconReceipt />
              <p>{view.error}</p>
            </div>
          ) : null}
        </div>
      )}
      <p className="docs-preview-foot">Preview uses sample items and your <strong>unsaved</strong> changes.</p>
    </aside>
  );
}
