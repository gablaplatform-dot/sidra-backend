import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { uploadFile } from "../../lib/storage";
import { PhotoField } from "../PhotoPicker";
import { IconBox, IconClose } from "../icons";
import { SectionSkeleton } from "../Skeleton";

export default function ProfileAdsTab() {
  const { t } = useTranslation();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState(""); // "image" | "video"
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    request("/promotions/mine")
      .then((result) => setAds(result?.items || []))
      .catch((loadError) => setError(loadError.message || t("profile.ads.errLoad")))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setMediaUrl("");
    setMediaKind("");
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!title.trim() || !mediaUrl) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request("/promotions/mine", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          imageUrl: mediaKind === "video" ? null : mediaUrl,
          videoUrl: mediaKind === "video" ? mediaUrl : null
        })
      });
      resetForm();
      setNotice(t("profile.ads.created"));
      load();
    } catch (submitError) {
      setError(submitError.message || t("profile.ads.errCreate"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(t("profile.ads.confirmDelete", { title: ad.title }))) return;
    try {
      await request(`/promotions/mine/${ad.id}`, { method: "DELETE" });
      load();
    } catch (removeError) {
      setError(removeError.message || t("profile.ads.errDelete"));
    }
  };

  if (loading) return <SectionSkeleton rows={4} label={t("profile.ads.loading")} />;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>{t("profile.tabs.ads")}</h2>
      </div>
      <p className="provider-meta profile-section-hint">
        {t("profile.ads.hint")}
      </p>

      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <form className="form-grid two" onSubmit={submitCreate} style={{ marginBottom: 24 }}>
        <label className="field">
          <span>{t("profile.ads.title")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("profile.ads.titlePlaceholder")} required />
        </label>
        <label className="field">
          <span>{t("profile.ads.subtitle")}</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={t("profile.ads.subtitlePlaceholder")} />
        </label>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <span>{t("profile.ads.media")}</span>
          <PhotoField
            value={mediaUrl}
            kind={mediaKind || "image"}
            accept="image/*,video/mp4"
            aspect="16 / 9"
            emptyLabel={t("photo.addMedia")}
            hint={t("photo.hintMedia")}
            upload={(file) => uploadFile(file, "provider-ads")}
            onChange={(url, kind) => {
              setMediaUrl(url);
              setMediaKind(url ? kind : "");
            }}
            onError={setError}
          />
        </div>

        <button
          type="submit"
          className="cta-button"
          disabled={saving || !mediaUrl}
          style={{ gridColumn: "1 / -1", width: "auto" }}
        >
          {saving ? t("profile.ads.creating") : t("profile.ads.create")}
        </button>
      </form>

      {ads.length ? (
        <div className="wallet-list">
          {ads.map((ad) => (
            <div key={ad.id} className="wallet-list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {ad.videoUrl ? (
                  <video src={ad.videoUrl} muted style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <img src={ad.imageUrl} alt={ad.title} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                )}
                <div>
                  <strong>{ad.title}</strong>
                  <div>
                    <span className={`status-badge status-${ad.moderationStatus === "approved" ? "fulfilled" : "pending"}`}>
                      {ad.moderationStatus === "approved" ? t("profile.ads.approved") : t("profile.pendingReview")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="listing-actions">
                <button type="button" onClick={() => remove(ad)}>
                  <IconClose /> {t("profile.ads.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconBox />
          <p>{t("profile.ads.empty")}</p>
        </div>
      )}
    </section>
  );
}
