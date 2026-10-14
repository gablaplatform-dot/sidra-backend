import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { getSession } from "../lib/session";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";
import { initialOrderDetails, placeCashOrder, validateOrderDetails } from "../lib/orders";
import OrderDetailsFields from "./OrderDetailsFields";
import { IconClose } from "./icons";

// Order without paying online: the order goes straight to the seller and the buyer pays them in
// cash on delivery / pickup. For services there is no delivery step and the price is agreed with
// the provider directly.
export default function OrderModal({ listing, providerId, onClose, payOnline = false }) {
  const location = useLocation();
  const [session] = useState(() => getSession());
  const [details, setDetails] = useState(() => initialOrderDetails(session));
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  const isService = listing.type === "service";
  const unitPrice = Number(listing.price) || 0;
  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const total = unitPrice * qty;

  const submit = async (event) => {
    event.preventDefault();
    const problem = validateOrderDetails(details, { delivery: !isService });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await placeCashOrder({
        providerId,
        items: [{ listingId: listing.id, name: listing.name, quantity: qty, unitPrice }],
        details,
        delivery: !isService,
        paymentMethod: payOnline ? "online" : "cash"
      });
      setPlaced(order);
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
            <Link to={loginPath(location, { resume: payOnline ? "buy" : "order" })} className="primary-button" style={{ display: "block", textAlign: "center" }}>Sign in</Link>
          </>
        ) : placed ? (
          <div className="od-done">
            <h2>{payOnline ? "Order request sent" : "Order sent"}</h2>
            <p>
              {placed.providerName ? <strong>{placed.providerName}</strong> : "The seller"} has your order for &ldquo;{listing.name}&rdquo;
              and will {payOnline ? "confirm it's available" : <>call you on <strong>{details.phone}</strong> to confirm</>}.
            </p>
            {payOnline ? (
              <p className="od-pay">
                <strong>Nothing has been charged.</strong> Once the seller accepts, we&apos;ll email you and you can pay {formatUgx(placed.total)} by mobile money from <Link to="/orders" onClick={onClose}>My orders</Link>.
              </p>
            ) : !isService && placed.total > 0 ? (
              <p className="od-pay">
                Pay <strong>{formatUgx(placed.total)}</strong> in cash {details.method === "pickup" ? "when you pick it up" : "when it's delivered"}. Nothing has been charged.
              </p>
            ) : null}
            <p className="modal-hint">Order reference #{String(placed.id).slice(-6).toUpperCase()}</p>
            <button type="button" className="primary-button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2>{payOnline ? "Order" : isService ? "Request" : "Order"} &ldquo;{listing.name}&rdquo;</h2>
            {unitPrice > 0 ? <p className="modal-hint">{formatUgx(unitPrice)}{isService ? "" : " each"}</p> : null}
            {error ? <div className="error-message">{error}</div> : null}
            <form onSubmit={submit} className="form-grid">
              {!isService ? (
                <label className="field">
                  <span>Quantity</span>
                  <input type="number" min="1" max="99" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </label>
              ) : null}
              <OrderDetailsFields value={details} onChange={setDetails} delivery={!isService} />

              <div className="od-payline">
                <span className="od-payline-title">{payOnline ? "Pay after the seller accepts" : isService ? "No payment now" : "Pay cash on delivery"}</span>
                <span>
                  {payOnline
                    ? `Nothing is charged now. When the seller confirms it's available, you pay ${total > 0 ? formatUgx(total) : "the total"} by mobile money from My orders.`
                    : isService
                      ? "Agree the final price with the provider and pay them directly."
                      : `Nothing is charged online. You pay ${total > 0 ? formatUgx(total) : "the seller"} in cash when you ${details.method === "pickup" ? "pick up" : "receive"} your order.`}
                </span>
              </div>

              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? "Sending…" : payOnline ? `Send order request${total > 0 ? ` · ${formatUgx(total)}` : ""}` : isService ? "Send request" : `Place order${total > 0 ? ` · ${formatUgx(total)}` : ""}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
