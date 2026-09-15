import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import { loadGoogleMaps } from "../lib/maps";
import { flattenCategories } from "../lib/categories";
import { isCustomFieldFilled } from "../lib/customFields";
import Field from "../components/Field";
import DynamicField from "../components/DynamicField";

const Icon = ({ children }) => <span className="icon">{children}</span>;

const ReadOnlyMap = ({ lat, lng }) => {
  const containerRef = React.useRef(null);

  useEffect(() => {
    let active = true;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !containerRef.current) return;
        const center = { lat, lng };
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          gestureHandling: "none",
          zoomControl: false,
          keyboardShortcuts: false
        });
        new google.maps.Marker({ position: center, map });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lat, lng]);

  return <div className="location-map" ref={containerRef} />;
};

export default function ProviderOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("form"); // form | link-google
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const googleButtonRef = useRef(null);
  const [invitation, setInvitation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [adminLocked, setAdminLocked] = useState({
    businessName: false,
    description: false,
    phone: false,
    whatsapp: false,
    website: false,
    location: false,
    geo: null
  });
  const [form, setForm] = useState({
    businessName: "",
    description: "",
    phone: "",
    whatsapp: "",
    website: "",
    address: "",
    city: "",
    region: "",
    country: "Uganda",
    customFields: {}
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) {
        setError("This invitation link is incomplete.");
        setLoading(false);
        return;
      }
      try {
        const [invite, categoryResult] = await Promise.all([
          request(`/providers/onboarding/${encodeURIComponent(token)}`),
          request("/categories")
        ]);
        if (!active) return;
        setInvitation(invite);
        setCategories(categoryResult?.items || categoryResult || []);
        const provider = invite.provider || {};
        const location = provider.location || {};
        const coordinates = location.geo?.coordinates;
        setForm((current) => ({
          ...current,
          businessName: provider.businessName || "",
          description: provider.description || "",
          phone: provider.contact?.phone || invite.user?.phone || "",
          whatsapp: provider.contact?.whatsapp || "",
          website: provider.contact?.website || "",
          address: location.address || "",
          city: location.city || "",
          region: location.region || "",
          country: location.country || "Uganda",
          customFields: provider.customFields || {}
        }));
        setAdminLocked({
          businessName: Boolean(provider.businessName),
          description: Boolean(provider.description),
          phone: Boolean(provider.contact?.phone),
          whatsapp: Boolean(provider.contact?.whatsapp),
          website: Boolean(provider.contact?.website),
          location: Boolean(location.address || location.city || location.region || coordinates),
          geo: Array.isArray(coordinates) ? { lat: coordinates[1], lng: coordinates[0] } : null
        });
        // A "resend Google link" email reuses this same onboarding link for a provider who
        // already completed their profile — skip straight to Google sign-in instead of asking
        // them to fill out the whole business form again.
        if (provider.onboardingStatus === "registered") {
          setStage("link-google");
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "This invitation could not be opened.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [token]);

  const category = useMemo(() => {
    const flat = flattenCategories(categories);
    return flat.find((item) => item.id === invitation?.provider?.categoryId);
  }, [categories, invitation]);

  const providerFields = category?.effectiveProviderFields || category?.providerFields || [];

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const missingField = providerFields.find(
      (field) => field.required && !isCustomFieldFilled(field, form.customFields[field.key])
    );
    if (missingField) {
      setError(`Please fill in "${missingField.label}".`);
      return;
    }
    setSaving(true);
    try {
      await request(`/providers/onboarding/${encodeURIComponent(token)}/complete`, {
        method: "POST",
        body: JSON.stringify({
          profile: {
            businessName: form.businessName.trim(),
            description: form.description.trim(),
            contact: {
              email: invitation.user?.email || null,
              phone: form.phone.trim() || null,
              whatsapp: form.whatsapp.trim() || null,
              website: form.website.trim() || null
            },
            location: adminLocked.location
              ? invitation.provider.location
              : {
                  address: form.address.trim() || undefined,
                  city: form.city.trim() || undefined,
                  region: form.region.trim() || undefined,
                  country: form.country.trim() || "Uganda"
                },
            customFields: form.customFields
          }
        })
      });
      setStage("link-google");
    } catch (submitError) {
      setError(submitError.message || "Registration could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (stage !== "link-google") return;
    if (!GOOGLE_CLIENT_ID) {
      setLinkError("Google sign-in is not configured yet.");
      return;
    }
    let active = true;
    const handleCredential = async (response) => {
      setLinking(true);
      setLinkError("");
      try {
        const result = await request(`/providers/onboarding/${encodeURIComponent(token)}/link-google`, {
          method: "POST",
          body: JSON.stringify({ idToken: response.credential })
        });
        setSession(result);
        navigate("/profile", { replace: true });
      } catch (linkErr) {
        if (active) setLinkError(linkErr.message || "Unable to link your Google account.");
      } finally {
        if (active) setLinking(false);
      }
    };
    loadGoogleIdentity()
      .then((google) => {
        if (!active || !googleButtonRef.current) return;
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: 320,
          text: "continue_with"
        });
      })
      .catch((loadError) => {
        if (active) setLinkError(loadError.message || "Unable to load Google sign-in");
      });
    return () => {
      active = false;
    };
  }, [stage, token, navigate]);

  if (loading) {
    return (
      <main className="center-state">
        <div className="spinner" />
        <h1>Opening your invitation</h1>
        <p>We are preparing your Gabla provider profile.</p>
      </main>
    );
  }

  if (stage === "link-google") {
    return (
      <main className="center-state">
        <div className="brand-mark">G</div>
        <h1>Your profile is live!</h1>
        <p>Sign in with Google now to link it to your account and reach your dashboard, wallet, and orders.</p>
        {linkError ? <div className="error-message">{linkError}</div> : null}
        {linking ? <p>Linking your account…</p> : <div ref={googleButtonRef} />}
        <a className="secondary-button" href="/login" style={{ marginTop: 16 }}>I&apos;ll sign in later</a>
      </main>
    );
  }

  if (error && !invitation) {
    return (
      <main className="center-state">
        <div className="brand-mark">G</div>
        <h1>We could not open this invitation</h1>
        <p>{error}</p>
        <a className="secondary-button" href="mailto:support@gabla.ug">Contact Gabla support</a>
      </main>
    );
  }

  return (
    <main className="onboarding-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">G</span><strong>Gabla</strong></div>
        <span className="secure-label">Secure provider registration</span>
      </header>

      <div className="onboarding-grid">
        <aside className="welcome-pane">
          <img src="/assets/gabla-provider-welcome.png" alt="" />
          <p className="eyebrow">You have been invited</p>
          <h1>Let customers discover what you do best.</h1>
          <p>Complete the profile for <strong>{invitation?.provider?.businessName}</strong>. Your details are saved securely and reviewed before publishing.</p>
          <div className="category-chip">
            <Icon>✓</Icon>
            <span>{category?.path || "Gabla service provider"}</span>
          </div>
        </aside>

        <form className="registration-form" onSubmit={submit}>
          <div className="form-heading">
            <p className="eyebrow">Complete your profile</p>
            <h2>Business and account details</h2>
            <p>Invited as {invitation?.user?.email}</p>
          </div>

          {error ? <div className="error-message">{error}</div> : null}

          <section>
            <h3>Business profile</h3>
            <div className="form-grid">
              <Field label="Business name">
                <input required value={form.businessName} disabled={adminLocked.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              </Field>
              <Field label="Assigned category">
                <input value={category?.path || "Assigned by Gabla"} disabled />
              </Field>
              <Field label="Business description">
                <textarea required rows="4" value={form.description} disabled={adminLocked.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell customers about your experience and services." />
              </Field>
            </div>
          </section>

          {providerFields.length ? (
            <section>
              <h3>More about your {category?.name?.toLowerCase() || "business"}</h3>
              <div className="form-grid two">
                {providerFields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.required ? `${field.label} *` : field.label}
                    hint={field.unit}
                    as={field.type === "boolean" || field.type === "multi_select" ? "div" : "label"}
                  >
                    <DynamicField
                      field={field}
                      value={form.customFields[field.key]}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          customFields: { ...current.customFields, [field.key]: value }
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3>Contact details</h3>
            <div className="form-grid two">
              <Field label="Phone number"><input type="tel" value={form.phone} disabled={adminLocked.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256" /></Field>
              <Field label="WhatsApp number"><input type="tel" value={form.whatsapp} disabled={adminLocked.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+256" /></Field>
              <Field label="Website"><input type="url" value={form.website} disabled={adminLocked.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></Field>
            </div>
          </section>

          {adminLocked.geo ? (
            <section>
              <h3>Business location</h3>
              <ReadOnlyMap lat={adminLocked.geo.lat} lng={adminLocked.geo.lng} />
            </section>
          ) : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Completing registration..." : "Complete registration"}
          </button>
          <p className="terms">By continuing, you confirm that the information provided is accurate and that you are authorized to manage this business profile.</p>
        </form>
      </div>
    </main>
  );
}
