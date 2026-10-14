import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { clearSession, getSession } from "../lib/session";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";
import { ORDER_STATUS, openDocumentPdf } from "../lib/myOrders";
import SiteHeader from "../components/SiteHeader";
import MyBookings from "../components/booking/MyBookings";
import PaymentModal from "../components/PaymentModal";
import { Skel } from "../components/Skeleton";
import { IconBox, IconCheck, IconPin, IconReceipt } from "../components/icons";

const FILTERS = [
  { key: "all", label: "All orders" },
  { key: "open", label: "In progress" },
  { key: "done", label: "Completed" },
  { key: "closed", label: "Cancelled" }
];
const bucket = (order) => (order.status === "fulfilled" ? "done" : ["rejected", "canceled"].includes(order.status) ? "closed" : "open");

const dateLabel = (value) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const orderRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;

function OrderCard({ order, onPaid, phone }) {
  const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "paid_cash";
  const quotes = order.documents.filter((d) => d.type === "quotation");
  const receipts = order.documents.filter((d) => d.type === "receipt");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const online = order.paymentMethod === "online";
  const closed = online && order.paymentStatus === "closed";

  const open = async (doc) => {
    setBusy(doc.id);
    setError("");
    try {
      await openDocumentPdf(doc.id);
    } catch (e) {
      setError(e.message || "This document could not be opened.");
    } finally {
      setBusy("");
    }
  };

  const steps = online || order.paymentMethod === "mobile_money" ? ["Placed", paid ? "Accepted & paid" : "Accepted", "Completed"] : ["Placed", "Accepted", paid && order.status === "fulfilled" ? "Delivered & paid" : "Completed"];

  return (
    <article className="mo-card">
      <header className="mo-card-head">
        <div className="mo-seller">
          {order.provider.avatarUrl ? <img src={order.provider.avatarUrl} alt="" /> : <span>{order.provider.businessName.slice(0, 1).toUpperCase()}</span>}
          <div>
            <Link to={`/provider/${order.provider.id}`}>{order.provider.businessName}</Link>
            <small>Order {orderRef(order.id)} · {dateLabel(order.createdAt)}</small>
          </div>
        </div>
        <span className={`mo-chip mo-chip-${status.tone}`}>{status.label}</span>
      </header>

      {status.step >= 0 ? (
        <ol className="mo-steps" aria-label="Order progress">
          {steps.map((label, i) => (
            <li key={label} className={i <= status.step ? "is-done" : ""}>
              <span>{i <= status.step ? <IconCheck width={12} height={12} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      ) : null}

      <ul className="mo-items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span><IconBox width={16} height={16} /> {item.listingId ? <Link to={`/shop/product/${item.listingId}`}>{item.name}</Link> : item.name} <em>× {item.quantity}</em></span>
            <strong>{formatUgx(item.total)}</strong>
          </li>
        ))}
      </ul>

      <div className="mo-pay">
        <div>
          <small>{paid ? "Paid" : "To pay"}</small>
          <strong>{formatUgx(order.total)}</strong>
        </div>
        {online && order.paymentStatus === "payable" ? (
          <button type="button" className="mo-paynow" onClick={() => setPaying(true)}>Pay now</button>
        ) : (
          <span className={`mo-chip ${paid ? "mo-chip-green" : "mo-chip-amber"}`}>
            {order.paymentMethod === "mobile_money"
              ? "Paid by mobile money"
              : online
                ? closed ? "Not charged" : "Waiting for the seller to accept"
                : paid ? "Cash collected" : order.fulfillment.method === "pickup" ? "Pay cash on pickup" : "Pay cash on delivery"}
          </span>
        )}
      </div>
      {online && order.paymentStatus === "payable" ? (
        <p className="mo-where">The seller accepted your order. Pay now to confirm it. Nothing was charged until you pay.</p>
      ) : online && order.paymentStatus === "awaiting_approval" ? (
        <p className="mo-where">You&apos;ll be able to pay as soon as the seller confirms it&apos;s available. We&apos;ll email you.</p>
      ) : null}
      {order.fulfillment.method === "delivery" && order.fulfillment.address ? (
        <p className="mo-where"><IconPin width={15} height={15} /> {order.fulfillment.address}</p>
      ) : order.fulfillment.method === "pickup" ? (
        <p className="mo-where"><IconPin width={15} height={15} /> You will pick this order up</p>
      ) : null}

      <section className="mo-docs" aria-label="Quotations and receipts">
        <h3><IconReceipt width={16} height={16} /> Quotations &amp; receipts</h3>
        {order.documents.length ? (
          <ul>
            {[...receipts, ...quotes].map((doc) => (
              <li key={doc.id} className={doc.status === "superseded" ? "is-old" : ""}>
                <div>
                  <strong>{doc.type === "receipt" ? "Receipt" : "Quotation"} {doc.number}{doc.revision > 1 ? ` · revision ${doc.revision}` : ""}</strong>
                  <small>
                    {dateLabel(doc.issuedAt)} · {formatUgx(doc.total)}
                    {doc.status === "superseded" ? " · replaced by a newer quotation" : doc.emailedAt ? ` · emailed to ${doc.emailedTo}` : ""}
                  </small>
                </div>
                <button type="button" onClick={() => open(doc)} disabled={busy === doc.id}>{busy === doc.id ? "Opening…" : "View PDF"}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mo-docs-empty">
            {paid ? "Your receipt will show here shortly." : "The seller's quotation arrives by email and shows here within a minute of placing the order. Your receipt follows once it is paid."}
          </p>
        )}
        {error ? <p className="mo-error">{error}</p> : null}
      </section>
      {paying ? (
        <PaymentModal
          title="Pay for your order"
          summary={`${order.provider.businessName} · ${order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}`}
          amount={Number(order.total)}
          endpoint={`/payments/orders/${encodeURIComponent(order.id)}/pay`}
          defaultPhone={phone}
          onClose={() => setPaying(false)}
          onPaid={onPaid}
        />
      ) : null}
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="mo-card" aria-hidden="true">
      <div className="mo-card-head"><Skel h={44} w={220} r={12} /><Skel h={26} w={110} r={999} /></div>
      <Skel h={14} w="100%" style={{ marginTop: 18 }} />
      <Skel h={14} w="80%" style={{ marginTop: 10 }} />
      <Skel h={54} w="100%" r={12} style={{ marginTop: 18 }} />
    </div>
  );
}

export default function MyOrders() {
  const location = useLocation();
  const [session, setSession] = useState(() => getSession());
  const [orders, setOrders] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "bookings" ? "bookings" : "orders";
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    request("/engagement/orders/mine?limit=50")
      .then((result) => setOrders(result?.items || []))
      .catch((e) => {
        setOrders([]);
        setError(e.message || "Your orders could not be loaded.");
      });
  }, []);

  useEffect(() => {
    document.title = "My orders | Gabla";
    if (session) load();
  }, [session, load]);

  const logout = () => {
    clearSession();
    setSession(null);
  };

  const shown = (orders || []).filter((o) => filter === "all" || bucket(o) === filter);
  const counts = { all: orders?.length ?? 0, open: 0, done: 0, closed: 0 };
  (orders || []).forEach((o) => {
    counts[bucket(o)] += 1;
  });

  return (
    <main className="home-shell home-themed mo-page">
      <SiteHeader session={session} onLogout={logout} />
      <div className="mo-wrap">
        <header className="mo-title">
          <h1>{tab === "bookings" ? "My bookings" : "My orders"}</h1>
          <p>{tab === "bookings" ? "Your hotel, venue and appointment bookings, and what the provider has answered." : "Everything you have ordered, with the seller's quotations and your receipts attached."}</p>
        </header>

        {!session ? (
          <div className="mo-empty">
            <strong>Sign in to see your orders</strong>
            <p>Your orders, quotations and receipts are kept with your account.</p>
            <Link to={loginPath(location)} className="primary-button">Sign in</Link>
          </div>
        ) : (
          <>
            <div className="mo-tabs" role="tablist" aria-label="Orders or bookings">
              <button type="button" role="tab" aria-selected={tab === "orders"} className={tab === "orders" ? "is-active" : ""} onClick={() => setSearchParams({})}>Orders</button>
              <button type="button" role="tab" aria-selected={tab === "bookings"} className={tab === "bookings" ? "is-active" : ""} onClick={() => setSearchParams({ tab: "bookings" })}>Bookings</button>
            </div>
            {tab === "bookings" ? <MyBookings /> : <>
            <div className="mo-filters" role="tablist">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "is-active" : ""} onClick={() => setFilter(f.key)}>
                  {f.label} <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            {error ? <div className="error-message">{error}</div> : null}
            {orders === null ? (
              <><CardSkeleton /><CardSkeleton /></>
            ) : shown.length ? (
              <div className="mo-list">{shown.map((o) => <OrderCard key={o.id} order={o} onPaid={load} phone={session?.user?.phone || ""} />)}</div>
            ) : (
              <div className="mo-empty">
                <strong>{orders.length ? "No orders here" : "You haven't ordered anything yet"}</strong>
                <p>{orders.length ? "Try another filter." : "When you order from a seller on Gabla, it shows up here."}</p>
                {!orders.length ? <Link to="/shop" className="primary-button">Browse the shop</Link> : null}
              </div>
            )}
            </>}
          </>
        )}
      </div>
    </main>
  );
}
