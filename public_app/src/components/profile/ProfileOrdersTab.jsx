import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { DOC_TYPE_LABEL, openDocumentPdf } from "../../lib/documents";
import { IconBox, IconReceipt } from "../icons";
import { SectionSkeleton } from "../Skeleton";
import QuotationModal from "./QuotationModal";

const STATUS_LABELS = {
  pending: "New",
  accepted: "Accepted",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  canceled: "Canceled"
};

// An online order is paid only after you accept it, and can be completed once it's paid.
const actionsFor = (order) => {
  const online = order.paymentMethod === "online";
  if (order.status === "pending") return [{ status: "accepted", label: online ? "Accept: buyer can pay" : "Accept" }, { status: "rejected", label: "Reject" }];
  if (order.status === "accepted") return [...(online ? [] : [{ status: "fulfilled", label: "Mark fulfilled" }]), ...(order.paymentMethod === "mobile_money" ? [{ status: "fulfilled", label: "Mark fulfilled" }] : []), { status: "canceled", label: "Cancel" }];
  return [];
};

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// A cash / pay-on-delivery order that hasn't been paid yet and is still open: the seller can still adjust the quotation.
const canEditQuotation = (order) =>
  (order.paymentMethod === "cash" && order.paymentStatus !== "paid_cash" && (order.status === "pending" || order.status === "accepted")) ||
  (order.paymentMethod === "online" && ["awaiting_approval", "payable"].includes(order.paymentStatus) && (order.status === "pending" || order.status === "accepted"));

// Superseded revisions stay on record in Quotes & receipts; only the current documents show on the order.
const issuedDocs = (order) => (order.documents || []).filter((doc) => doc.status !== "superseded");

export default function ProfileOrdersTab({ focusOrderId = null }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [quoteOrder, setQuoteOrder] = useState(null);
  const [openingDocId, setOpeningDocId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const load = ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    request("/engagement/provider/orders?limit=50")
      .then((result) => setOrders(result?.items || []))
      .catch((loadError) => setError(loadError.message || "Unable to load your orders."))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  // Arriving from "Open order" in Quotes & receipts: scroll to that order and flash it.
  useEffect(() => {
    if (!focusOrderId || loading) return undefined;
    const node = document.querySelector(`[data-order-id="${focusOrderId}"]`);
    if (!node) return undefined;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(focusOrderId);
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timer);
  }, [focusOrderId, loading]);

  const openDoc = async (doc) => {
    setOpeningDocId(doc.id);
    setError("");
    try {
      await openDocumentPdf(doc);
    } catch (openError) {
      setError(openError.message || "Unable to open this document.");
    } finally {
      setOpeningDocId(null);
    }
  };

  const updateStatus = async (orderId, status) => {
    setUpdatingId(orderId);
    setError("");
    try {
      await request(`/engagement/provider/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      load();
    } catch (updateError) {
      setError(updateError.message || "Unable to update this order.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <SectionSkeleton rows={4} label="Loading your orders" />;

  return (
    <section className="detail-block">
      <h2>Orders</h2>
      {error ? <div className="error-message home-error">{error}</div> : null}

      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} data-order-id={order.id} className={`order-card${highlightId === order.id ? " is-highlighted" : ""}`}>
              <div className="order-card-header">
                <div>
                  <strong>{order.customer?.name || "Customer"}</strong>
                  <p className="provider-meta">{formatDate(order.createdAt)}</p>
                </div>
                <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>
              </div>

              <ul className="order-items">
                {(order.items || []).map((item) => (
                  <li key={item.id}>
                    <span>{item.name} &times; {item.quantity}</span>
                    <span>{formatUgx(item.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="order-total">Total <strong>{formatUgx(order.total)}</strong></div>

              {order.paymentMethod === "mobile_money" ? (
                <span className="od-order-pay is-paid">Paid online &middot; mobile money</span>
              ) : order.paymentMethod === "online" ? (
                <span className="od-order-pay is-cash">
                  {order.paymentStatus === "payable" ? `Accepted · waiting for the buyer to pay ${formatUgx(order.total)}` : order.paymentStatus === "closed" ? "Online payment closed" : "Pays online after you accept"}
                </span>
              ) : order.paymentStatus === "paid_cash" ? (
                <span className="od-order-pay is-paid">Cash collected</span>
              ) : (
                <span className="od-order-pay is-cash">Cash on {order.fulfillment?.method === "pickup" ? "pickup" : "delivery"} &middot; collect {formatUgx(order.total)}</span>
              )}

              {order.fulfillment?.method === "delivery" && order.fulfillment?.address ? (
                <p className="provider-meta">
                  Deliver to: {order.fulfillment.address}
                  {Number.isFinite(order.fulfillment.lat) && Number.isFinite(order.fulfillment.lng) ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${order.fulfillment.lat},${order.fulfillment.lng}`} target="_blank" rel="noreferrer">Get directions</a>
                    </>
                  ) : null}
                </p>
              ) : order.fulfillment?.method === "pickup" ? (
                <p className="provider-meta">Customer will pick up</p>
              ) : null}

              {order.customer?.phone || order.customer?.email ? (
                <p className="provider-meta">
                  Contact:{" "}
                  {order.customer?.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}
                  {order.customer?.phone && order.customer?.email ? " · " : null}
                  {order.customer?.email}
                </p>
              ) : null}
              {order.customer?.notes ? <p className="provider-meta">Note: {order.customer.notes}</p> : null}

              {issuedDocs(order).length || canEditQuotation(order) ? (
                <div className="docs-order-docs" aria-label="Quotes and receipts for this order">
                  {issuedDocs(order).map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className={`docs-doc-chip is-${doc.type}`}
                      onClick={() => openDoc(doc)}
                      disabled={openingDocId === doc.id}
                      title={`Open ${DOC_TYPE_LABEL[doc.type] || "document"} PDF · ${formatUgx(doc.total)}`}
                    >
                      <IconReceipt aria-hidden="true" />
                      <span>{DOC_TYPE_LABEL[doc.type] || "Document"} {doc.number}{doc.revision > 1 ? ` · rev ${doc.revision}` : ""}</span>
                    </button>
                  ))}
                  {canEditQuotation(order) ? (
                    <button type="button" className="docs-btn is-small" onClick={() => setQuoteOrder(order)}>Edit &amp; send quotation</button>
                  ) : null}
                </div>
              ) : null}

              {actionsFor(order).length ? (
                <div className="listing-actions order-actions">
                  {actionsFor(order).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => updateStatus(order.id, action.status)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconBox />
          <p>No orders yet.</p>
        </div>
      )}

      {quoteOrder ? (
        <QuotationModal
          order={quoteOrder}
          onClose={() => setQuoteOrder(null)}
          onIssued={() => load({ quiet: true })}
        />
      ) : null}
    </section>
  );
}
