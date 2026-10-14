import React, { useEffect, useRef, useState } from "react";

import { request } from "../lib/api";
import { formatUgx } from "../lib/format";
import { IconClose } from "./icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

// Pay for something the seller or provider has already accepted: ask for the mobile money number, wait for the
// prompt to be approved, then say so. `endpoint` starts the charge and returns { transactionId }.
export default function PaymentModal({ title, amount, summary, endpoint, defaultPhone = "", onClose, onPaid }) {
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
      setError("Enter the mobile money number to pay from.");
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
      setError(submitError.message || "We couldn't start the payment.");
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
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
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
                <span>Mobile money number</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0772 123 456" inputMode="tel" required autoFocus />
              </label>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? "Starting payment…" : `Pay ${formatUgx(amount)}`}
              </button>
            </form>
          </>
        ) : stage === "waiting" ? (
          <>
            <h2>Approve on your phone</h2>
            <p>We sent a mobile money prompt to {phone}. Approve it to finish paying.</p>
            <p className="modal-hint">Waiting for confirmation…</p>
          </>
        ) : stage === "succeeded" ? (
          <>
            <h2>Payment received</h2>
            <p>Thank you. {summary || "The seller has been told."}</p>
            <button type="button" className="primary-button" onClick={onClose}>Done</button>
          </>
        ) : stage === "failed" ? (
          <>
            <h2>Payment didn&apos;t go through</h2>
            <p>The mobile money payment wasn&apos;t completed. Nothing was taken. You can try again.</p>
            <button type="button" className="primary-button" onClick={() => setStage("form")}>Try again</button>
          </>
        ) : (
          <>
            <h2>Still waiting</h2>
            <p>We haven&apos;t heard back yet. If you already approved the prompt, check again; otherwise try again.</p>
            <div className="payment-options">
              <button type="button" className="payment-option" onClick={checkAgain}>Check again</button>
              <button type="button" className="payment-option" onClick={() => setStage("form")}>Try again</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
