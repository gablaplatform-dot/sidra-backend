import React, { useEffect, useRef, useState } from "react";

import { request } from "../../lib/api";
import { uploadFile } from "../../lib/storage";
import { IconBox, IconClose } from "../icons";

export default function ProfileAdsTab() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState(""); // "image" | "video"
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    request("/promotions/mine")
      .then((result) => setAds(result?.items || []))
      .catch((loadError) => setError(loadError.message || "Unable to load your ads."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadFile(file, "provider-ads");
      setMediaUrl(url);
      setMediaKind(file.type?.startsWith("video/") ? "video" : "image");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload this file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setCtaHref("");
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
          ctaLabel: ctaLabel.trim() || null,
          ctaHref: ctaHref.trim() || null,
          imageUrl: mediaKind === "video" ? null : mediaUrl,
          videoUrl: mediaKind === "video" ? mediaUrl : null
        })
      });
      resetForm();
      setNotice("Ad created — it's live now and flagged for admin review.");
      load();
    } catch (submitError) {
      setError(submitError.message || "Unable to create this ad.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(`Delete "${ad.title}"?`)) return;
    try {
      await request(`/promotions/mine/${ad.id}`, { method: "DELETE" });
      load();
    } catch (removeError) {
      setError(removeError.message || "Unable to delete this ad.");
    }
  };

  if (loading) return <p className="home-empty page-loading">Loading your ads…</p>;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>Ads</h2>
      </div>
      <p className="provider-meta profile-section-hint">
        Create an image or video ad to appear in the Shop page hero, shown first to shoppers near you.
        Your ad goes live immediately and is flagged for admin review.
      </p>

      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <form className="form-grid two" onSubmit={submitCreate} style={{ marginBottom: 24 }}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 30% off all sneakers" required />
        </label>
        <label className="field">
          <span>Subtitle (optional)</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. This weekend only" />
        </label>
        <label className="field">
          <span>CTA label (optional)</span>
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="e.g. Shop Now" />
        </label>
        <label className="field">
          <span>CTA link (optional)</span>
          <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/shop" />
        </label>

        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span>Image or video</span>
          <input ref={fileRef} type="file" accept="image/*,video/mp4" onChange={pickFile} disabled={uploading} />
        </label>

        {mediaUrl ? (
          <div style={{ gridColumn: "1 / -1" }}>
            {mediaKind === "video" ? (
              <video src={mediaUrl} controls style={{ maxWidth: 240, borderRadius: 12 }} />
            ) : (
              <img src={mediaUrl} alt="Ad preview" style={{ maxWidth: 240, borderRadius: 12 }} />
            )}
          </div>
        ) : null}

        <button
          type="submit"
          className="cta-button"
          disabled={saving || uploading || !mediaUrl}
          style={{ gridColumn: "1 / -1", width: "auto" }}
        >
          {uploading ? "Uploading…" : saving ? "Creating…" : "+ Create ad"}
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
                      {ad.moderationStatus === "approved" ? "Approved" : "Pending review"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="listing-actions">
                <button type="button" onClick={() => remove(ad)}>
                  <IconClose /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconBox />
          <p>No ads yet. Create your first one above.</p>
        </div>
      )}
    </section>
  );
}
