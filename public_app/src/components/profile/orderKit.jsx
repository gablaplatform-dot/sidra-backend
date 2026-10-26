import React from "react";

import { request } from "../../lib/api";
import { formatUgx } from "../../lib/format";
import { intlLocale } from "../../i18n";

// Shared by the Orders list (cards / table) and the single-order screen.

export const ORDER_STATUSES = ["pending", "accepted", "delivering", "fulfilled", "rejected", "canceled"];
// The happy path a seller walks an order through: received -> accepted -> delivering -> delivered.
export const ORDER_FLOW = ["pending", "accepted", "delivering", "fulfilled"];

export const orderRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export const formatOrderDate = (value) => new Date(value).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });
export const formatOrderDateTime = (value) =>
  new Date(value).toLocaleString(intlLocale(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// What the seller can do next. An online order can't go out for delivery until the buyer has paid.
export const actionsFor = (order) => {
  const waitingPayment = order.paymentMethod === "online";
  if (order.status === "pending") {
    return [
      { status: "accepted", labelKey: waitingPayment ? "profile.orders.acceptPay" : "profile.orders.accept", tone: "primary" },
      { status: "rejected", labelKey: "profile.orders.reject", tone: "danger" }
    ];
  }
  if (order.status === "accepted") {
    return [
      ...(waitingPayment ? [] : [{ status: "delivering", labelKey: order.fulfillment?.method === "pickup" ? "profile.orders.readyPickup" : "profile.orders.startDelivery", tone: "primary" }]),
      { status: "canceled", labelKey: "profile.orders.cancel", tone: "danger" }
    ];
  }
  if (order.status === "delivering") {
    return [
      { status: "fulfilled", labelKey: "profile.orders.markDelivered", tone: "primary" },
      { status: "canceled", labelKey: "profile.orders.cancel", tone: "danger" }
    ];
  }
  return [];
};

export const isClosed = (order) => ["fulfilled", "rejected", "canceled"].includes(order.status);

// A cash / pay-on-delivery order that hasn't been paid yet and is still open: the seller can still adjust the quotation.
export const canEditQuotation = (order) =>
  (order.paymentMethod === "cash" && order.paymentStatus !== "paid_cash" && ["pending", "accepted"].includes(order.status)) ||
  (order.paymentMethod === "online" && ["awaiting_approval", "payable"].includes(order.paymentStatus) && ["pending", "accepted"].includes(order.status));

// Superseded revisions stay on record in Quotes & receipts; only the current documents show on the order.
export const issuedDocs = (order) => (order.documents || []).filter((doc) => doc.status !== "superseded");

export const customerName = (order, t) => order.customer?.name || t("profile.orders.customer");

// One short line for the card / table: "Microwave ×1 · +2 more".
export const itemsLine = (order, t) => {
  const items = order.items || [];
  if (!items.length) return "";
  const first = `${items[0].name} × ${items[0].quantity}`;
  return items.length > 1 ? `${first} · ${t("profile.orders.moreItems", { count: items.length - 1 })}` : first;
};

export const itemCount = (order) => (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

// Short payment state for chips: { tone, label }.
export const paymentChip = (order, t) => {
  if (order.paymentMethod === "mobile_money") return { tone: "paid", label: t("profile.orders.pay.paid") };
  if (order.paymentMethod === "online") {
    if (order.paymentStatus === "payable") return { tone: "wait", label: t("profile.orders.pay.payable") };
    if (order.paymentStatus === "closed") return { tone: "muted", label: t("profile.orders.pay.closed") };
    return { tone: "wait", label: t("profile.orders.pay.online") };
  }
  if (order.paymentStatus === "paid_cash") return { tone: "paid", label: t("profile.orders.pay.cashCollected") };
  return { tone: "cash", label: t(order.fulfillment?.method === "pickup" ? "profile.orders.pay.cashPickup" : "profile.orders.pay.cashDelivery") };
};

export const updateOrderStatus = (orderId, status) =>
  request(`/engagement/provider/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });

export function StatusBadge({ status, t }) {
  return <span className={`status-badge status-${status} po-status`}>{t(`profile.orders.status.${status}`, { defaultValue: status })}</span>;
}

export function Avatar({ name }) {
  return <span className="po-avatar" aria-hidden="true">{(name || "?").trim().slice(0, 1).toUpperCase()}</span>;
}

export const MoreIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);

export { formatUgx };
