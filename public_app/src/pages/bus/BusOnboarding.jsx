import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { request } from "../../lib/api";
import { setSession } from "../../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../../lib/google";
import { isUgPhone, normalizeUgPhone, ugx, durationLabel } from "../../lib/bus";
import { Skel } from "../../components/Skeleton";
import DynamicField from "../../components/DynamicField";
import { IconBus, IconCheck, IconPin, IconStore, IconTicket, IconUsers } from "../../components/icons";
import { UGANDA_DISTRICTS } from "../../components/bus/operator/districts";
import RouteForm, { emptyRoute, routePayload, routeTitle, validateRoute } from "../../components/bus/operator/RouteForm";
import { Field, IconGoogle, IconPlus, IconTrash, ImageField, daysLabel, errMsg, timeLabel, uploadOnboardingImage } from "../../components/bus/operator/ui";

const STEPS = [
  { key: "account", label: "Sign in", Icon: IconCheck },
  { key: "company", label: "Company", Icon: IconStore },
  { key: "fleet", label: "Fleet", Icon: IconUsers },
  { key: "routes", label: "Routes", Icon: IconPin },
  { key: "review", label: "Finish", Icon: IconTicket }
];

const EMPTY_PROFILE = {
  companyName: "", description: "", logoUrl: "", coverUrl: "", contactPhone: "", whatsapp: "",
  parkName: "", parkDistrict: "", parkAddress: "", parkLat: null, parkLng: null, fleetSize: "", customFields: {}
};

const draftKey = (token) => `gabla_bus_onboarding_${String(token).slice(-24)}`;
const readDraft = (token) => {
  try { return JSON.parse(localStorage.getItem(draftKey(token)) || "null"); } catch { return null; }
};
const writeDraft = (token, value) => {
  try { localStorage.setItem(draftKey(token), JSON.stringify(value)); } catch { /* storage unavailable */ }
};
const clearDraft = (token) => {
  try { localStorage.removeItem(draftKey(token)); } catch { /* ignore */ }
};

const isEmptyAnswer = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

function Shell({ children, wide = false }) {
  return (
    <div className="bus-app bop-ob">
      <header className="bop-ob-top">
        <div className="bop-ob-top-in">
          <span className="bus-brand">
            <span className="bus-brand-mark"><IconBus /></span>
            <span className="bus-brand-text"><strong>Gabla Bus</strong><small>For bus companies</small></span>
          </span>
          <Link to="/bus/operator/login" className="bop-ob-top-link">Sign in</Link>
        </div>
      </header>
      <main className={`bop-ob-main ${wide ? "is-wide" : ""}`}>{children}</main>
    </div>
  );
}

function Notice({ tone = "info", title, children, action }) {
  return (
    <div className="bus-card bop-ob-notice">
      <span className={`bop-ob-notice-icon is-${tone}`}>{tone === "error" ? "!" : <IconCheck />}</span>
      <h1>{title}</h1>
      <p>{children}</p>
      {action}
    </div>
  );
}

