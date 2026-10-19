import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import { safeNext } from "../lib/authRedirect";
import { claimInterest } from "../lib/tracking";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Where to go once signed in: the page the visitor came from, else home.
  const destination = safeNext(searchParams.get("next")) || "/home";
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [reconnectEmail, setReconnectEmail] = useState("");
  const [reconnectSending, setReconnectSending] = useState(false);
  const [reconnectSent, setReconnectSent] = useState(false);
  const [reconnectError, setReconnectError] = useState("");

  useEffect(() => {
    if (getSession()) {
      navigate(destination, { replace: true });
    }
  }, [navigate, destination]);

  const handleCredential = async (response) => {
    setSigningIn(true);
    setError("");
    try {
      const result = await request("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: response.credential })
      });
      setSession(result);
      claimInterest(); // what this device browsed before signing in now belongs to the account
      // A brand-new account gets the short welcome form first, then continues to where it was going.
      // Bus companies go straight to their portal unless they were sent somewhere specific.
      const target = result.busOperator && !searchParams.get("next") ? "/bus/operator" : destination;
      navigate(result.isNewUser ? `/welcome?next=${encodeURIComponent(destination)}` : target, { replace: true });
    } catch (submitError) {
      setError(submitError.message || t("auth.signInFailed"));
    } finally {
      setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError(t("auth.googleNotConfigured"));
      return;
    }
    let active = true;
    loadGoogleIdentity()
      .then((google) => {
        if (!active || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: 320,
          text: "continue_with"
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || t("auth.googleLoadFailed"));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitReconnect = async (event) => {
    event.preventDefault();
    if (!reconnectEmail.trim()) return;
    setReconnectSending(true);
    setReconnectError("");
    try {
      await request("/providers/link-google/request", {
        method: "POST",
        body: JSON.stringify({ email: reconnectEmail.trim() })
      });
      setReconnectSent(true);
    } catch (submitError) {
      setReconnectError(submitError.message || t("auth.reconnectFailed"));
    } finally {
      setReconnectSending(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">G</span><strong>Gabla</strong></div>
        <p className="eyebrow">{t("auth.eyebrow")}</p>
        <h1>{t("auth.title")}</h1>
        <p className="auth-subtitle">{t("auth.subtitle")}</p>

        {location.state?.message ? <div className="info-message">{location.state.message}</div> : null}
        {error ? <div className="error-message">{error}</div> : null}

        <div className="google-button-slot" ref={buttonRef} />
        {signingIn ? <p className="auth-hint">{t("auth.signingIn")}</p> : null}

        {!reconnectOpen ? (
          <button type="button" className="link-button reconnect-toggle" onClick={() => setReconnectOpen(true)}>
            {t("auth.reconnectToggle")}
          </button>
        ) : reconnectSent ? (
          <p className="info-message">{t("auth.reconnectSent")}</p>
        ) : (
          <form className="reconnect-form" onSubmit={submitReconnect}>
            <p className="auth-hint">{t("auth.reconnectHelp")}</p>
            {reconnectError ? <div className="error-message">{reconnectError}</div> : null}
            <input
              type="email"
              required
              value={reconnectEmail}
              onChange={(e) => setReconnectEmail(e.target.value)}
              placeholder={t("auth.reconnectEmailPlaceholder")}
            />
            <button type="submit" className="secondary-button" disabled={reconnectSending}>
              {reconnectSending ? t("auth.sending") : t("auth.sendReconnect")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
