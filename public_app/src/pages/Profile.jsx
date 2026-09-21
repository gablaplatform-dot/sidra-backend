import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { uploadFile } from "../lib/storage";
import { clearSession, getSession } from "../lib/session";
import SiteHeader from "../components/SiteHeader";
import Field from "../components/Field";
import ProfileOrdersTab from "../components/profile/ProfileOrdersTab";
import ProfileWalletTab from "../components/profile/ProfileWalletTab";
import ProfileShopCategoriesTab from "../components/profile/ProfileShopCategoriesTab";
import ProfileAnalyticsTab from "../components/profile/ProfileAnalyticsTab";
import { IconBox, IconCamera, IconClose, IconImage } from "../components/icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const TABS = [
  { key: "info", label: "Profile info" },
  { key: "analytics", label: "Analytics" },
  { key: "listings", label: "Products & services" },
  { key: "shopCategories", label: "Shop categories" },
  { key: "orders", label: "Orders" },
  { key: "wallet", label: "Wallet" },
  { key: "gallery", label: "Gallery" }
];

export default function Profile() {
  const navigate = useNavigate();
  const [session] = useState(() => getSession());
  const [provider, setProvider] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const avatarFileRef = useRef(null);
  const coverFileRef = useRef(null);
  const galleryFileRef = useRef(null);

  const [form, setForm] = useState({ businessName: "", description: "", phone: "", whatsapp: "", website: "", onlinePaymentsEnabled: true });
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    if (!session || !session.provider) {
      navigate("/login", { replace: true });
    }
  }, [session, navigate]);

  const load = () => {
    if (!session?.provider) return;
    setLoading(true);
    Promise.all([
      request("/providers/me"),
      request("/listings/me?limit=100")
    ])
      .then(([providerResult, listingResult]) => {
        setProvider(providerResult);
        setListings(listingResult?.items || listingResult || []);
        setForm({
          businessName: providerResult.businessName || "",
          description: providerResult.description || "",
          phone: providerResult.contact?.phone || "",
          whatsapp: providerResult.contact?.whatsapp || "",
          website: providerResult.contact?.website || "",
          onlinePaymentsEnabled: providerResult.onlinePaymentsEnabled !== false
        });
      })
      .catch((loadError) => setError(loadError.message || "Unable to load your profile."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session]);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const deleteListing = async (listing) => {
    if (!window.confirm(`Remove "${listing.name}"?`)) return;
    try {
      await request(`/listings/${listing.id}`, { method: "DELETE" });
      load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to remove listing.");
    }
  };

  const saveProfileInfo = async (event) => {
    event.preventDefault();
    if (!form.businessName.trim()) {
      setError("Business name can't be empty.");
      return;
    }
    setSavingInfo(true);
    setError("");
    setNotice("");
    try {
      const updated = await request("/providers/me", {
        method: "PUT",
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          description: form.description.trim(),
          contact: {
            ...provider.contact,
            phone: form.phone.trim() || null,
            whatsapp: form.whatsapp.trim() || null,
            website: form.website.trim() || null
          },
          onlinePaymentsEnabled: form.onlinePaymentsEnabled
        })
      });
      setProvider(updated);
      setNotice("Profile updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save your profile.");
    } finally {
      setSavingInfo(false);
    }
  };

  const uploadMediaField = async (file, field, setBusy) => {
    if (!file || !provider) return;
    setBusy(true);
    setError("");
    try {
      const url = await uploadFile(file, `provider-${field}`);
      const updated = await request("/providers/me", {
        method: "PUT",
        body: JSON.stringify({ media: { ...provider.media, [field]: url } })
      });
      setProvider(updated);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload photo.");
    } finally {
      setBusy(false);
    }
  };

  const addGalleryPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !provider) return;
    setUploadingGallery(true);
    setError("");
    try {
      const url = await uploadFile(file, "provider-gallery");
      const gallery = [...(provider.media?.gallery || []), url];
      const updated = await request("/providers/me", {
        method: "PUT",
        body: JSON.stringify({ media: { ...provider.media, gallery } })
      });
      setProvider(updated);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload photo.");
    } finally {
      setUploadingGallery(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  const removeGalleryPhoto = async (url) => {
    if (!provider) return;
    try {
      const gallery = (provider.media?.gallery || []).filter((item) => item !== url);
      const updated = await request("/providers/me", {
        method: "PUT",
        body: JSON.stringify({ media: { ...provider.media, gallery } })
      });
      setProvider(updated);
    } catch (removeError) {
      setError(removeError.message || "Unable to remove photo.");
    }
  };

  if (!session?.provider) return null;

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <p className="home-empty page-loading">Loading your profile…</p>
      ) : !provider ? (
        <div className="page-empty-state">
          <p>{error || "We couldn't load your profile."}</p>
          <Link to="/home" className="secondary-button">Back to home</Link>
        </div>
      ) : (
        <>
          <section
            className="profile-identity-hero"
            style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}
          >
            <button
              type="button"
              className="photo-edit-button cover-edit-button"
              onClick={() => coverFileRef.current?.click()}
              disabled={uploadingCover}
              aria-label="Change cover photo"
            >
              <IconCamera /> <span>{uploadingCover ? "Uploading…" : "Change cover"}</span>
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => uploadMediaField(e.target.files?.[0], "coverUrl", setUploadingCover)}
            />

            <div className="profile-identity-row">
              <div className="profile-avatar-wrap">
                <div
                  className="profile-avatar"
                  style={provider.media?.avatarUrl ? { backgroundImage: `url("${provider.media.avatarUrl}")` } : undefined}
                >
                  {!provider.media?.avatarUrl ? <span>{initials(provider.businessName)}</span> : null}
                </div>
                <button
                  type="button"
                  className="photo-edit-button avatar-edit-button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change profile picture"
                >
                  <IconCamera />
                </button>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => uploadMediaField(e.target.files?.[0], "avatarUrl", setUploadingAvatar)}
                />
              </div>
              <div className="profile-identity-text">
                <h1>{provider.businessName}</h1>
                <p className="provider-hero-meta">Your public profile &middot; <Link to={`/provider/${provider.id}`}>View live page</Link></p>
              </div>
            </div>
          </section>

          {error ? <div className="error-message home-error">{error}</div> : null}
          {notice ? <div className="notice-message">{notice}</div> : null}

          <nav className="profile-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`hero-tab ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="provider-detail-main profile-main">
            {activeTab === "info" ? (
              <section className="detail-block profile-info-form">
                <form onSubmit={saveProfileInfo}>
                  <div className="form-grid two">
                    <Field label="Business name">
                      <input
                        required
                        value={form.businessName}
                        onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="e.g. +256 700 000000"
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <input
                        value={form.whatsapp}
                        onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                        placeholder="e.g. +256 700 000000"
                      />
                    </Field>
                    <Field label="Website (optional)">
                      <input
                        value={form.website}
                        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                        placeholder="https://"
                      />
                    </Field>
                  </div>
                  <Field label="Description" as="div">
                    <textarea
                      rows="5"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Tell customers what you do, what makes you different, and what to expect."
                    />
                  </Field>
                  <Field label="Online payments" as="div">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.onlinePaymentsEnabled}
                        onChange={(e) => setForm((f) => ({ ...f, onlinePaymentsEnabled: e.target.checked }))}
                      />
                      <span>Accept online mobile money payments for my products</span>
                    </label>
                  </Field>
                  <button className="primary-button profile-save-button" type="submit" disabled={savingInfo}>
                    {savingInfo ? "Saving…" : "Save changes"}
                  </button>
                </form>
              </section>
            ) : null}

            {activeTab === "analytics" ? <ProfileAnalyticsTab /> : null}

            {activeTab === "listings" ? (
              <section className="detail-block">
                <div className="detail-block-header">
                  <h2>Products &amp; services</h2>
                  <Link to="/profile/listings/new" className="cta-button">+ Add</Link>
                </div>
                {listings.length ? (
                  <div className="listing-grid">
                    {listings.map((item) => (
                      <div key={item.id} className="listing-card">
                        <div
                          className="listing-cover"
                          style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}
                        >
                          {!item.media?.imageUrl ? <IconBox /> : null}
                        </div>
                        <div className="listing-body">
                          <h3>{item.name}</h3>
                          {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
                          <div style={{ margin: "8px 0" }}>
                            <span className={`status-badge status-${item.status === "approved" ? "fulfilled" : "pending"}`}>
                              {item.status === "approved" ? "Live" : "Pending review"}
                            </span>
                          </div>
                          <div className="listing-actions">
                            <Link to={`/profile/listings/${item.id}/edit`}>Edit</Link>
                            <button type="button" onClick={() => deleteListing(item)}>Remove</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <IconBox />
                    <p>You haven&apos;t added any products or services yet.</p>
                    <Link to="/profile/listings/new" className="cta-button">+ Add your first one</Link>
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === "shopCategories" ? <ProfileShopCategoriesTab /> : null}

            {activeTab === "orders" ? <ProfileOrdersTab /> : null}

            {activeTab === "wallet" ? <ProfileWalletTab /> : null}

            {activeTab === "gallery" ? (
              <section className="detail-block">
                <div className="detail-block-header">
                  <h2>Gallery</h2>
                  <button type="button" className="cta-button" onClick={() => galleryFileRef.current?.click()} disabled={uploadingGallery}>
                    {uploadingGallery ? "Uploading…" : "+ Add photo"}
                  </button>
                  <input ref={galleryFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={addGalleryPhoto} />
                </div>
                <p className="provider-meta profile-section-hint">
                  General photos of your business, work, or space &mdash; separate from the photos on individual products or services.
                </p>
                {provider.media?.gallery?.length ? (
                  <div className="gallery-grid">
                    {provider.media.gallery.map((url) => (
                      <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }}>
                        <button type="button" className="gallery-remove" onClick={() => removeGalleryPhoto(url)} aria-label="Remove photo">
                          <IconClose />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <IconImage />
                    <p>No gallery photos yet.</p>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
