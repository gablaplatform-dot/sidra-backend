import React, { useState } from "react";
import { Link } from "react-router-dom";

import { request } from "../lib/api";
import { getSession } from "../lib/session";
import { IconClose } from "./icons";

export default function OrderModal({ listing, providerId, onClose }) {
  const [session] = useState(() => getSession());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await request("/engagement/orders", {
        method: "POST",
        body: JSON.stringify({
          providerId,
          items: [
            {
              listingId: listing.id,
              name: listing.name,
              quantity: Math.max(1, Number(quantity) || 1),
              unitPrice: Number(listing.price) || 0
            }
          ],
          customer: { name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined }
        })
      });
      setPlaced(true);
    } catch (submitError) {
      setError(submitError.message || "Unable to place this order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>

        {!session ? (
          <>
            <h2>Sign in to order</h2>
            <p>You&apos;ll need a Gabla account to place an order with {listing.name}.</p>
            <Link to="/login" className="primary-button" style={{ display: "block", textAlign: "center" }}>Sign in</Link>
          </>
        ) : placed ? (
          <>
            <h2>Order placed</h2>
            <p>Your request for &ldquo;{listing.name}&rdquo; has been sent. The provider will reach out to confirm.</p>
            <button type="button" className="primary-button" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <h2>Order &ldquo;{listing.name}&rdquo;</h2>
            {Number(listing.price) > 0 ? <p className="modal-hint">UGX {Number(listing.price).toLocaleString()} each</p> : null}
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              <label className="field">
                <span>Your name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +256 700 000000" />
              </label>
              <label className="field">
                <span>Quantity</span>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <label className="field">
                <span>Note (optional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the provider should know" />
              </label>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
