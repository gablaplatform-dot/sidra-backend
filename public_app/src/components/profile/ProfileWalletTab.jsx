import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { formatUgx } from "../../lib/format";
import { intlLocale } from "../../i18n";
import { IconReceipt, IconWallet } from "../icons";
import SubscriptionModal from "../SubscriptionModal";
import { SectionSkeleton } from "../Skeleton";

const formatDate = (value) => new Date(value).toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });

export default function ProfileWalletTab() {
  const { t } = useTranslation();
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
      .catch((loadError) => setError(loadError.message || t("profile.wallet.errLoad")))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!amountValue || amountValue <= 0) {
      setError(t("profile.wallet.errAmount"));
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
      setNotice(t("profile.wallet.requested"));
      setAmount("");
      setNote("");
      setFormOpen(false);
      load();
    } catch (submitError) {
      setError(submitError.message || t("profile.wallet.errWithdraw"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SectionSkeleton rows={4} label={t("profile.wallet.loading")} />;

  return (
    <section className="detail-block">
      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <div className="wallet-balance-card">
        <div className="wallet-balance-icon"><IconWallet /></div>
        <div>
          <p className="provider-meta">{t("profile.wallet.balance")}</p>
          <h2 className="wallet-balance-amount">{formatUgx(wallet?.balance)}</h2>
        </div>
        <button type="button" className="cta-button wallet-withdraw-button" onClick={() => setFormOpen((open) => !open)}>
          {t("profile.wallet.requestWithdrawal")}
        </button>
      </div>

      {subscription ? (
        <div className="wallet-list-row">
          <div>
            <strong>{t("profile.wallet.subscription")}</strong>
            <p className="provider-meta">
              {subscription.status === "active" && subscription.expiresAt
                ? t("profile.wallet.activeUntil", { date: formatDate(subscription.expiresAt) })
                : t("profile.wallet.notActive")}
            </p>
          </div>
          {subscription.enabled ? (
            <button type="button" className="cta-button" onClick={() => setSubscriptionModalOpen(true)}>
              {subscription.status === "active" ? t("profile.wallet.renew") : t("profile.wallet.activate")}
            </button>
          ) : null}
        </div>
      ) : null}

      {formOpen ? (
        <form className="wallet-withdraw-form" onSubmit={submitWithdrawal}>
          <div className="form-grid two">
            <label className="field">
              <span>{t("profile.wallet.amount")}</span>
              <input type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              <span>{t("profile.wallet.noteOptional")}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("profile.wallet.notePlaceholder")} />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={submitting} style={{ width: "auto", padding: "10px 24px" }}>
            {submitting ? t("profile.wallet.submitting") : t("profile.wallet.submit")}
          </button>
        </form>
      ) : null}

      <h2 className="wallet-section-title">{t("profile.wallet.withdrawalHistory")}</h2>
      {withdrawals.length ? (
        <div className="wallet-list">
          {withdrawals.map((w) => (
            <div key={w.id} className="wallet-list-row">
              <div>
                <strong>{formatUgx(w.netAmount)}</strong>
                <p className="provider-meta">{formatDate(w.createdAt)}{w.note ? ` · ${w.note}` : ""}</p>
              </div>
              <span className={`status-badge status-${w.status}`}>{t(`profile.wallet.status.${w.status}`, { defaultValue: w.status })}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconWallet />
          <p>{t("profile.wallet.noWithdrawals")}</p>
        </div>
      )}

      <h2 className="wallet-section-title">{t("profile.wallet.transactionHistory")}</h2>
      {transactions.length ? (
        <div className="wallet-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="wallet-list-row">
              <div>
                <strong>{t(`profile.wallet.type.${tx.type}`, { defaultValue: tx.type })}</strong>
                <p className="provider-meta">{formatDate(tx.createdAt)} &middot; {t("profile.wallet.net", { amount: formatUgx(tx.netAmount) })}</p>
              </div>
              <span className={`status-badge status-${tx.status}`}>{t(`profile.wallet.status.${tx.status}`, { defaultValue: tx.status })}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconReceipt />
          <p>{t("profile.wallet.noTransactions")}</p>
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
