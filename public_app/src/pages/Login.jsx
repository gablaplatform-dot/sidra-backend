import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
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
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const handleCredential = async (response) => {
    setSigningIn(true);
    setError("");
    try {
      const result = await request("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: response.credential })
      });
      setSession(result);
      navigate("/home", { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured yet.");
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
        if (active) setError(loadError.message || "Unable to load Google sign-in");
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
      setReconnectError(submitError.message || "Unable to send a link right now.");
    } finally {
      setReconnectSending(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">G</span><strong>Gabla</strong></div>
        <p className="eyebrow">Welcome</p>
        <h1>Sign in to continue</h1>
        <p className="auth-subtitle">Use your Google account to access Gabla. No password needed.</p>

        {location.state?.message ? <div className="info-message">{location.state.message}</div> : null}
        {error ? <div className="error-message">{error}</div> : null}

        <div className="google-button-slot" ref={buttonRef} />
        {signingIn ? <p className="auth-hint">Signing you in…</p> : null}

        {!reconnectOpen ? (
          <button type="button" className="link-button reconnect-toggle" onClick={() => setReconnectOpen(true)}>
            Signed in before as a service provider but don&apos;t see your profile?
          </button>
        ) : reconnectSent ? (
          <p className="info-message">If that email belongs to a provider account, we&apos;ve sent a link to reconnect Google sign-in. Check your inbox.</p>
        ) : (
          <form className="reconnect-form" onSubmit={submitReconnect}>
            <p className="auth-hint">Enter the email your business was registered with and we&apos;ll send you a link to reconnect Google sign-in.</p>
            {reconnectError ? <div className="error-message">{reconnectError}</div> : null}
            <input
              type="email"
              required
              value={reconnectEmail}
              onChange={(e) => setReconnectEmail(e.target.value)}
              placeholder="you@business.com"
            />
            <button type="submit" className="secondary-button" disabled={reconnectSending}>
              {reconnectSending ? "Sending…" : "Send reconnect link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
