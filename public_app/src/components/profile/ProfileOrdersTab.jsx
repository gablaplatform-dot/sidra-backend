import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { docTypeLabel, openDocumentPdf } from "../../lib/documents";
import { formatUgx } from "../../lib/format";
import { intlLocale } from "../../i18n";
import { IconBox, IconReceipt } from "../icons";
import { SectionSkeleton } from "../Skeleton";
import QuotationModal from "./QuotationModal";

// An online order is paid only after you accept it, and can be completed once it's paid.
const actionsFor = (order) => {
  const online = order.paymentMethod === "online";
  if (order.status === "pending") return [{ status: "accepted", labelKey: online ? "profile.orders.acceptPay" : "profile.orders.accept" }, { status: "rejected", labelKey: "profile.orders.reject" }];
  if (order.status === "accepted") return [...(online ? [] : [{ status: "fulfilled", labelKey: "profile.orders.markFulfilled" }]), ...(order.paymentMethod === "mobile_money" ? [{ status: "fulfilled", labelKey: "profile.orders.markFulfilled" }] : []), { status: "canceled", labelKey: "profile.orders.cancel" }];
  return [];
};

const formatDate = (value) => new Date(value).toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });

// A cash / pay-on-delivery order that hasn't been paid yet and is still open: the seller can still adjust the quotation.
const canEditQuotation = (order) =>
  (order.paymentMethod === "cash" && order.paymentStatus !== "paid_cash" && (order.status === "pending" || order.status === "accepted")) ||
  (order.paymentMethod === "online" && ["awaiting_approval", "payable"].includes(order.paymentStatus) && (order.status === "pending" || order.status === "accepted"));

// Superseded revisions stay on record in Quotes & receipts; only the current documents show on the order.
const issuedDocs = (order) => (order.documents || []).filter((doc) => doc.status !== "superseded");

export default function ProfileOrdersTab({ focusOrderId = null }) {
  const { t } = useTranslation();
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
      .catch((loadError) => setError(loadError.message || t("profile.orders.errLoad")))
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
      setError(openError.message || t("profile.orders.errOpenDoc"));
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
      setError(updateError.message || t("profile.orders.errUpdate"));
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <SectionSkeleton rows={4} label={t("profile.orders.loading")} />;

  return (
    <section className="detail-block">
      <h2>{t("profile.tabs.orders")}</h2>
      {error ? <div className="error-message home-error">{error}</div> : null}

      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} data-order-id={order.id} className={`order-card${highlightId === order.id ? " is-highlighted" : ""}`}>
              <div className="order-card-header">
                <div>
                  <strong>{order.customer?.name || t("profile.orders.customer")}</strong>
                  <p className="provider-meta">{formatDate(order.createdAt)}</p>
                </div>
                <span className={`status-badge status-${order.status}`}>{t(`profile.orders.status.${order.status}`, { defaultValue: order.status })}</span>
              </div>

              <ul className="order-items">
                {(order.items || []).map((item) => (
                  <li key={item.id}>
                    <span>{item.name} &times; {item.quantity}</span>
                    <span>{formatUgx(item.total)}</span>
                  </li>
                ))}
              </ul>
              <div className="order-total">{t("profile.orders.total")} <strong>{formatUgx(order.total)}</strong></div>

              {order.paymentMethod === "mobile_money" ? (
                <span className="od-order-pay is-paid">{t("profile.orders.paidMobileMoney")}</span>
              ) : order.paymentMethod === "online" ? (
                <span className="od-order-pay is-cash">
                  {order.paymentStatus === "payable" ? t("profile.orders.waitingBuyerPay", { amount: formatUgx(order.total) }) : order.paymentStatus === "closed" ? t("profile.orders.onlineClosed") : t("profile.orders.paysOnlineAfter")}
                </span>
              ) : order.paymentStatus === "paid_cash" ? (
                <span className="od-order-pay is-paid">{t("profile.orders.cashCollected")}</span>
              ) : (
                <span className="od-order-pay is-cash">{t(order.fulfillment?.method === "pickup" ? "profile.orders.cashOnPickup" : "profile.orders.cashOnDelivery", { amount: formatUgx(order.total) })}</span>
              )}

              {order.fulfillment?.method === "delivery" && order.fulfillment?.address ? (
                <p className="provider-meta">
                  {t("profile.orders.deliverTo")} {order.fulfillment.address}
                  {Number.isFinite(order.fulfillment.lat) && Number.isFinite(order.fulfillment.lng) ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${order.fulfillment.lat},${order.fulfillment.lng}`} target="_blank" rel="noreferrer">{t("profile.orders.directions")}</a>
                    </>
                  ) : null}
                </p>
              ) : order.fulfillment?.method === "pickup" ? (
                <p className="provider-meta">{t("profile.orders.willPickUp")}</p>
              ) : null}

              {order.customer?.phone || order.customer?.email ? (
                <p className="provider-meta">
                  {t("profile.orders.contact")}{" "}
                  {order.customer?.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}
                  {order.customer?.phone && order.customer?.email ? " · " : null}
                  {order.customer?.email}
                </p>
              ) : null}
              {order.customer?.notes ? <p className="provider-meta">{t("profile.orders.note")} {order.customer.notes}</p> : null}

              {issuedDocs(order).length || canEditQuotation(order) ? (
                <div className="docs-order-docs" aria-label={t("profile.orders.docsAria")}>
                  {issuedDocs(order).map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className={`docs-doc-chip is-${doc.type}`}
                      onClick={() => openDoc(doc)}
                      disabled={openingDocId === doc.id}
                      title={t("profile.orders.openPdf", { type: docTypeLabel(doc.type), amount: formatUgx(doc.total) })}
                    >
                      <IconReceipt aria-hidden="true" />
                      <span>{docTypeLabel(doc.type)} {doc.number}{doc.revision > 1 ? ` · ${t("profile.orders.rev", { n: doc.revision })}` : ""}</span>
                    </button>
                  ))}
                  {canEditQuotation(order) ? (
                    <button type="button" className="docs-btn is-small" onClick={() => setQuoteOrder(order)}>{t("profile.orders.editQuotation")}</button>
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
                      {t(action.labelKey)}
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
          <p>{t("profile.orders.empty")}</p>
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
