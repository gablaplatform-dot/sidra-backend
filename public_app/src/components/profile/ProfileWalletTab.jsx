import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { IconReceipt, IconWallet } from "../icons";
import SubscriptionModal from "../SubscriptionModal";

const TYPE_LABELS = {
  purchase: "Product purchase",
  contact_unlock: "Contact unlock",
  subscription: "Subscription",
  withdrawal: "Withdrawal"
};

const STATUS_LABELS = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function ProfileWalletTab() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      request("/payments/wallet"),
      request("/payments/transactions?limit=20"),
      request("/payments/withdrawals?limit=20"),
      request("/payments/subscription")
    ])
      .then(([walletResult, txResult, withdrawalResult, subscriptionResult]) => {
        setWallet(walletResult);
        setTransactions(txResult?.items || []);
        setWithdrawals(withdrawalResult?.items || []);
        setSubscription(subscriptionResult);
      })
      .catch((loadError) => setError(loadError.message || "Unable to load your wallet."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!amountValue || amountValue <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await request("/payments/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amount: amountValue, note: note.trim() || undefined })
      });
      setNotice("Withdrawal requested. You'll be notified once it's reviewed.");
      setAmount("");
      setNote("");
      setFormOpen(false);
      load();
    } catch (submitError) {
      setError(submitError.message || "Unable to request a withdrawal.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="home-empty page-loading">Loading your wallet…</p>;

  return (
    <section className="detail-block">
      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <div className="wallet-balance-card">
        <div className="wallet-balance-icon"><IconWallet /></div>
        <div>
          <p className="provider-meta">Available balance</p>
          <h2 className="wallet-balance-amount">{formatUgx(wallet?.balance)}</h2>
        </div>
        <button type="button" className="cta-button wallet-withdraw-button" onClick={() => setFormOpen((open) => !open)}>
          Request withdrawal
        </button>
      </div>

      {subscription ? (
        <div className="wallet-list-row">
          <div>
            <strong>Subscription</strong>
            <p className="provider-meta">
              {subscription.status === "active" && subscription.expiresAt
                ? `Active until ${formatDate(subscription.expiresAt)}`
                : "Not active"}
            </p>
          </div>
          {subscription.enabled ? (
            <button type="button" className="cta-button" onClick={() => setSubscriptionModalOpen(true)}>
              {subscription.status === "active" ? "Renew" : "Activate"}
            </button>
          ) : null}
        </div>
      ) : null}

      {formOpen ? (
        <form className="wallet-withdraw-form" onSubmit={submitWithdrawal}>
          <div className="form-grid two">
            <label className="field">
              <span>Amount (UGX)</span>
              <input type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              <span>Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. mobile money number" />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={submitting} style={{ width: "auto", padding: "10px 24px" }}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      ) : null}

      <h2 className="wallet-section-title">Withdrawal history</h2>
      {withdrawals.length ? (
        <div className="wallet-list">
          {withdrawals.map((w) => (
            <div key={w.id} className="wallet-list-row">
              <div>
                <strong>{formatUgx(w.netAmount)}</strong>
                <p className="provider-meta">{formatDate(w.createdAt)}{w.note ? ` · ${w.note}` : ""}</p>
              </div>
              <span className={`status-badge status-${w.status}`}>{STATUS_LABELS[w.status] || w.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconWallet />
          <p>No withdrawal requests yet.</p>
        </div>
      )}

      <h2 className="wallet-section-title">Transaction history</h2>
      {transactions.length ? (
        <div className="wallet-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="wallet-list-row">
              <div>
                <strong>{TYPE_LABELS[tx.type] || tx.type}</strong>
                <p className="provider-meta">{formatDate(tx.createdAt)} &middot; net {formatUgx(tx.netAmount)}</p>
              </div>
              <span className={`status-badge status-${tx.status}`}>{STATUS_LABELS[tx.status] || tx.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconReceipt />
          <p>No transactions yet.</p>
        </div>
      )}

      {subscriptionModalOpen ? (
        <SubscriptionModal
          fee={subscription?.fee}
          onClose={() => setSubscriptionModalOpen(false)}
          onActivated={load}
        />
      ) : null}
    </section>
  );
}
