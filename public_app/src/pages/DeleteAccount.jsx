import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { loginPath } from "../lib/authRedirect";
import { clearSession, getSession } from "../lib/session";
import SiteHeader from "../components/SiteHeader";
import { IconCheck, IconLock } from "../components/icons";

const BLOCKED = {
  DELETE_VIA_SUPPORT: "errSupport",
  DELETE_BLOCKED_RIDE: "errBlockedRide",
  DELETE_BLOCKED_TICKETS: "errBlockedTickets",
  DELETE_BLOCKED_ORDERS: "errBlockedOrders",
  DELETE_BLOCKED_BOOKINGS: "errBlockedBookings",
  DELETE_BLOCKED_BALANCE: "errBlockedBalance",
  DELETE_BLOCKED_PAYOUT: "errBlockedPayout",
  DELETE_BLOCKED_CUSTOMER_ORDERS: "errBlockedCustomerOrders",
  DELETE_BLOCKED_CUSTOMER_BOOKINGS: "errBlockedCustomerBookings",
  CONFIRMATION_REQUIRED: "errConfirm",
  INVALID_PASSWORD: "errPassword"
};

// Account deletion: linked from the menu and the footer, and the URL to give Google Play ("/account/delete").
export default function DeleteAccount() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // Accounts created with Google have no password to ask for.
  const needsPassword = session?.user?.authProvider === "password";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (confirm.trim().toUpperCase() !== "DELETE") {
      setError(t("deleteAccount.errConfirm"));
      return;
    }
    setBusy(true);
    try {
      await request("/auth/me/delete", { method: "POST", body: JSON.stringify({ password, confirm: confirm.trim() }) });
      clearSession();
      setSession(null);
      setDone(true);
    } catch (e) {
      const key = BLOCKED[e.code];
      setError(key ? t(`deleteAccount.${key}`) : t("deleteAccount.errFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={() => { clearSession(); setSession(null); navigate("/home"); }} />
      <div className="da-page">
        {done ? (
          <section className="da-card da-done">
            <span className="da-badge da-badge-ok"><IconCheck /></span>
            <h1>{t("deleteAccount.doneTitle")}</h1>
            <p>{t("deleteAccount.doneText")}</p>
            <Link to="/home" className="cta-button">{t("deleteAccount.backHome")}</Link>
          </section>
        ) : (
          <>
            <section className="da-card">
              <span className="da-badge"><IconLock /></span>
              <h1>{t("deleteAccount.title")}</h1>
              <p className="da-lead">{t("deleteAccount.intro")}</p>
              <h2>{t("deleteAccount.removedTitle")}</h2>
              <ul>
                <li>{t("deleteAccount.removed1")}</li>
                <li>{t("deleteAccount.removed2")}</li>
                <li>{t("deleteAccount.removed3")}</li>
              </ul>
              <h2>{t("deleteAccount.keptTitle")}</h2>
              <p>{t("deleteAccount.kept")}</p>
            </section>

            {session ? (
              <form className="da-card" onSubmit={submit}>
                {needsPassword ? (
                  <label className="da-field">
                    <span>{t("deleteAccount.passwordLabel")}</span>
                    <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                ) : null}
                <label className="da-field">
                  <span>{t("deleteAccount.confirmLabel")}</span>
                  <input type="text" autoCapitalize="characters" autoComplete="off" value={confirm} placeholder={t("deleteAccount.confirmPlaceholder")} onChange={(e) => setConfirm(e.target.value)} />
                </label>
                {error ? <div className="error-message">{error}</div> : null}
                <div className="da-actions">
                  <button type="submit" className="da-danger" disabled={busy || (needsPassword && !password)}>
                    {busy ? t("deleteAccount.deleting") : t("deleteAccount.delete")}
                  </button>
                  <Link to="/home" className="secondary-button">{t("deleteAccount.keep")}</Link>
                </div>
              </form>
            ) : (
              <section className="da-card">
                <h2>{t("deleteAccount.signInTitle")}</h2>
                <p>{t("deleteAccount.signInText")}</p>
                <Link to={loginPath(location)} className="cta-button">{t("deleteAccount.signIn")}</Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
