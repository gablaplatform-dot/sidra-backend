import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { clearSession, getSession, setSession } from "../../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../../lib/google";
import { Field, errMsg } from "../../components/bus/operator/ui";
import BrandPanel, { Logo } from "../../components/bus/operator/BrandPanel";
import { IcAlert, IcCheck, IcInfo } from "../../components/bus/operator/icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERKS = ["perk1", "perk2", "perk3"];

export default function BusOperatorLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
        setError(t("busOp.login.notOperator"));
        return;
      }
      if (result.busOperator?.onboardingStatus !== "registered") {
        clearSession();
        setNotice(t("busOp.login.notFinished"));
        return;
      }
      setSession(result);
      navigate("/bus/operator", { replace: true });
    },
    [navigate, t]
  );

  const handleCredential = useCallback(
    async (response) => {
      setBusy(true);
      setError("");
      try {
        accept(await request("/auth/google", { method: "POST", body: JSON.stringify({ idToken: response.credential }) }));
      } catch (e) {
        setError(errMsg(e, t("busOp.login.googleFailed")));
      } finally {
        setBusy(false);
      }
    },
    [accept, t]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleNote(t("busOp.login.googleUnavailable"));
      return undefined;
    }
    let active = true;
    loadGoogleIdentity()
      .then((g) => {
        if (!active || !googleRef.current) return;
        g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
        g.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", shape: "pill", width: 320, text: "signin_with" });
      })
      .catch(() => active && setGoogleNote(t("busOp.login.googleLoadFailed")));
    return () => { active = false; };
  }, [handleCredential, t]);

  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? t("busOp.login.emailInvalid") : "";
  const passError = touched.password && !password ? t("busOp.login.passwordRequired") : "";

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
      setError(err.status === 401 || err.code === "INVALID_CREDENTIALS" ? t("busOp.login.badCredentials") : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bus-app bop-login">
      <BrandPanel>
        <span className="bop-eyebrow is-light">{t("busOp.login.eyebrow")}</span>
        <h1>{t("busOp.login.headline")}</h1>
        <ul className="bop-perks">
          {PERKS.map((k) => <li key={k}><span><IcCheck size={13} strokeWidth={3.2} /></span>{t(`busOp.login.${k}`)}</li>)}
        </ul>
      </BrandPanel>

      <main className="bop-login-main" id="main">
        <div className="bop-login-mobilebrand"><Logo light={false} /></div>
        <form className="bop-login-card" onSubmit={submit} noValidate>
          <span className="bop-eyebrow">{t("busOp.login.eyebrow")}</span>
          <h2>{t("busOp.login.welcome")}</h2>
          <p className="bop-lead">{t("busOp.login.lead")}</p>

          {notice ? <div className="bop-alert is-warn" role="status"><IcInfo size={18} /><span>{notice}</span></div> : null}
          {error ? <div className="bop-alert is-error" role="alert"><IcAlert size={18} /><span>{error}</span></div> : null}

          <div className="bop-google-wrap">
            {GOOGLE_CLIENT_ID ? <div ref={googleRef} className="bop-google-slot" /> : null}
            {googleNote ? <p className="bop-hint">{googleNote}</p> : null}
          </div>
          <div className="bop-or"><span>{t("busOp.login.orEmail")}</span></div>

          <Field label={t("busOp.login.email")} error={emailError}>
            <input className="bop-input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} placeholder="you@company.com" aria-invalid={Boolean(emailError)} />
          </Field>
          <Field label={t("busOp.login.password")} error={passError}>
            <span className="bop-pass">
              <input className="bop-input" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))} aria-invalid={Boolean(passError)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? t("busOp.login.hide") : t("busOp.login.show")}</button>
            </span>
          </Field>
          <button type="submit" className="bop-btn bop-btn-primary bop-btn-lg bop-btn-block" disabled={busy}>{busy ? t("busOp.login.signingIn") : t("nav.signIn")}</button>

          <p className="bop-login-foot">{t("busOp.login.newCompany")}</p>
          <p className="bop-login-foot"><Link to="/bus" className="bop-textlink">{t("busOp.login.buyTicket")}</Link></p>
        </form>
      </main>
    </div>
  );
}
