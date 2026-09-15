import React, { useEffect, useRef, useState } from "react";

import { request } from "../lib/api";
import { IconClose } from "./icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

export default function SubscriptionModal({ fee, onClose, onActivated }) {
  const [phone, setPhone] = useState("");
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
        onActivated?.();
        return;
      }
      if (result.status === "failed") {
        setStage("failed");
        return;
      }
    } catch {
      // Transient network hiccup — keep polling.
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
      setError("Enter the phone number to pay from.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await request("/payments/subscriptions/activate", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() })
      });
      transactionIdRef.current = result.transactionId;
      pollCountRef.current = 0;
      setStage("waiting");
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (submitError) {
      setError(submitError.message || "Unable to start the payment.");
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
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>

        {stage === "form" ? (
          <>
            <h2>Renew your subscription</h2>
            {Number(fee) > 0 ? <p className="modal-hint">UGX {Number(fee).toLocaleString()} for 30 days</p> : null}
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              <label className="field">
                <span>Mobile money number</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +256 700 000000" required />
              </label>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? "Starting payment…" : "Pay with Mobile Money"}
              </button>
            </form>
          </>
        ) : stage === "waiting" ? (
          <>
            <h2>Approve on your phone</h2>
            <p>We sent a mobile money prompt to {phone}. Approve it to activate your subscription.</p>
            <p className="modal-hint">Waiting for confirmation…</p>
          </>
        ) : stage === "succeeded" ? (
          <>
            <h2>Subscription active</h2>
            <p>Your payment was confirmed and your subscription has been renewed.</p>
            <button type="button" className="primary-button" onClick={onClose}>Done</button>
          </>
        ) : stage === "failed" ? (
          <>
            <h2>Payment failed</h2>
            <p>The mobile money payment wasn&apos;t completed. You can try again.</p>
            <button type="button" className="primary-button" onClick={() => setStage("form")}>Try again</button>
          </>
        ) : (
          <>
            <h2>Still waiting</h2>
            <p>We haven&apos;t heard back yet. If you already approved the prompt, check again — otherwise try again.</p>
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
