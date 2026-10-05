import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../../lib/api";
import { clearSession, getSession, setSession } from "../../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../../lib/google";
import { IconBus, IconCheck } from "../../components/icons";
import { Field, errMsg } from "../../components/bus/operator/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BusOperatorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [googleNote, setGoogleNote] = useState("");
  const googleRef = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (s?.user?.role === "bus_operator" && s.busOperator?.onboardingStatus !== "invitation_sent") navigate("/bus/operator", { replace: true });
  }, [navigate]);

  // Only registered bus companies get in; anyone else is told why.
  const accept = useCallback(
    (result) => {
      setError("");
      setNotice("");
      if (result?.user?.role !== "bus_operator") {
        clearSession();
        setError("This account isn’t a bus company account. Bus companies are invited by Gabla, so please use the email your invitation was sent to. Looking for tickets? Go to Gabla Bus.");
        return;
      }
      if (result.busOperator?.onboardingStatus !== "registered") {
        clearSession();
        setNotice("Your company hasn’t finished setting up yet. Please open the invitation email from Gabla and follow the link to complete your onboarding. Need a new link? Ask Gabla to resend your invitation.");
        return;
      }
      setSession(result);
      navigate("/bus/operator", { replace: true });
    },
    [navigate]
  );

  const handleCredential = useCallback(
    async (response) => {
      setBusy(true);
      setError("");
      try {
        accept(await request("/auth/google", { method: "POST", body: JSON.stringify({ idToken: response.credential }) }));
      } catch (e) {
        setError(errMsg(e, "Google sign-in failed. Please try again."));
      } finally {
        setBusy(false);
      }
    },
    [accept]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleNote("Google sign-in isn’t available right now. Use your email and password.");
      return undefined;
    }
    let active = true;
    loadGoogleIdentity()
      .then((g) => {
        if (!active || !googleRef.current) return;
        g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
        g.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", shape: "pill", width: 320, text: "signin_with" });
      })
      .catch(() => active && setGoogleNote("Couldn’t load Google sign-in. Use your email and password."));
    return () => { active = false; };
  }, [handleCredential]);

  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : "";
  const passError = touched.password && !password ? "Enter your password." : "";

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      accept(await request("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }));
    } catch (err) {
      setError(err.status === 401 || err.code === "INVALID_CREDENTIALS" ? "That email and password don’t match. Check them and try again." : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bus-app bop-login">
      <aside className="bop-login-art">
        <span className="bus-brand">
          <span className="bus-brand-mark"><IconBus /></span>
          <span className="bus-brand-text"><strong>Gabla Bus</strong><small>For bus companies</small></span>
        </span>
        <div className="bop-login-copy">
          <h1>Run your buses from one place.</h1>
          <ul>
            {["Sell tickets online and get paid by mobile money", "Check passengers in with a ticket scan", "See sales, trips and customers every day"].map((t) => (
              <li key={t}><span><IconCheck width={14} height={14} /></span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="bop-login-road" aria-hidden="true" />
      </aside>

      <main className="bop-login-main">
        <form className="bus-card bop-login-card" onSubmit={submit} noValidate>
          <span className="bop-eyebrow">Bus company portal</span>
          <h2>Sign in</h2>
          <p className="bop-lead">Welcome back. Sign in to manage your routes, trips and tickets.</p>

          {notice ? <div className="bus-alert bus-alert-warn" role="status">{notice}</div> : null}
          {error ? <div className="bus-alert bus-alert-error" role="alert">{error}</div> : null}

          <div className="bop-google-wrap">
            {GOOGLE_CLIENT_ID ? <div ref={googleRef} className="bop-google-slot" /> : null}
            {googleNote ? <p className="bus-hint">{googleNote}</p> : null}
          </div>
          <div className="bop-or"><span>or use your email</span></div>

          <Field label="Email" error={emailError}>
            <input className="bus-input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} placeholder="you@company.com" aria-invalid={Boolean(emailError)} />
          </Field>
          <Field label="Password" error={passError}>
            <input className="bus-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} aria-invalid={Boolean(passError)} />
          </Field>
          <button type="submit" className="bus-btn bus-btn-primary bus-btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

          <p className="bop-login-foot">New bus company? Gabla invites you by email — open the link in that email to get started.</p>
          <p className="bop-login-foot"><Link to="/bus" className="bus-link">Looking to buy a ticket? Go to Gabla Bus</Link></p>
        </form>
      </main>
    </div>
  );
}
