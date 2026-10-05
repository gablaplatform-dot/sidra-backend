import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { request } from "../../lib/api";
import { setSession } from "../../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../../lib/google";
import { isUgPhone, normalizeUgPhone, ugx, durationLabel } from "../../lib/bus";
import { Skel } from "../../components/Skeleton";
import DynamicField from "../../components/DynamicField";
import { UGANDA_DISTRICTS } from "../../components/bus/operator/districts";
import RouteForm, { emptyRoute, routePayload, routeTitle, validateRoute } from "../../components/bus/operator/RouteForm";
import { Field, ImageField, Segmented, daysLabel, errMsg, timeLabel, uploadOnboardingImage } from "../../components/bus/operator/ui";
import BrandPanel, { Logo } from "../../components/bus/operator/BrandPanel";
import { IcAlert, IcArrowLeft, IcArrowRight, IcBuilding, IcBus, IcCheck, IcInfo, IcPin, IcPlus, IcRoute, IcShield, IcTicket, IcTrash, IcUsers } from "../../components/bus/operator/icons";

const STEPS = [
  { key: "account", label: "Secure your account", short: "Sign in", hint: "Google or a password", Icon: IcShield },
  { key: "company", label: "Company and bus park", short: "Company", hint: "What passengers see", Icon: IcBuilding },
  { key: "fleet", label: "Your fleet", short: "Fleet", hint: "A few quick questions", Icon: IcUsers },
  { key: "routes", label: "Routes and prices", short: "Routes", hint: "Where you go, what it costs", Icon: IcRoute },
  { key: "review", label: "Review and finish", short: "Finish", hint: "Open your portal", Icon: IcTicket }
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

function Shell({ children }) {
  return (
    <div className="bus-app bop-ob">
      <header className="bop-ob-top">
        <Logo light={false} />
        <Link to="/bus/operator/login" className="bop-ob-top-link">Sign in</Link>
      </header>
      <main className="bop-ob-center">{children}</main>
    </div>
  );
}

function Notice({ tone = "info", title, children, action }) {
  return (
    <div className="bop-card bop-notice">
      <span className={`bop-notice-icon is-${tone}`}>{tone === "error" ? "!" : <IcCheck size={26} strokeWidth={2.6} />}</span>
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
        <div className="bop-card bop-notice is-wide" role="status" aria-busy="true" aria-label="Loading your invitation">
          <Skel w={64} h={64} r={20} />
          <Skel w="70%" h={26} style={{ marginTop: 18 }} /><Skel w="90%" h={14} style={{ marginTop: 12 }} />
          <div style={{ display: "grid", gap: 12, marginTop: 24, width: "100%" }}><Skel h={48} r={12} /><Skel h={48} r={12} /></div>
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
          action={invalid ? <Link to="/bus/operator/login" className="bop-btn bop-btn-light">I already have an account</Link> : <button className="bop-btn bop-btn-primary" onClick={load}>Try again</button>}
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
        <Notice title="You’re already registered" action={<Link to="/bus/operator/login" className="bop-btn bop-btn-primary">Sign in to your portal</Link>}>
          {operator.companyName} has already finished setting up. Sign in with your email or Google account to manage your buses.
        </Notice>
      </Shell>
    );
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const route = routes[Math.min(activeRoute, routes.length - 1)];
  const setRoute = (value) => setRoutes((list) => list.map((r, i) => (i === activeRoute ? value : r)));
  const canGoNext = step === 0 ? (mode === "google" ? Boolean(google) : password.length >= 8 && password === password2) : true;
  const current = STEPS[step];

  return (
    <div className="bus-app bop-ob bop-ob-split">
      <BrandPanel className="bop-ob-art">
        <span className="bop-eyebrow is-light">Set up {operator.companyName}</span>
        <h1>Let’s get your buses selling tickets.</h1>
        <ol className="bop-vsteps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`${i === step ? "is-current" : ""} ${i < step ? "is-done" : ""}`}>
              <button type="button" disabled={i > step} onClick={() => goStep(i)} aria-current={i === step ? "step" : undefined}>
                <span className="bop-vstep-dot">{i < step ? <IcCheck size={15} strokeWidth={3} /> : i + 1}</span>
                <span><strong>{s.label}</strong><small>{s.hint}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </BrandPanel>

      <div className="bop-ob-pane">
        <header className="bop-ob-mobilebar">
          <div className="bop-ob-mobilebar-row">
            <Logo light={false} />
            <Link to="/bus/operator/login" className="bop-ob-top-link">Sign in</Link>
          </div>
          <div className="bop-ob-mobilebar-step"><strong>Step {step + 1} of {STEPS.length}</strong><span>{current.short}</span></div>
          <div className="bop-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Setup progress"><span style={{ width: `${pct}%` }} /></div>
        </header>

        <div className="bop-ob-scroll" ref={topRef} />
        <div className="bop-ob-pane-in">
          <div className="bop-ob-desktopprogress">
            <span>Step {step + 1} of {STEPS.length}</span>
            <div className="bop-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          </div>

          <div key={step} className={`bop-ob-card ${step === 3 ? "is-wide" : ""}`}>
            {step === 0 ? (
              <>
                <span className="bop-eyebrow">Welcome</span>
                <h1>Secure your account</h1>
                <p className="bop-lead">It takes about 5 minutes: tell us about your company and bus park, then add your first route and prices. Passengers can start booking right after.</p>
                <div className="bop-form">
                  <Field label="Invited email" hint="Your invitation was sent to this address, so it can’t be changed.">
                    <input className="bop-input" value={email} readOnly aria-readonly="true" />
                  </Field>

                  <Segmented className="bop-seg-wide" label="How do you want to sign in?" value={mode} onChange={(v) => { setMode(v); setError(""); }} options={[["google", "Continue with Google"], ["password", "Set a password"]]} />

                  {mode === "google" ? (
                    <div className="bop-mode-body">
                      {google ? (
                        <div className="bop-alert is-success"><IcCheck size={18} strokeWidth={2.6} /><span>Signed in as <strong>{google.email}</strong>. You’re all set to continue.</span></div>
                      ) : GOOGLE_CLIENT_ID ? (
                        <>
                          <p className="bop-hint" style={{ marginBottom: 12 }}>Sign in with the Google account for <strong>{email}</strong>. Other Google accounts won’t work.</p>
                          <div ref={googleRef} className="bop-google-slot" />
                          {googleBusy ? <p className="bop-hint">Checking your Google account…</p> : null}
                        </>
                      ) : (
                        <div className="bop-alert is-warn"><IcInfo size={18} /><span>Google sign-in isn’t available here right now. Please choose “Set a password” instead.</span></div>
                      )}
                      {googleError ? <div className="bop-alert is-error" role="alert" style={{ marginTop: 12 }}><IcAlert size={18} /><span>{googleError}</span></div> : null}
                    </div>
                  ) : (
                    <div className="bop-mode-body bop-grid2">
                      <Field label="Password" hint="At least 8 characters">
                        <input className="bop-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      </Field>
                      <Field label="Confirm password" error={password2 && password !== password2 ? "The passwords don’t match yet." : ""}>
                        <input className="bop-input" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <span className="bop-eyebrow">Step 2 of 5</span>
                <h1>Your company and bus park</h1>
                <p className="bop-lead">This is what passengers see when they find your buses.</p>
                <div className="bop-form">
                  <Field label="Company name"><input className="bop-input" value={profile.companyName} onChange={(e) => setP({ companyName: e.target.value })} maxLength={120} /></Field>
                  <Field label="About your company (optional)"><textarea className="bop-textarea" rows={3} value={profile.description} onChange={(e) => setP({ description: e.target.value })} maxLength={2000} placeholder="Years on the road, comfort, safety, where you travel…" /></Field>
                  <div className="bop-grid2 bop-imgrow">
                    <ImageField label="Logo" kind="logo" value={profile.logoUrl} onChange={(v) => setP({ logoUrl: v })} uploader={(f) => uploadOnboardingImage(f, token)} hint="Square image works best (optional)" />
                    <ImageField label="Cover photo" kind="cover" value={profile.coverUrl} onChange={(v) => setP({ coverUrl: v })} uploader={(f) => uploadOnboardingImage(f, token)} hint="A wide photo of your buses (optional)" />
                  </div>
                  <div className="bop-grid2">
                    <Field label="Contact phone" hint="Passengers and Gabla call this number"><input className="bop-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={profile.contactPhone} onChange={(e) => setP({ contactPhone: e.target.value })} /></Field>
                    <Field label="WhatsApp (optional)"><input className="bop-input" type="tel" inputMode="tel" placeholder="0772 123 456" value={profile.whatsapp} onChange={(e) => setP({ whatsapp: e.target.value })} /></Field>
                  </div>

                  <div className="bop-subsection">
                    <div className="bop-subhead"><div><h3>Where is your bus park?</h3><p>Passengers use this to find where to board.</p></div></div>
                    <Field label="Bus park name"><input className="bop-input" placeholder="e.g. Namirembe Road Bus Park" value={profile.parkName} onChange={(e) => setP({ parkName: e.target.value })} maxLength={120} /></Field>
                    <div className="bop-grid2">
                      <Field label="District">
                        <select className="bop-select" value={profile.parkDistrict} onChange={(e) => setP({ parkDistrict: e.target.value })}>
                          <option value="">Choose a district</option>
                          {UGANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </Field>
                      <Field label="Address / landmark (optional)"><input className="bop-input" placeholder="Opposite the taxi park, Gate 3" value={profile.parkAddress} onChange={(e) => setP({ parkAddress: e.target.value })} maxLength={240} /></Field>
                    </div>
                    <div className="bop-loc">
                      <button type="button" className="bop-btn bop-btn-light bop-btn-sm" onClick={useMyLocation} disabled={locating}><IcPin size={16} /> {locating ? "Locating…" : "Pin my current location"}</button>
                      {profile.parkLat != null ? <span className="bop-chip is-green">Location saved ({profile.parkLat}, {profile.parkLng})</span> : <small className="bop-hint">Optional. Helps passengers find the park.</small>}
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
                  <Field label="How many buses do you operate?"><input className="bop-input bop-narrow" type="number" min="1" max="5000" inputMode="numeric" value={profile.fleetSize} onChange={(e) => setP({ fleetSize: e.target.value })} /></Field>
                  {questions.map((q) => (
                    <div className="bop-dyn" key={q.key}>
                      <span>{q.label}{q.required ? <b className="bop-req"> *</b> : <i> (optional)</i>}</span>
                      <DynamicField field={q} value={profile.customFields[q.key]} onChange={(v) => setP({ customFields: { ...profile.customFields, [q.key]: v } })} />
                      {q.unit ? <small className="bop-hint">Unit: {q.unit}</small> : null}
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
                    <button key={i} type="button" className={`bop-chip ${i === activeRoute ? "is-on" : ""}`} onClick={() => setActiveRoute(i)}>{routeTitle(r)}</button>
                  ))}
                  <button type="button" className="bop-chip is-orange" disabled={routes.length >= 10} onClick={() => { setRoutes([...routes, emptyRoute()]); setActiveRoute(routes.length); }}><IcPlus size={14} /> Add another route</button>
                </div>
                <RouteForm value={route} onChange={setRoute} busTypes={info.data.busTypes} />
                {routes.length > 1 ? (
                  <button type="button" className="bop-btn bop-btn-light bop-btn-sm" style={{ marginTop: 16 }} onClick={() => { setRoutes(routes.filter((_, i) => i !== activeRoute)); setActiveRoute(0); }}>
                    <IcTrash size={16} /> Remove this route
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
                    <p className="bop-review-line"><IcPin size={15} /> {profile.parkName}, {profile.parkDistrict}{profile.parkAddress ? ` (${profile.parkAddress})` : ""}</p>
                  </section>
                  <section>
                    <header><h3>Fleet</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(2)}>Edit</button></header>
                    <p className="bop-review-line"><IcBus size={15} /> <strong>{profile.fleetSize}</strong> bus{Number(profile.fleetSize) === 1 ? "" : "es"}</p>
                    {questions.filter((q) => !isEmptyAnswer(profile.customFields[q.key])).map((q) => (
                      <p key={q.key} className="bop-hint">{q.label}: <strong>{Array.isArray(profile.customFields[q.key]) ? profile.customFields[q.key].join(", ") : typeof profile.customFields[q.key] === "boolean" ? "Yes" : String(profile.customFields[q.key])}</strong></p>
                    ))}
                  </section>
                  <section>
                    <header><h3>Routes ({routes.length})</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(3)}>Edit</button></header>
                    {routes.map((r, i) => (
                      <div className="bop-review-route" key={i}>
                        <strong>{routeTitle(r)}</strong>
                        <p className="bop-hint">{durationLabel((Number(r.hours) || 0) * 60 + (Number(r.minutes) || 0))}{r.busTypeId ? ` · ${info.data.busTypes.find((t) => t.id === r.busTypeId)?.name || ""}` : ""}</p>
                        <div className="bop-chips">{r.ticketTypes.filter((t) => t.name.trim()).map((t, k) => <span key={k} className="bop-chip is-orange">{t.name}: {ugx(t.price)}</span>)}</div>
                        <div className="bop-chips">{r.departures.map((d, k) => <span key={k} className="bop-chip">{timeLabel(d.departureTime)} · {daysLabel(d.daysOfWeek)}</span>)}</div>
                      </div>
                    ))}
                  </section>
                  <section>
                    <header><h3>Sign-in</h3><button type="button" className="bop-linkbtn" onClick={() => goStep(0)}>Edit</button></header>
                    <p className="bop-review-line"><IcShield size={15} /> {mode === "google" ? <>Google account <strong>{google?.email}</strong></> : <>Email <strong>{email}</strong> with your new password</>}</p>
                  </section>
                </div>
              </>
            ) : null}

          </div>
        </div>

        <div className="bop-ob-nav">
          {error ? <div className="bop-alert is-error bop-ob-error" role="alert"><IcAlert size={18} /><span>{error}</span></div> : null}
          <div className="bop-ob-nav-in">
            {step > 0 ? <button type="button" className="bop-btn bop-btn-light bop-btn-lg" onClick={() => goStep(step - 1)} disabled={submitting}><IcArrowLeft size={18} /> Back</button> : <span />}
            {step < 4 ? (
              <button type="button" className="bop-btn bop-btn-primary bop-btn-lg" onClick={next} disabled={!canGoNext}>Continue <IcArrowRight size={18} /></button>
            ) : (
              <button type="button" className="bop-btn bop-btn-primary bop-btn-lg" onClick={submit} disabled={submitting}>{submitting ? "Setting up…" : "Finish and open my portal"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
