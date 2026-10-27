import React, { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { saveUnlockedContactId } from "../lib/unlockedContacts";
import { formatUgx } from "../lib/format";
import { IconClose } from "./icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

export default function UnlockModal({ providerId, providerName, fee, onClose, onUnlocked }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("form"); // form | waiting | succeeded | failed
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(null);
  const transactionIdRef = useRef(null);
  const contactUnlockIdRef = useRef(null);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const poll = async () => {
    if (!transactionIdRef.current) return;
    try {
      const result = await request(`/payments/transactions/${transactionIdRef.current}/status`);
      if (result.status === "succeeded") {
        setRevealed({ contact: result.contact, location: result.location });
        setStage("succeeded");
        // Keep this device unlocked for this provider on future visits, even without an account —
        // this is the only proof of payment an anonymous visitor has.
        if (contactUnlockIdRef.current) {
          saveUnlockedContactId(providerId, contactUnlockIdRef.current);
        }
        // Hand over what the payment just revealed, so the page shows it at once instead of asking the server again.
        onUnlocked?.({ contact: result.contact, location: result.location });
        return;
      }
      if (result.status === "failed") {
        setStage("failed");
        return;
      }
    } catch {
      // Keep polling — a transient network hiccup shouldn't end the wait.
    }
    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLLS) {
      setStage("timeout");
      return;
    }
    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!phone.trim()) {
      setError(t("unlock.errPhone"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await request("/payments/contacts/unlock", {
        method: "POST",
        body: JSON.stringify({ providerId, phone: phone.trim() })
      });
      transactionIdRef.current = result.transactionId;
      contactUnlockIdRef.current = result.contactUnlockId;
      pollCountRef.current = 0;
      setStage("waiting");
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (submitError) {
      setError(submitError.message || t("unlock.startFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const checkAgain = () => {
    pollCountRef.current = 0;
    setStage("waiting");
    poll();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t("form.close")}>
          <IconClose />
        </button>

        {stage === "form" ? (
          <>
            <h2>{t("unlock.title")}</h2>
            <p>
              {providerName ? (
                <Trans i18nKey="unlock.intro" values={{ name: providerName }} components={{ strong: <strong /> }} />
              ) : (
                t("unlock.introNoName")
              )}
            </p>
            <div className="unlock-summary">
              <div className="unlock-summary-row">
                <span>{t("unlock.unlocking")}</span>
                <strong>{t("unlock.unlockingItem", { name: providerName || t("unlock.provider") })}</strong>
              </div>
              <div className="unlock-summary-row">
                <span>{t("unlock.fee")}</span>
                <strong>{formatUgx(fee)}</strong>
              </div>
              <div className="unlock-summary-row total">
                <span>{t("unlock.total")}</span>
                <strong>{formatUgx(fee)}</strong>
              </div>
            </div>
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              <label className="field">
                <span>{t("payment.phoneLabel")}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("form.phonePlaceholder")} required />
              </label>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? t("payment.starting") : t("payment.payWithMomo")}
              </button>
            </form>
            <p className="modal-hint">{t("unlock.noAccount")}</p>
          </>
        ) : stage === "waiting" ? (
          <>
            <h2>{t("payment.approveTitle")}</h2>
            <p>{t("unlock.approveBody", { phone })}</p>
            <p className="modal-hint">{t("payment.waiting")}</p>
          </>
        ) : stage === "succeeded" ? (
          <>
            <h2>{t("unlock.unlocked")}</h2>
            <p>{t("unlock.confirmed")}</p>
            {revealed ? (
              <div className="unlock-summary">
                {revealed.contact?.phone ? (
                  <div className="unlock-summary-row"><span>{t("unlock.phone")}</span><strong>{revealed.contact.phone}</strong></div>
                ) : null}
                {revealed.contact?.whatsapp ? (
                  <div className="unlock-summary-row"><span>WhatsApp</span><strong>{revealed.contact.whatsapp}</strong></div>
                ) : null}
                {revealed.contact?.website ? (
                  <div className="unlock-summary-row"><span>{t("unlock.website")}</span><strong>{revealed.contact.website}</strong></div>
                ) : null}
                {revealed.location?.address ? (
                  <div className="unlock-summary-row"><span>{t("unlock.address")}</span><strong>{revealed.location.address}</strong></div>
                ) : null}
              </div>
            ) : null}
            <div className="unlock-actions">
              {revealed?.contact?.phone ? <a className="primary-button" href={`tel:${revealed.contact.phone}`}>{t("unlock.callNow")}</a> : null}
              {revealed?.contact?.whatsapp ? (
                <a className="secondary-button" href={`https://wa.me/${String(revealed.contact.whatsapp).replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
              ) : null}
            </div>
            <button type="button" className="payment-option" onClick={onClose}>{t("form.done")}</button>
          </>
        ) : stage === "failed" ? (
          <>
            <h2>{t("payment.failedShort")}</h2>
            <p>{t("unlock.failedBody")}</p>
            <button type="button" className="primary-button" onClick={() => setStage("form")}>{t("payment.tryAgain")}</button>
          </>
        ) : (
          <>
            <h2>{t("payment.timeoutTitle")}</h2>
            <p>{t("payment.timeoutBody")}</p>
            <div className="payment-options">
              <button type="button" className="payment-option" onClick={checkAgain}>{t("payment.checkAgain")}</button>
              <button type="button" className="payment-option" onClick={() => setStage("form")}>{t("payment.tryAgain")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
