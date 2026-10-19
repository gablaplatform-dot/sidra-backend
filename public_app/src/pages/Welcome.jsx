import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { getSession, setSession } from "../lib/session";
import { safeNext } from "../lib/authRedirect";
import { uploadFile } from "../lib/storage";
import { savePreferredDistrict } from "../lib/userLocation";
import { IconCamera } from "../components/icons";

const GREATER_KAMPALA = ["Kampala", "Wakiso", "Mukono"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Shown once, right after a brand-new account signs in: a short, friendly form to set the name,
// phone and profile photo, and the district used to arrange products around them whenever they
// don't share their exact location. Everything but the name is optional, and it can be skipped.
export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const destination = safeNext(searchParams.get("next")) || "/shop";
  const [session] = useState(() => getSession());
  const user = session?.user;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user?.avatarUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!session) navigate("/login", { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    let active = true;
    request("/providers/districts")
      .then((data) => active && setDistricts(data?.items || []))
      .catch(() => active && setDistricts([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview]
  );

  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError(t("welcome.errImageType"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t("welcome.errPhotoSize"));
      return;
    }
    setError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const finish = async (patch) => {
    const { user: updated } = await request("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
    setSession({ ...session, user: { ...session.user, ...updated } });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("welcome.errName"));
      return;
    }
    if (phone.trim() && phone.replace(/\D/g, "").length < 7) {
      setError(t("welcome.errPhone"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      let avatarUrl;
      if (photoFile) {
        try {
          avatarUrl = await uploadFile(photoFile, "user-avatars", { register: false });
        } catch {
          setError(t("welcome.errUpload"));
          return;
        }
      }
      await finish({
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        profile: { ...(district ? { district } : {}), onboarded: true }
      });
      if (district) await savePreferredDistrict(district, { sync: false });
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError.message || t("welcome.errSave"));
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      await finish({ profile: { onboarded: true } });
    } catch {
      // Skipping must never trap anyone on this page.
    }
    navigate(destination, { replace: true });
  };

  if (!session) return null;

  const rest = (districts || []).filter((d) => !GREATER_KAMPALA.includes(d));
  const metro = (districts || []).filter((d) => GREATER_KAMPALA.includes(d));

  return (
    <main className="auth-shell">
      <form className="auth-card wel-card" onSubmit={submit} noValidate>
        <div className="brand">
          <span className="brand-mark">G</span>
          <strong>Gabla</strong>
        </div>
        <p className="eyebrow">{t("welcome.eyebrow")}</p>
        <h1>{t("welcome.title")}</h1>
        <p className="auth-subtitle">{t("welcome.subtitle")}</p>

        <div className="wel-avatar">
          <button type="button" className="wel-avatar-btn" onClick={() => fileRef.current?.click()} aria-label={t("welcome.choosePhoto")}>
            {photoPreview ? (
              <img src={photoPreview} alt={t("welcome.yourProfile")} />
            ) : (
              <span className="wel-avatar-initial">{(name || user?.email || "G").trim().slice(0, 1).toUpperCase()}</span>
            )}
            <span className="wel-avatar-badge">
              <IconCamera width={16} height={16} />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pickPhoto} />
          <div className="wel-avatar-text">
            <strong>{t("welcome.profilePhoto")}</strong>
            <small>{t("welcome.optional")}</small>
            {photoPreview ? (
              <button type="button" className="link-button" onClick={removePhoto}>
                {t("welcome.remove")}
              </button>
            ) : null}
          </div>
        </div>

        {error ? <div className="error-message">{error}</div> : null}

        <div className="wel-fields">
          <label className="field">
            <span>{t("welcome.yourName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t("welcome.namePlaceholder")} />
          </label>
          <label className="field">
            <span>
              {t("welcome.phone")} <small>({t("welcome.optionalLower")})</small>
            </span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder={t("welcome.phonePlaceholder")} />
          </label>
          <label className="field">
            <span>{t("welcome.yourArea")}</span>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={districts === null}>
              <option value="">{districts === null ? t("welcome.loadingDistricts") : t("welcome.chooseDistrict")}</option>
              {metro.length ? (
                <optgroup label={t("welcome.greaterKampala")}>
                  {metro.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={t("welcome.allDistricts")}>
                {rest.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </optgroup>
            </select>
            <small>{t("welcome.areaHelp")}</small>
          </label>
        </div>

        <button type="submit" className="cta-button wel-submit" disabled={saving}>
          {saving ? t("welcome.saving") : t("welcome.continue")}
        </button>
        <button type="button" className="link-button wel-skip" onClick={skip} disabled={saving}>
          {t("welcome.skip")}
        </button>
      </form>
    </main>
  );
}
