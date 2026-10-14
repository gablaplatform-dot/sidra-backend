import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginPath } from "../lib/authRedirect";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { getCartItems, setCartQuantity, removeFromCart, clearCart } from "../lib/cart";
import { formatUgx } from "../lib/format";
import { initialOrderDetails, placeCashOrder, validateOrderDetails } from "../lib/orders";
import SiteHeader from "../components/SiteHeader";
import OrderDetailsFields from "../components/OrderDetailsFields";
import { IconBox, IconClose } from "../components/icons";
import { ListSkeleton, Skel } from "../components/Skeleton";

export default function Cart() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session] = useState(() => getSession());
  const [listings, setListings] = useState({}); // listingId -> listing detail, or null if unavailable
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("cart"); // cart | ordered
  const [payMethod, setPayMethod] = useState("online"); // online (pay after the seller accepts) | cash
  const [details, setDetails] = useState(() => initialOrderDetails(getSession()));
  const [cashOrders, setCashOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [cartVersion, setCartVersion] = useState(0);

  const cartItems = getCartItems();

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

  // Nothing is charged here. One order per seller goes straight to each of them; online orders are paid after the
  // seller accepts (from My orders), cash orders on delivery. A seller whose order succeeds is dropped from the
  // cart, so a retry only resends what failed.
  const placeOrders = async (event) => {
    event.preventDefault();
    if (!session) {
      navigate(loginPath(location), { state: { message: "Sign in to place an order." } });
      return;
    }
    const problem = validateOrderDetails(details, { delivery: true });
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError("");
    const placed = [];
    const failed = [];
    for (const [providerId, group] of byProvider.entries()) {
      try {
        const order = await placeCashOrder({
          providerId,
          items: group.items.map((i) => ({ listingId: i.listingId, name: i.listing.name, quantity: i.quantity, unitPrice: Number(i.listing.price) || 0 })),
          details,
          paymentMethod: payMethod
        });
        placed.push({ ...order, providerName: order.providerName || group.provider?.businessName });
        for (const i of group.items) removeFromCart(i.listingId);
      } catch (orderError) {
        failed.push(`${group.provider?.businessName || "a seller"}: ${orderError.message || "couldn't be sent"}`);
      }
    }
    setSubmitting(false);
    setCashOrders((prev) => [...prev, ...placed]);
    if (failed.length) {
      setError(`Some orders weren't sent - ${failed.join("; ")}. Your other orders went through; try again for the rest.`);
      setCartVersion((v) => v + 1);
    }
    if (placed.length && !failed.length) setStage("ordered");
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      <div className="cart-page">
        <div className="form-heading">
          <p className="eyebrow">Cart</p>
          <h2>Your cart</h2>
        </div>

        {error ? <div className="error-message">{error}</div> : null}

        {stage === "ordered" ? (
          <div className="detail-block cart-receipt">
            <h3>{payMethod === "online" ? "Order requests sent" : "Orders sent"}</h3>
            {payMethod === "online" ? (
              <p>Each seller will confirm your order is available. <strong>Nothing has been charged.</strong> When a seller accepts, we&apos;ll email you and you can pay them by mobile money from <Link to="/orders">My orders</Link>.</p>
            ) : (
              <p>Each seller has your order and will call you on <strong>{details.phone}</strong> to confirm. Nothing has been charged &mdash; pay in cash {details.method === "pickup" ? "when you pick up" : "on delivery"}.</p>
            )}
            <ul className="contact-list" style={{ marginTop: 8 }}>
              {cashOrders.map((order) => (
                <li key={order.id}>
                  <strong>{order.providerName || "Seller"}</strong> &mdash; {payMethod === "online" ? `${formatUgx(order.total)}, pay once accepted` : `pay ${formatUgx(order.total)} in cash`}
                  <span className="provider-meta"> (ref #{String(order.id).slice(-6).toUpperCase()})</span>
                </li>
              ))}
            </ul>
            <Link to="/home" className="cta-button" style={{ display: "inline-block", marginTop: 16 }}>Continue shopping</Link>
          </div>
        ) : loading ? (
          <div className="detail-block">
            <Skel h={22} w={180} />
            <div style={{ marginTop: 16 }}>
              <ListSkeleton rows={3} label="Loading your cart" />
            </div>
          </div>
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
                      <div
                        className="cart-item-thumb"
                        style={item.listing.media?.imageUrl ? { backgroundImage: `url("${item.listing.media.imageUrl}")` } : undefined}
                      >
                        {!item.listing.media?.imageUrl ? <IconBox /> : null}
                      </div>
                      <div className="cart-item-info">
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
                  <Link to={loginPath(location)} className="cta-button">Sign in</Link>
                </>
              ) : (
                <>
                  <div className="cart-paymethod" role="radiogroup" aria-label="How do you want to pay?">
                    <button type="button" role="radio" aria-checked={payMethod === "online"} className={payMethod === "online" ? "is-active" : ""} onClick={() => setPayMethod("online")}>
                      Pay online
                      <small>After the seller accepts</small>
                    </button>
                    <button type="button" role="radio" aria-checked={payMethod === "cash"} className={payMethod === "cash" ? "is-active" : ""} onClick={() => setPayMethod("cash")}>
                      Pay on delivery
                      <small>Cash, nothing charged now</small>
                    </button>
                  </div>

                  <form onSubmit={placeOrders} className="form-grid">
                    <OrderDetailsFields value={details} onChange={setDetails} delivery />
                    <div className="od-payline">
                      <span className="od-payline-title">{payMethod === "online" ? "Pay after the seller accepts" : "Pay cash on delivery"}</span>
                      <span>
                        {payMethod === "online"
                          ? `Your ${byProvider.size > 1 ? `${byProvider.size} orders go` : "order goes"} to the seller${byProvider.size > 1 ? "s" : ""} to confirm it's available. Nothing is charged now; once a seller accepts you pay them ${formatUgx(grandTotal)} by mobile money from My orders.`
                          : `Your ${byProvider.size > 1 ? `${byProvider.size} orders go` : "order goes"} straight to the seller${byProvider.size > 1 ? "s" : ""}. You pay ${formatUgx(grandTotal)} in cash when you ${details.method === "pickup" ? "pick up" : "receive"} your order.`}
                      </span>
                    </div>
                    <button type="submit" className="primary-button" disabled={submitting}>
                      {submitting ? "Sending orders…" : payMethod === "online" ? `Send order request · ${formatUgx(grandTotal)}` : `Place order · ${formatUgx(grandTotal)}`}
                    </button>
                  </form>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
