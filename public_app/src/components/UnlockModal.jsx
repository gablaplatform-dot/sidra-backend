import React, { useEffect, useRef, useState } from "react";

import { request } from "../lib/api";
import { saveUnlockedContactId } from "../lib/unlockedContacts";
import { IconClose } from "./icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;

export default function UnlockModal({ providerId, providerName, fee, onClose, onUnlocked }) {
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
        onUnlocked?.();
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
      setError("Enter the phone number to pay from.");
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
            <h2>Unlock contact &amp; location</h2>
            <p>Pay by mobile money to view {providerName ? <strong>{providerName}&apos;s</strong> : "this provider's"} phone, WhatsApp, website and exact address.</p>
            <div className="unlock-summary">
              <div className="unlock-summary-row">
                <span>Unlocking</span>
                <strong>{providerName || "Provider"} contact &amp; location</strong>
              </div>
              <div className="unlock-summary-row">
                <span>Unlock fee</span>
                <strong>{formatUgx(fee)}</strong>
              </div>
              <div className="unlock-summary-row total">
                <span>Total to pay</span>
                <strong>{formatUgx(fee)}</strong>
              </div>
            </div>
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
            <p className="modal-hint">No account needed — you don&apos;t have to sign in to pay. More payment methods are coming soon.</p>
          </>
        ) : stage === "waiting" ? (
          <>
            <h2>Approve on your phone</h2>
            <p>We sent a mobile money prompt to {phone}. Approve it to unlock this provider&apos;s contact details.</p>
            <p className="modal-hint">Waiting for confirmation…</p>
          </>
        ) : stage === "succeeded" ? (
          <>
            <h2>Unlocked!</h2>
            <p>Payment confirmed — here are the details:</p>
            {revealed ? (
              <div className="unlock-summary">
                {revealed.contact?.phone ? (
                  <div className="unlock-summary-row"><span>Phone</span><strong>{revealed.contact.phone}</strong></div>
                ) : null}
                {revealed.contact?.whatsapp ? (
                  <div className="unlock-summary-row"><span>WhatsApp</span><strong>{revealed.contact.whatsapp}</strong></div>
                ) : null}
                {revealed.contact?.website ? (
                  <div className="unlock-summary-row"><span>Website</span><strong>{revealed.contact.website}</strong></div>
                ) : null}
                {revealed.location?.address ? (
                  <div className="unlock-summary-row"><span>Address</span><strong>{revealed.location.address}</strong></div>
                ) : null}
              </div>
            ) : null}
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
