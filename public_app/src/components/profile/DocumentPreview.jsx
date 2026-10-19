import React, { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

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

const TYPES = ["quotation", "receipt"];

const TypeToggle = ({ type, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="docs-type-toggle" role="group" aria-label={t("docs.preview.typeAria")}>
      {TYPES.map((key) => (
        <button key={key} type="button" className={type === key ? "is-active" : ""} aria-pressed={type === key} onClick={() => onChange(key)}>
          {t(`docs.type.${key}`)}
        </button>
      ))}
    </div>
  );
};

// A tiny HTML miniature of the document so phones (which can't show PDFs inline) still get instant feedback.
const PaperMock = ({ settings, type }) => {
  const { t } = useTranslation();
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
        <span className="docs-paper-name">{brand.businessName || t("docs.preview.yourBusiness")}</span>
        <span className="docs-paper-title">{title || t("docs.type.document")}</span>
      </div>
      <div className="docs-paper-body">
        <div className="docs-paper-meta">
          <span>{String(prefix || "").toUpperCase()}-2026-0042</span>
          <span>{t("docs.preview.preparedFor", { name: "Aisha N." })}</span>
        </div>
        <div className="docs-paper-line" /><div className="docs-paper-line" /><div className="docs-paper-line is-short" />
        <div className="docs-paper-total" style={{ background: accent }}><span>{t("docs.preview.total")}</span><strong>UGX 1,250,000</strong></div>
      </div>
    </div>
  );
};

// Live PDF preview of the UNSAVED draft. Desktop: an inline viewer that refreshes (debounced) while editing.
// Phones/tablets: a preview card with an "Open PDF" button, because mobile browsers can't inline PDFs.
export default function DocumentPreview({ draft, patch, valid, type, onTypeChange, active = true }) {
  const { t } = useTranslation();
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
        setView((v) => ({ ...v, status: "error", error: error.message || t("docs.preview.errBuild") }));
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
      setOpenError(error.message || t("docs.preview.errBuild"));
    } finally {
      setOpening(false);
    }
  };

  const label = t(type === "receipt" ? "docs.preview.labelReceipt" : "docs.preview.labelQuotation");

  return (
    <aside className="docs-preview" aria-label={t("docs.preview.aria")}>
      <div className="docs-preview-bar">
        <TypeToggle type={type} onChange={onTypeChange} />
        {!compact ? (
          <button type="button" className="docs-open-link" onClick={openPreview} disabled={opening || !valid}>
            {opening ? t("docs.opening") : t("docs.preview.openLink")}
          </button>
        ) : null}
      </div>

      {compact ? (
        <div className="docs-preview-card">
          <PaperMock settings={draft} type={type} />
          <p className="docs-preview-note">
            <Trans i18nKey="docs.preview.note" values={{ label }} components={{ b: <strong /> }} />
          </p>
          <button type="button" className="docs-preview-cta" onClick={openPreview} disabled={opening || !valid}>
            {opening ? t("docs.preview.building") : t("docs.preview.open")}
          </button>
          {!valid ? <p className="docs-error">{t("docs.preview.fixFields")}</p> : null}
          {openError ? <p className="docs-error" role="alert">{openError}</p> : null}
          <p className="docs-hint">{t("docs.preview.sample")}</p>
        </div>
      ) : (
        <div className="docs-preview-stage" aria-busy={view.status === "loading" || view.status === "updating"}>
          {view.url ? (
            <iframe title={t("docs.preview.liveTitle", { label })} className="docs-preview-frame" src={`${view.url}#toolbar=0&navpanes=0&view=FitH`} />
          ) : view.status === "error" ? null : (
            <div className="docs-preview-skel" role="status">
              <span className="sr-only">{t("docs.preview.buildingPreview")}</span>
              <Skel h={64} w="100%" r={10} />
              <div className="docs-preview-skel-row"><Skel h={90} w="100%" r={10} /><Skel h={90} w="100%" r={10} /></div>
              <Skel h={26} w="100%" r={8} />
              <Skel h={18} w="92%" r={6} /><Skel h={18} w="86%" r={6} /><Skel h={18} w="90%" r={6} />
              <Skel h={44} w="45%" r={10} style={{ marginLeft: "auto" }} />
              <Skel h={80} w="100%" r={10} />
            </div>
          )}
          {view.status === "updating" ? <div className="docs-preview-updating" role="status"><span className="docs-spinner" aria-hidden="true" /> {t("docs.preview.updating")}</div> : null}
          {!valid ? (
            <div className="docs-preview-paused" role="status">{t("docs.preview.paused")}</div>
          ) : null}
          {view.status === "error" && valid ? (
            <div className="docs-preview-error" role="alert">
              <IconReceipt />
              <p>{view.error}</p>
            </div>
          ) : null}
        </div>
      )}
      <p className="docs-preview-foot"><Trans i18nKey="docs.preview.foot" components={{ b: <strong /> }} /></p>
    </aside>
  );
}
