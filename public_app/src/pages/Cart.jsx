import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { getCartItems, setCartQuantity, removeFromCart, clearCart } from "../lib/cart";
import { formatUgx } from "../lib/format";
import SiteHeader from "../components/SiteHeader";
import { IconBox, IconClose } from "../components/icons";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

export default function Cart() {
  const navigate = useNavigate();
  const [session] = useState(() => getSession());
  const [listings, setListings] = useState({}); // listingId -> listing detail, or null if unavailable
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("cart"); // cart | waiting | succeeded | failed | timeout
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [cartVersion, setCartVersion] = useState(0);
  const transactionIdRef = useRef(null);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  const cartItems = getCartItems();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all(
      cartItems.map((item) =>
        request(`/listings/${encodeURIComponent(item.listingId)}`)
          .then((listing) => [item.listingId, listing])
          .catch(() => [item.listingId, null])
      )
    )
      .then((pairs) => {
        if (!active) return;
        const map = Object.fromEntries(pairs);
        setListings(map);
        // Drop anything that's no longer available (deleted, unapproved, etc.) from the cart.
        for (const [listingId, listing] of pairs) {
          if (!listing) removeFromCart(listingId);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartVersion]);

  const validItems = cartItems
    .map((item) => ({ ...item, listing: listings[item.listingId] }))
    .filter((item) => item.listing);

  const byProvider = new Map();
  for (const item of validItems) {
    const providerId = item.listing.providerId;
    if (!byProvider.has(providerId)) byProvider.set(providerId, { provider: item.listing.provider, items: [] });
    byProvider.get(providerId).items.push(item);
  }

  const grandTotal = validItems.reduce((sum, item) => sum + Number(item.listing.price || 0) * item.quantity, 0);

  const updateQuantity = (listingId, quantity) => {
    setCartQuantity(listingId, quantity);
    setCartVersion((v) => v + 1);
  };

  const remove = (listingId) => {
    removeFromCart(listingId);
    setCartVersion((v) => v + 1);
  };

  const poll = async () => {
    if (!transactionIdRef.current) return;
    try {
      const result = await request(`/payments/transactions/${transactionIdRef.current}/status`);
      if (result.status === "succeeded") {
        setReceipt(result);
        setStage("succeeded");
        clearCart();
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

  const checkout = async (event) => {
    event.preventDefault();
    if (!session) {
      navigate("/login", { state: { message: "Sign in to check out." } });
      return;
    }
    if (!phone.trim()) {
      setError("Enter the phone number to pay from.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await request("/payments/cart/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: validItems.map((item) => ({ listingId: item.listingId, quantity: item.quantity })),
          phone: phone.trim()
        })
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

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <main className="home-shell">
      <SiteHeader session={session} onLogout={logout} />

      <div className="cart-page">
        <div className="form-heading">
          <p className="eyebrow">Cart</p>
          <h2>Your cart</h2>
        </div>

        {error ? <div className="error-message">{error}</div> : null}

        {stage === "succeeded" ? (
          <div className="detail-block cart-receipt">
            <h3>Payment confirmed</h3>
            <p>Your order has gone through. Each seller has been notified.</p>
            {Array.isArray(receipt?.createdOrders) && receipt.createdOrders.length ? (
              <ul className="contact-list" style={{ marginTop: 8 }}>
                {receipt.createdOrders.map((order) => (
                  <li key={order.id}>
                    Order <strong>#{order.id}</strong>
                    {order.providerName ? ` — ${order.providerName}` : order.providerId ? ` (seller ${order.providerId})` : ""}
                    {" "}&mdash; <span style={{ textTransform: "capitalize" }}>{order.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {receipt?.items?.length ? (
              <ul className="contact-list" style={{ marginTop: 8 }}>
                {receipt.items.map((item, index) => (
                  <li key={`${item.listingId}-${index}`}>{item.quantity} &times; {item.name} &mdash; {formatUgx(item.amount)}</li>
                ))}
              </ul>
            ) : null}
            <Link to="/home" className="cta-button" style={{ display: "inline-block", marginTop: 16 }}>Continue shopping</Link>
          </div>
        ) : stage === "waiting" ? (
          <div className="detail-block cart-receipt">
            <h3>Approve on your phone</h3>
            <p>We sent a mobile money prompt to {phone}. Approve it to complete your order.</p>
            <p className="modal-hint">Waiting for confirmation…</p>
          </div>
        ) : stage === "failed" ? (
          <div className="detail-block cart-receipt">
            <h3>Payment failed</h3>
            <p>The mobile money payment wasn&apos;t completed. You can try again.</p>
            <button type="button" className="primary-button" onClick={() => setStage("cart")}>Back to cart</button>
          </div>
        ) : stage === "timeout" ? (
          <div className="detail-block cart-receipt">
            <h3>Still waiting</h3>
            <p>We haven&apos;t heard back yet. If you already approved the prompt, check again &mdash; otherwise try again.</p>
            <div className="payment-options">
              <button type="button" className="payment-option" onClick={checkAgain}>Check again</button>
              <button type="button" className="payment-option" onClick={() => setStage("cart")}>Try again</button>
            </div>
          </div>
        ) : loading ? (
          <p className="home-empty page-loading">Loading your cart…</p>
        ) : !validItems.length ? (
          <div className="empty-state">
            <IconBox />
            <p>Your cart is empty.</p>
            <Link to="/home" className="cta-button">Browse products</Link>
          </div>
        ) : (
          <>
            {Array.from(byProvider.entries()).map(([providerId, group]) => (
              <section key={providerId} className="detail-block cart-provider-group">
                <h3>{group.provider?.businessName || "Shop"}</h3>
                <div className="wallet-list">
                  {group.items.map((item) => (
                    <div key={item.listingId} className="wallet-list-row cart-item-row">
                      <div>
                        <strong>{item.listing.name}</strong>
                        <p className="provider-meta">{formatUgx(item.listing.price)} each</p>
                      </div>
                      <div className="cart-item-controls">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.listingId, e.target.value)}
                        />
                        <span className="cart-item-subtotal">{formatUgx(Number(item.listing.price || 0) * item.quantity)}</span>
                        <button type="button" className="icon-button" aria-label="Remove" onClick={() => remove(item.listingId)}>
                          <IconClose />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="detail-block cart-checkout">
              <div className="cart-total-row">
                <span>Total</span>
                <strong>{formatUgx(grandTotal)}</strong>
              </div>
              {!session ? (
                <>
                  <p className="provider-meta">Sign in to check out.</p>
                  <Link to="/login" className="cta-button">Sign in</Link>
                </>
              ) : (
                <form onSubmit={checkout} className="form-grid">
                  <label className="field">
                    <span>Mobile money number</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +256 700 000000" required />
                  </label>
                  <button type="submit" className="primary-button" disabled={submitting}>
                    {submitting ? "Starting payment…" : `Pay ${formatUgx(grandTotal)} with Mobile Money`}
                  </button>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
