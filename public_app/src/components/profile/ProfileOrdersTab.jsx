import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { IconBox } from "../icons";
import { SectionSkeleton } from "../Skeleton";

const STATUS_LABELS = {
  pending: "New",
  accepted: "Accepted",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  canceled: "Canceled"
};

const NEXT_ACTIONS = {
  pending: [{ status: "accepted", label: "Accept" }, { status: "rejected", label: "Reject" }],
  accepted: [{ status: "fulfilled", label: "Mark fulfilled" }, { status: "canceled", label: "Cancel" }]
};

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function ProfileOrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const load = () => {
    setLoading(true);
    request("/engagement/provider/orders?limit=50")
      .then((result) => setOrders(result?.items || []))
      .catch((loadError) => setError(loadError.message || "Unable to load your orders."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
            <div key={order.id} className="order-card">
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

              {NEXT_ACTIONS[order.status] ? (
                <div className="listing-actions order-actions">
                  {NEXT_ACTIONS[order.status].map((action) => (
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
    </section>
  );
}
