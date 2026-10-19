import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { emailStatusInfo, getDocumentSettings, issueOrderQuotation, listDocuments, openDocumentPdf } from "../../lib/documents";
import { formatUgx } from "../../lib/format";
import { IconClose } from "../icons";
import { Skel } from "../Skeleton";

const NOTE_MAX = 600;
const num = (value) => {
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Mirrors the server's computeTotals so the seller sees the buyer's total before sending.
export const computeQuoteTotals = ({ subtotal, discount, deliveryFee, tax }) => {
  const off = Math.min(subtotal, discount);
  const base = Math.max(0, subtotal - off + deliveryFee);
  if (!tax?.enabled || !Number(tax.percent)) return { subtotal, discount: off, deliveryFee, base, tax: null, total: base };
  const pct = Number(tax.percent);
  const amount = Math.round(tax.inclusive ? (base * pct) / (100 + pct) : (base * pct) / 100);
  return { subtotal, discount: off, deliveryFee, base, tax: { label: tax.label || "VAT", percent: pct, inclusive: Boolean(tax.inclusive), amount }, total: tax.inclusive ? base : base + amount };
};

// "Edit & send quotation" for an unpaid cash order: adjust delivery, discount, note and validity, then issue a
// new revision of the quotation and email it to the buyer.
export default function QuotationModal({ order, onClose, onIssued }) {
  const { t } = useTranslation();
  const subtotal = useMemo(() => (order.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0), [order.items]);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [validityDays, setValidityDays] = useState("");
  const [send, setSend] = useState(true);
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [opening, setOpening] = useState(false);
  const dialogRef = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getDocumentSettings()
      .then((res) => {
        if (!alive) return;
        setSettings(res.settings);
        setValidityDays((v) => v || String(res.settings.quotation.validityDays));
        setSend(res.settings.email.sendQuotation !== false);
      })
      .catch(() => alive && setSettingsError(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    firstRef.current?.focus();
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled])");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [onClose, submitting]);

  const discountValue = num(discount);
  const feeValue = num(deliveryFee);
  const totals = computeQuoteTotals({ subtotal, discount: discountValue, deliveryFee: feeValue, tax: settings?.tax });
  const discountTooBig = discountValue > subtotal;
  const days = Number(validityDays);
  const daysInvalid = validityDays !== "" && (!Number.isInteger(days) || days < 1 || days > 365);
  const noteOver = note.trim().length > NOTE_MAX;
  const blocked = discountTooBig || daysInvalid || noteOver;

  const submit = async (event) => {
    event.preventDefault();
    if (blocked) return;
    setSubmitting(true);
    setError("");
    try {
      const doc = await issueOrderQuotation(order.id, {
        discount: discountValue,
        deliveryFee: feeValue,
        note: note.trim(),
        ...(validityDays !== "" ? { validityDays: days } : {}),
        send
      });
      // The create response is returned before the email result is recorded on it, so read the stored status back.
      let status = null;
      let emailedTo = doc.emailedTo;
      try {
        const latest = await listDocuments({ type: "quotation", limit: 10 });
        const stored = (latest.items || []).find((item) => item.id === doc.id);
        status = stored?.emailStatus ?? null;
        emailedTo = stored?.emailedTo ?? emailedTo;
      } catch {
        /* the quotation is issued either way */
      }
      setResult({ doc, status, emailedTo, requested: send });
      onIssued?.(doc);
    } catch (submitError) {
      setError(
        submitError.code === "ORDER_ALREADY_PAID"
          ? t("docs.quote.errAlreadyPaid")
          : submitError.message || t("docs.quote.errSend")
      );
      if (submitError.code === "ORDER_ALREADY_PAID") onIssued?.(null);
    } finally {
      setSubmitting(false);
    }
  };

  const view = async () => {
    setOpening(true);
    try {
      await openDocumentPdf(result.doc);
    } catch (viewError) {
      setError(viewError.message || t("docs.quote.errOpenPdf"));
    } finally {
      setOpening(false);
    }
  };

  const resultInfo = result ? emailStatusInfo(result.status, result.emailedTo) : null;
  const revLabel = result ? `${result.doc.number}${result.doc.revision > 1 ? ` ${t("docs.quote.rev", { n: result.doc.revision })}` : ""}` : "";

  return (
    <div className="modal-overlay docs-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div className="docs-modal" role="dialog" aria-modal="true" aria-labelledby="docs-modal-title" ref={dialogRef}>
        <button type="button" className="docs-modal-close" onClick={onClose} aria-label={t("docs.quote.close")} disabled={submitting}><IconClose /></button>

        {result ? (
          <div className="docs-modal-done">
            <span className={`docs-done-mark is-${result.status === "sent" ? "ok" : "warn"}`} aria-hidden="true">{result.status === "sent" ? "✓" : "!"}</span>
            <h2 id="docs-modal-title">{result.status === "sent" ? t("docs.quote.sentTitle", { label: revLabel }) : t("docs.quote.savedTitle", { label: revLabel })}</h2>
            <p>
              {result.status === "sent"
                ? t("docs.quote.sentBody", { detail: resultInfo.detail })
                : result.requested
                  ? t("docs.quote.notEmailed", { detail: resultInfo.detail })
                  : t("docs.quote.choseNoEmail")}
            </p>
            <div className="docs-modal-actions">
              <button type="button" className="docs-btn" onClick={view} disabled={opening}>{opening ? t("docs.opening") : t("docs.viewPdf")}</button>
              <button type="button" className="docs-btn is-primary" onClick={onClose}>{t("docs.quote.done")}</button>
            </div>
            {error ? <p className="docs-error" role="alert">{error}</p> : null}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="docs-modal-title">{t("docs.quote.title")}</h2>
            <p className="docs-modal-sub">{t("docs.quote.sub")}</p>

            <div className="docs-grid2">
              <div className="docs-field">
                <label className="docs-label" htmlFor="docs-m-fee">{t("docs.quote.deliveryFee")}</label>
                <div className="docs-input-wrap">
                  <input id="docs-m-fee" ref={firstRef} className="docs-input" inputMode="numeric" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
                  <span className="docs-input-suffix" aria-hidden="true">UGX</span>
                </div>
              </div>
              <div className="docs-field">
                <label className="docs-label" htmlFor="docs-m-discount">{t("docs.quote.discount")}</label>
                <div className="docs-input-wrap">
                  <input id="docs-m-discount" className={`docs-input${discountTooBig ? " is-invalid" : ""}`} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" aria-invalid={discountTooBig ? "true" : undefined} aria-describedby={discountTooBig ? "docs-m-discount-err" : undefined} />
                  <span className="docs-input-suffix" aria-hidden="true">UGX</span>
                </div>
                {discountTooBig ? <p id="docs-m-discount-err" className="docs-error" role="alert">{t("docs.quote.discountTooBig", { amount: formatUgx(subtotal) })}</p> : null}
              </div>
              <div className="docs-field">
                <label className="docs-label" htmlFor="docs-m-days">{t("docs.quote.validFor")}</label>
                <div className="docs-input-wrap">
                  <input id="docs-m-days" className={`docs-input${daysInvalid ? " is-invalid" : ""}`} inputMode="numeric" value={validityDays} onChange={(e) => setValidityDays(e.target.value.replace(/\D/g, ""))} placeholder={settings ? String(settings.quotation.validityDays) : "14"} aria-invalid={daysInvalid ? "true" : undefined} aria-describedby={daysInvalid ? "docs-m-days-err" : undefined} />
                  <span className="docs-input-suffix" aria-hidden="true">{t("docs.quote.days")}</span>
                </div>
                {daysInvalid ? <p id="docs-m-days-err" className="docs-error" role="alert">{t("docs.quote.daysInvalid")}</p> : null}
              </div>
            </div>

            <div className="docs-field">
              <div className="docs-label-row"><label className="docs-label" htmlFor="docs-m-note">{t("docs.quote.note")}</label></div>
              <textarea id="docs-m-note" className={`docs-input${noteOver ? " is-invalid" : ""}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("docs.quote.notePlaceholder")} />
              <div className="docs-field-foot"><span /><span className={`docs-counter${noteOver ? " is-over" : ""}`}>{note.trim().length}/{NOTE_MAX}</span></div>
            </div>

            <div className="docs-totals" aria-live="polite" aria-label={t("docs.quote.totalPreview")}>
              <div className="docs-totals-row"><span>{t("docs.quote.items", { count: (order.items || []).length })}</span><span>{formatUgx(subtotal)}</span></div>
              {totals.discount > 0 ? <div className="docs-totals-row is-minus"><span>{t("docs.quote.discount")}</span><span>− {formatUgx(totals.discount)}</span></div> : null}
              {totals.deliveryFee > 0 ? <div className="docs-totals-row"><span>{t("docs.quote.deliveryFee")}</span><span>{formatUgx(totals.deliveryFee)}</span></div> : null}
              {!settings && !settingsError ? (
                <div className="docs-totals-row"><Skel h={12} w={120} /><Skel h={12} w={70} /></div>
              ) : totals.tax ? (
                <div className="docs-totals-row is-muted"><span>{totals.tax.label} {totals.tax.percent}% {totals.tax.inclusive ? t("docs.quote.included") : ""}</span><span>{totals.tax.inclusive ? "" : "+ "}{formatUgx(totals.tax.amount)}</span></div>
              ) : null}
              <div className="docs-totals-row is-total"><span>{t("docs.quote.totalBuyer")}</span><strong>{formatUgx(totals.total)}</strong></div>
              {settingsError ? <p className="docs-hint">{t("docs.quote.taxLoadFailed")}</p> : null}
            </div>

            <label className="docs-check" htmlFor="docs-m-send">
              <input id="docs-m-send" type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
              <span>{t("docs.quote.emailNow")}</span>
            </label>
            {settings && settings.email.sendQuotation === false && send ? (
              <p className="docs-hint">{t("docs.quote.autoOff")}</p>
            ) : null}

            {error ? <p className="docs-error docs-modal-error" role="alert">{error}</p> : null}

            <div className="docs-modal-actions">
              <button type="button" className="docs-btn" onClick={onClose} disabled={submitting}>{t("docs.quote.cancel")}</button>
              <button type="submit" className="docs-btn is-primary" disabled={submitting || blocked}>{submitting ? t("docs.quote.sending") : t("docs.quote.send")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
