import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { formatUgx } from "../lib/format";
import { IconClose } from "./icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

// Pay for something the seller or provider has already accepted: ask for the mobile money number, wait for the
// prompt to be approved, then say so. `endpoint` starts the charge and returns { transactionId }.
export default function PaymentModal({ title, amount, summary, endpoint, defaultPhone = "", onClose, onPaid }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(defaultPhone);
  const [stage, setStage] = useState("form"); // form | waiting | succeeded | failed | timeout
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const transactionIdRef = useRef(null);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const poll = async () => {
    if (!transactionIdRef.current) return;
    try {
      const result = await request(`/payments/transactions/${transactionIdRef.current}/status`);
      if (result.status === "succeeded") {
        setStage("succeeded");
        onPaid?.();
        return;
      }
      if (result.status === "failed") {
        setStage("failed");
        return;
      }
    } catch {
      // A hiccup shouldn't end the wait.
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
    if (phone.replace(/\D/g, "").length < 9) {
      setError(t("payment.errPhone"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await request(endpoint, { method: "POST", body: JSON.stringify({ phone: phone.trim() }) });
      transactionIdRef.current = result.transactionId;
      pollCountRef.current = 0;
      setStage("waiting");
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (submitError) {
      setError(submitError.message || t("payment.startFailed"));
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
    <div className="modal-overlay" onClick={stage === "waiting" ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label={t("form.close")}>
          <IconClose />
        </button>

        {stage === "form" ? (
          <>
            <h2>{title}</h2>
            {summary ? <p className="modal-hint">{summary}</p> : null}
            <p className="pay-amount">{formatUgx(amount)}</p>
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              <label className="field">
                <span>{t("payment.phoneLabel")}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("payment.phonePlaceholder")} inputMode="tel" required autoFocus />
              </label>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? t("payment.starting") : t("payment.pay", { amount: formatUgx(amount) })}
              </button>
            </form>
          </>
        ) : stage === "waiting" ? (
          <>
            <h2>{t("payment.approveTitle")}</h2>
            <p>{t("payment.approveBody", { phone })}</p>
            <p className="modal-hint">{t("payment.waiting")}</p>
          </>
        ) : stage === "succeeded" ? (
          <>
            <h2>{t("payment.receivedTitle")}</h2>
            <p>{t("payment.thanks")} {summary || t("payment.sellerTold")}</p>
            <button type="button" className="primary-button" onClick={onClose}>{t("form.done")}</button>
          </>
        ) : stage === "failed" ? (
          <>
            <h2>{t("payment.failedTitle")}</h2>
            <p>{t("payment.failedBody")}</p>
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
