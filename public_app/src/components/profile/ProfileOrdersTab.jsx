import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { IconBox } from "../icons";

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

  if (loading) return <p className="home-empty page-loading">Loading your orders…</p>;

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

              {order.customer?.phone || order.customer?.email ? (
                <p className="provider-meta">
                  Contact: {[order.customer?.phone, order.customer?.email].filter(Boolean).join(" · ")}
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