export default function BusOnboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [info, setInfo] = useState({ loading: true, error: null, data: null });
  const draft = useMemo(() => (token ? readDraft(token) : null), [token]);

  const [step, setStep] = useState(draft?.step ?? 0);
  const [mode, setMode] = useState(draft?.mode || (GOOGLE_CLIENT_ID ? "google" : "password"));
  const [google, setGoogle] = useState(null); // { email, name } once linked
  const [googleError, setGoogleError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [profile, setProfile] = useState({ ...EMPTY_PROFILE, ...(draft?.profile || {}) });
  const [routes, setRoutes] = useState(draft?.routes?.length ? draft.routes : [emptyRoute()]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const topRef = useRef(null);

  const load = useCallback(() => {
    if (!token) {
      setInfo({ loading: false, error: new Error("missing"), data: null });
      return;
    }
    setInfo({ loading: true, error: null, data: null });
    request(`/bus/onboarding?token=${encodeURIComponent(token)}`)
      .then((data) => setInfo({ loading: false, error: null, data }))
      .catch((error) => setInfo({ loading: false, error, data: null }));
  }, [token]);
  useEffect(load, [load]);

  // Keep progress between visits (never the password).
  useEffect(() => {
    if (token && info.data) writeDraft(token, { step, mode, profile, routes });
  }, [token, info.data, step, mode, profile, routes]);

  // Prefill the company name from the invitation the first time.
  useEffect(() => {
    if (info.data && !profile.companyName) {
      setProfile((p) => ({ ...p, companyName: info.data.operator?.companyName || "", contactPhone: p.contactPhone || info.data.operator?.contactPhone || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.data]);

  const goStep = (n) => {
    setError("");
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // ---- Google
  const googleRef = useRef(null);
  const handleCredential = useCallback(
    async (response) => {
      setGoogleBusy(true);
      setGoogleError("");
      try {
        const result = await request("/bus/onboarding/google", { method: "POST", body: JSON.stringify({ token, idToken: response.credential }) });
        setGoogle({ email: result.user?.email, name: result.user?.name });
      } catch (e) {
        setGoogleError(errMsg(e, "Google sign-in failed. Please try again."));
      } finally {
        setGoogleBusy(false);
      }
    },
    [token]
  );
  useEffect(() => {
    if (step !== 0 || mode !== "google" || google || !info.data) return undefined;
    if (!GOOGLE_CLIENT_ID) return undefined;
    let active = true;
    loadGoogleIdentity()
      .then((g) => {
        if (!active || !googleRef.current) return;
        g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
        g.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", shape: "pill", width: 300, text: "continue_with" });
      })
      .catch((e) => active && setGoogleError(errMsg(e, "Unable to load Google sign-in. Set a password instead.")));
    return () => { active = false; };
  }, [step, mode, google, info.data, handleCredential]);

  const setP = (patch) => setProfile((p) => ({ ...p, ...patch }));
  const questions = info.data?.questions || [];

  // ---- validation per step
  const validate = (n) => {
    if (n === 0) {
      if (mode === "google") return google ? "" : "Sign in with Google to continue, or choose “Set a password”.";
      if (password.length < 8) return "Your password must be at least 8 characters.";
      if (password !== password2) return "The two passwords don’t match.";
      return "";
    }
    if (n === 1) {
      if (profile.companyName.trim().length < 2) return "Enter your company name.";
      if (!isUgPhone(profile.contactPhone)) return "Enter a valid Ugandan phone number, like 0772 123 456.";
      if (profile.whatsapp.trim() && !isUgPhone(profile.whatsapp)) return "The WhatsApp number isn’t valid. Leave it empty or use a Ugandan number.";
      if (!profile.parkName.trim()) return "Enter the name of your bus park.";
      if (!profile.parkDistrict) return "Choose the district where your bus park is.";
      return "";
    }
    if (n === 2) {
      const fleet = Number(profile.fleetSize);
      if (profile.fleetSize === "" || !Number.isInteger(fleet) || fleet < 1) return "Enter how many buses you operate (at least 1).";
      for (const q of questions) {
        if (q.required && isEmptyAnswer(profile.customFields[q.key])) return `Please answer: ${q.label}`;
      }
      return "";
    }
    if (n === 3) {
      for (let i = 0; i < routes.length; i += 1) {
        const msg = validateRoute(routes[i]);
        if (msg) { setActiveRoute(i); return `${routes.length > 1 ? `Route ${i + 1}: ` : ""}${msg}`; }
      }
      return "";
    }
    return "";
  };

  const next = () => {
    const msg = validate(step);
    if (msg) { setError(msg); return; }
    goStep(step + 1);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setP({ parkLat: Number(pos.coords.latitude.toFixed(6)), parkLng: Number(pos.coords.longitude.toFixed(6)) }); setLocating(false); },
      () => { setLocating(false); setError("We couldn’t get your location. You can skip this."); },
      { timeout: 8000 }
    );
  };

  const submit = async () => {
    for (let n = 0; n <= 3; n += 1) {
      const msg = validate(n);
      if (msg) { setStep(n); setError(msg); return; }
    }
    setSubmitting(true);
    setError("");
    try {
      const body = {
        token,
        ...(mode === "password" ? { password } : {}),
        profile: {
          companyName: profile.companyName.trim(),
          description: profile.description.trim(),
          logoUrl: profile.logoUrl || "",
          coverUrl: profile.coverUrl || "",
          contactPhone: normalizeUgPhone(profile.contactPhone),
          ...(profile.whatsapp.trim() ? { whatsapp: normalizeUgPhone(profile.whatsapp) } : {}),
          parkName: profile.parkName.trim(),
          parkDistrict: profile.parkDistrict,
          parkAddress: profile.parkAddress.trim(),
          ...(profile.parkLat != null ? { parkLat: profile.parkLat, parkLng: profile.parkLng } : {}),
          fleetSize: Number(profile.fleetSize),
          customFields: profile.customFields
        },
        routes: routes.map((r) => routePayload(r))
      };
      const result = await request("/bus/onboarding/complete", { method: "POST", body: JSON.stringify(body) });
      clearDraft(token);
      setSession({ accessToken: result.accessToken, user: result.user, provider: null, busOperator: result.busOperator });
      navigate("/bus/operator", { replace: true });
    } catch (e) {
      if (e.code === "BUS_QUESTION_REQUIRED") setStep(2);
      else if (e.code === "BUS_ROUTE_REQUIRED" || /route|ticket|bus type/i.test(e.message || "")) setStep(3);
      if (e.code === "INVALID_TOKEN") { setInfo({ loading: false, error: e, data: null }); return; }
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------- states before the wizard
  if (info.loading) {
    return (
      <Shell>
        <div className="bus-card bop-ob-card" role="status" aria-busy="true" aria-label="Loading your invitation">
          <Skel w="40%" h={14} /><Skel w="75%" h={30} style={{ marginTop: 14 }} /><Skel w="90%" h={14} style={{ marginTop: 12 }} />
          <div style={{ display: "grid", gap: 12, marginTop: 28 }}><Skel h={48} r={12} /><Skel h={48} r={12} /><Skel h={48} r={12} /></div>
        </div>
      </Shell>
    );
  }
  if (info.error) {
    const invalid = !token || info.error.code === "INVALID_TOKEN" || info.error.status === 404 || (info.error.status === 400 && info.error.code !== undefined);
    return (
      <Shell>
        <Notice
          tone="error"
          title={invalid ? "This invitation link isn’t valid" : "We couldn’t load your invitation"}
          action={invalid ? <Link to="/bus/operator/login" className="bus-btn bus-btn-light">I already have an account</Link> : <button className="bus-btn bus-btn-primary" onClick={load}>Try again</button>}
        >
          {invalid
            ? "The link may have expired (invitations last 7 days) or been replaced by a newer one. Please ask Gabla to send you a new invitation email, then open the link in that email."
            : errMsg(info.error)}
        </Notice>
      </Shell>
    );
  }
  const { operator, email } = info.data;
  if (operator?.onboardingStatus === "registered") {
    return (
      <Shell>
        <Notice title="You’re already registered" action={<Link to="/bus/operator/login" className="bus-btn bus-btn-primary">Sign in to your portal</Link>}>
          {operator.companyName} has already finished setting up. Sign in with your email or Google account to manage your buses.
        </Notice>
      </Shell>
    );
  }

  const pct = Math.round((step / (STEPS.length - 1)) * 100);
  const route = routes[Math.min(activeRoute, routes.length - 1)];
  const setRoute = (value) => setRoutes((list) => list.map((r, i) => (i === activeRoute ? value : r)));
  const canGoNext = step === 0 ? (mode === "google" ? Boolean(google) : password.length >= 8 && password === password2) : true;

  return (
    <Shell wide={step === 3}>
      <div ref={topRef} className="bop-ob-scroll" />
      <ol className="bop-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`${i === step ? "is-current" : ""} ${i < step ? "is-done" : ""}`}>
            <button type="button" disabled={i > step} onClick={() => goStep(i)} aria-current={i === step ? "step" : undefined}>
              <span className="bop-step-dot">{i < step ? <IconCheck width={14} height={14} /> : i + 1}</span>
              <span className="bop-step-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="bop-progress" aria-hidden="true"><span style={{ width: `${Math.max(6, pct)}%` }} /></div>

      <div className="bus-card bop-ob-card">
        {step === 0 ? (
          <>
            <span className="bop-eyebrow">Welcome</span>
            <h1>Let’s get {operator.companyName} selling tickets</h1>
            <p className="bop-lead">It takes about 5 minutes: tell us about your company and bus park, then add your first route and prices. Passengers can start booking right after.</p>
            <Field label="Invited email" hint="Your invitation was sent to this address, so it can’t be changed.">
              <input className="bus-input" value={email} readOnly aria-readonly="true" />
            </Field>

            <div className="bop-modes" role="tablist">
              <button type="button" role="tab" aria-selected={mode === "google"} className={mode === "google" ? "is-on" : ""} onClick={() => { setMode("google"); setError(""); }}>Continue with Google</button>
              <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "is-on" : ""} onClick={() => { setMode("password"); setError(""); }}>Set a password</button>
            </div>

            {mode === "google" ? (
              <div className="bop-mode-body">
                {google ? (
                  <div className="bus-alert bus-alert-success">Signed in as <strong>{google.email}</strong>. You’re all set to continue.</div>
                ) : GOOGLE_CLIENT_ID ? (
                  <>
                    <p className="bus-hint" style={{ marginBottom: 12 }}>Sign in with the Google account for <strong>{email}</strong>. Other Google accounts won’t work.</p>
                    <div ref={googleRef} className="bop-google-slot" />
                    {googleBusy ? <p className="bus-hint">Checking your Google account…</p> : null}
                  </>
                ) : (
                  <div className="bus-alert bus-alert-warn">Google sign-in isn’t available here right now. Please choose “Set a password” instead.</div>
                )}
                {googleError ? <div className="bus-alert bus-alert-error" role="alert" style={{ marginTop: 12 }}>{googleError}</div> : null}
              </div>
            ) : (
              <div className="bop-mode-body bop-grid2">
                <Field label="Password" hint="At least 8 characters">
                  <input className="bus-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Field label="Confirm password">
                  <input className="bus-input" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </Field>
              </div>
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <span className="bop-eyebrow">Step 2 of 5</span>
            <h1>Your company and bus park</h1>
            <p className="bop-lead">This is what passengers see when they find your buses.</p>
            <div className="bop-form">
              <Field label="Company name"><input className="bus-input" value={profile.companyName} onChange={(e) => setP({ companyName: e.target.value })} maxLength={120} /></Field>
              <Field label="About your company (optional)"><textarea className="bus-textarea" rows={3} value={profile.description} onChange={(e) => setP({ description: e.target.value })} maxLength={2000} placeholder="Years on the road, comfort, safety, where you travel…" /></Field>
              <div className="bop-grid2">
                <ImageField label="Logo" kind="logo" value={profile.logoUrl} onChange={(v) => setP({ logoUrl: v })} uploader={(f) => uploadOnboardingImage(f, token)} hint="Square image works best (optional)" />
                <ImageField label="Cover photo" kind="cover" value={profile.coverUrl} onChange={(v) => setP({ coverUrl: v })} uploader={(f) => uploadOnboardingImage(f, token)} hint="A wide photo of your buses (optional)" />
              </div>
              <div className="bop-grid2">
                <Field label="Contact phone" hint="Passengers and Gabla call this number"><input className="bus-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={profile.contactPhone} onChange={(e) => setP({ contactPhone: e.target.value })} /></Field>
                <Field label="WhatsApp (optional)"><input className="bus-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={profile.whatsapp} onChange={(e) => setP({ whatsapp: e.target.value })} /></Field>
              </div>

              <div className="bop-park">
                <h3>Where is your bus park?</h3>
                <Field label="Bus park name"><input className="bus-input" placeholder="e.g. Namirembe Road Bus Park" value={profile.parkName} onChange={(e) => setP({ parkName: e.target.value })} maxLength={120} /></Field>
                <div className="bop-grid2">
                  <Field label="District">
                    <select className="bus-select" value={profile.parkDistrict} onChange={(e) => setP({ parkDistrict: e.target.value })}>
                      <option value="">Choose a district</option>
                      {UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Address / landmark (optional)"><input className="bus-input" placeholder="Opposite the taxi park, Gate 3" value={profile.parkAddress} onChange={(e) => setP({ parkAddress: e.target.value })} maxLength={240} /></Field>
                </div>
                <div className="bop-loc">
                  <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={useMyLocation} disabled={locating}><IconPin width={16} height={16} /> {locating ? "Locating…" : "Pin my current location"}</button>
                  {profile.parkLat != null ? <span className="bus-chip bus-chip-green">Location saved ({profile.parkLat}, {profile.parkLng})</span> : <small className="bus-hint">Optional. Helps passengers find the park.</small>}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <span className="bop-eyebrow">Step 3 of 5</span>
            <h1>Your fleet</h1>
            <p className="bop-lead">A few quick questions so Gabla knows who it’s working with.</p>
            <div className="bop-form">
              <Field label="How many buses do you operate?"><input className="bus-input bop-narrow" type="number" min="1" max="5000" inputMode="numeric" value={profile.fleetSize} onChange={(e) => setP({ fleetSize: e.target.value })} /></Field>
              {questions.map((q) => (
                <div className="bus-field bop-dyn" key={q.key}>
                  <span>{q.label}{q.required ? <b className="bop-req"> *</b> : <i> (optional)</i>}</span>
                  <DynamicField field={q} value={profile.customFields[q.key]} onChange={(v) => setP({ customFields: { ...profile.customFields, [q.key]: v } })} />
                  {q.unit ? <small className="bus-hint">Unit: {q.unit}</small> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <span className="bop-eyebrow">Step 4 of 5</span>
            <h1>Add your first route</h1>
            <p className="bop-lead">Set where you travel, what tickets cost, and when buses leave. You can add more routes now or later.</p>
            <div className="bop-routetabs">
              {routes.map((r, i) => (
                <button key={i} type="button" className={`bus-chip ${i === activeRoute ? "is-active" : ""}`} onClick={() => setActiveRoute(i)}>{routeTitle(r)}</button>
              ))}
              <button type="button" className="bus-chip bus-chip-orange" disabled={routes.length >= 10} onClick={() => { setRoutes([...routes, emptyRoute()]); setActiveRoute(routes.length); }}><IconPlus width={14} height={14} /> Add another route</button>
            </div>
            <RouteForm value={route} onChange={setRoute} busTypes={info.data.busTypes} />
            {routes.length > 1 ? (
              <button type="button" className="bus-btn bus-btn-light bus-btn-sm" style={{ marginTop: 16 }} onClick={() => { setRoutes(routes.filter((_, i) => i !== activeRoute)); setActiveRoute(0); }}>
                <IconTrash width={16} height={16} /> Remove this route
              </button>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <span className="bop-eyebrow">Last step</span>
            <h1>Review and finish</h1>
            <p className="bop-lead">Check everything looks right. You can change all of this later from your portal.</p>
            <div className="bop-review">
              <section>
                <header><h3>Company</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(1)}>Edit</button></header>
                <div className="bop-review-company">
                  <span className="bop-review-logo">{profile.logoUrl ? <img src={profile.logoUrl} alt="" /> : profile.companyName.slice(0, 1)}</span>
                  <div><strong>{profile.companyName}</strong><p>{email}</p><p>{profile.contactPhone}{profile.whatsapp ? ` · WhatsApp ${profile.whatsapp}` : ""}</p></div>
                </div>
                <p><IconPin width={14} height={14} /> {profile.parkName}, {profile.parkDistrict}{profile.parkAddress ? ` (${profile.parkAddress})` : ""}</p>
              </section>
              <section>
                <header><h3>Fleet</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(2)}>Edit</button></header>
                <p><strong>{profile.fleetSize}</strong> bus{Number(profile.fleetSize) === 1 ? "" : "es"}</p>
                {questions.filter((q) => !isEmptyAnswer(profile.customFields[q.key])).map((q) => (
                  <p key={q.key} className="bus-hint">{q.label}: <strong>{Array.isArray(profile.customFields[q.key]) ? profile.customFields[q.key].join(", ") : typeof profile.customFields[q.key] === "boolean" ? "Yes" : String(profile.customFields[q.key])}</strong></p>
                ))}
              </section>
              <section>
                <header><h3>Routes ({routes.length})</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(3)}>Edit</button></header>
                {routes.map((r, i) => (
                  <div className="bop-review-route" key={i}>
                    <strong>{routeTitle(r)}</strong>
                    <p className="bus-hint">{durationLabel((Number(r.hours) || 0) * 60 + (Number(r.minutes) || 0))}{r.busTypeId ? ` · ${info.data.busTypes.find((t) => t.id === r.busTypeId)?.name || ""}` : ""}</p>
                    <div className="bop-chips">{r.ticketTypes.filter((t) => t.name.trim()).map((t, k) => <span key={k} className="bus-chip bus-chip-orange">{t.name}: {ugx(t.price)}</span>)}</div>
                    <div className="bop-chips">{r.departures.map((d, k) => <span key={k} className="bus-chip">{timeLabel(d.departureTime)} · {daysLabel(d.daysOfWeek)}</span>)}</div>
                  </div>
                ))}
              </section>
              <section>
                <header><h3>Sign-in</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(0)}>Edit</button></header>
                <p>{mode === "google" ? <>Google account <strong>{google?.email}</strong></> : <>Email <strong>{email}</strong> with your new password</>}</p>
              </section>
            </div>
          </>
        ) : null}

        {error ? <div className="bus-alert bus-alert-error bop-ob-error" role="alert">{error}</div> : null}

        <div className="bop-ob-nav">
          {step > 0 ? <button type="button" className="bus-btn bus-btn-light" onClick={() => goStep(step - 1)} disabled={submitting}>Back</button> : <span />}
          {step < 4 ? (
            <button type="button" className="bus-btn bus-btn-primary" onClick={next} disabled={!canGoNext}>Continue</button>
          ) : (
            <button type="button" className="bus-btn bus-btn-primary" onClick={submit} disabled={submitting}>{submitting ? "Setting up…" : "Finish and open my portal"}</button>
          )}
        </div>
      </div>
    </Shell>
  );
}
