import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AudiencePicker from "../components/AudiencePicker";
import { loginPath } from "../lib/authRedirect";
import { formatUgx } from "../lib/format";

import { request } from "../lib/api";
import { uploadFile } from "../lib/storage";
import { clearSession, getSession } from "../lib/session";
import SiteHeader from "../components/SiteHeader";
import Field from "../components/Field";
import ProfileOrdersTab from "../components/profile/ProfileOrdersTab";
import ProfileBookingsTab from "../components/profile/ProfileBookingsTab";
import ProfileWalletTab from "../components/profile/ProfileWalletTab";
import ProfileShopCategoriesTab from "../components/profile/ProfileShopCategoriesTab";
import ProfileAnalyticsTab from "../components/profile/ProfileAnalyticsTab";
import ProfileAdsTab from "../components/profile/ProfileAdsTab";
import ProfileDocumentsTab from "../components/profile/ProfileDocumentsTab";
import { IconBox, IconCamera, IconClose, IconImage } from "../components/icons";
import { Skel, SectionSkeleton } from "../components/Skeleton";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const TABS = [
  { key: "info" },
  { key: "analytics" },
  { key: "listings" },
  { key: "shopCategories" },
  { key: "ads" },
  { key: "orders" },
  { key: "bookings" },
  { key: "documents" },
  { key: "wallet" },
  { key: "gallery" }
];

export default function Profile() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [session] = useState(() => getSession());
  const [provider, setProvider] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [docsDirty, setDocsDirty] = useState(false);
  const [focusOrderId, setFocusOrderId] = useState(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const avatarFileRef = useRef(null);
  const coverFileRef = useRef(null);
  const galleryFileRef = useRef(null);

  const [form, setForm] = useState({ businessName: "", description: "", phone: "", whatsapp: "", website: "", onlinePaymentsEnabled: true });
  const [audience, setAudience] = useState({ ids: [], suggestions: [] });
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    if (!session || !session.provider) {
      // Only remember where to return to when nobody is signed in: a signed-in non-provider would loop.
      navigate(session ? "/login" : loginPath(location), { replace: true });
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
        setAudience({ ids: (providerResult.audiences || []).map((a) => a.id), suggestions: [] });
      })
      .catch((loadError) => setError(loadError.message || t("profile.errLoad")))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session]);

  const changeTab = (key, focusId = null) => {
    if (key === activeTab && !focusId) return;
    if (activeTab === "documents" && docsDirty && !window.confirm(t("profile.confirmLeaveDocs"))) return;
    setFocusOrderId(focusId);
    setActiveTab(key);
  };

  const openOrder = (orderId) => changeTab("orders", orderId);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const deleteListing = async (listing) => {
    if (!window.confirm(t("profile.confirmRemoveListing", { name: listing.name }))) return;
    try {
      await request(`/listings/${listing.id}`, { method: "DELETE" });
      load();
    } catch (deleteError) {
      setError(deleteError.message || t("profile.errRemoveListing"));
    }
  };

  const saveProfileInfo = async (event) => {
    event.preventDefault();
    if (!form.businessName.trim()) {
      setError(t("profile.errNameEmpty"));
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
          onlinePaymentsEnabled: form.onlinePaymentsEnabled,
          audienceIds: audience.ids,
          ...(audience.suggestions.length ? { newAudiences: audience.suggestions } : {})
        })
      });
      setProvider(updated);
      setAudience({ ids: (updated.audiences || []).map((a) => a.id), suggestions: [] });
      setNotice(t("profile.updated"));
    } catch (saveError) {
      setError(saveError.message || t("profile.errSave"));
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
      setError(uploadError.message || t("profile.errUploadPhoto"));
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
      setError(uploadError.message || t("profile.errUploadPhoto"));
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
      setError(removeError.message || t("profile.errRemovePhoto"));
    }
  };

  if (!session?.provider) return null;

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <div className="skel-page" role="status" aria-busy="true">
          <span className="sr-only">{t("profile.loading")}</span>
          <Skel h={190} w="100%" r={20} />
          <Skel h={44} w="70%" r={999} style={{ margin: "20px 0" }} />
          <SectionSkeleton rows={3} label={t("profile.loading")} />
        </div>
      ) : !provider ? (
        <div className="page-empty-state">
          <p>{error || t("profile.errLoadFallback")}</p>
          <Link to="/home" className="secondary-button">{t("profile.backHome")}</Link>
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
              aria-label={t("profile.changeCoverAria")}
            >
              <IconCamera /> <span>{uploadingCover ? t("profile.uploading") : t("profile.changeCover")}</span>
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
                  aria-label={t("profile.changeAvatarAria")}
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
                <p className="provider-hero-meta">{t("profile.publicProfile")} &middot; <Link to={`/provider/${provider.id}`}>{t("profile.viewLive")}</Link></p>
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
                onClick={() => changeTab(tab.key)}
              >
                {t(`profile.tabs.${tab.key}`)}
              </button>
            ))}
          </nav>

          <div className="provider-detail-main profile-main">
            {activeTab === "info" ? (
              <section className="detail-block profile-info-form">
                <form onSubmit={saveProfileInfo}>
                  <div className="form-grid two">
                    <Field label={t("profile.businessName")}>
                      <input
                        required
                        value={form.businessName}
                        onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                      />
                    </Field>
                    <Field label={t("profile.phone")}>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder={t("profile.phonePlaceholder")}
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <input
                        value={form.whatsapp}
                        onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                        placeholder={t("profile.phonePlaceholder")}
                      />
                    </Field>
                    <Field label={t("profile.websiteOptional")}>
                      <input
                        value={form.website}
                        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                        placeholder="https://"
                      />
                    </Field>
                  </div>
                  <Field label={t("profile.description")} as="div">
                    <textarea
                      rows="5"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder={t("profile.descriptionPlaceholder")}
                    />
                  </Field>
                  <Field label={t("audience.title")} as="div">
                    <AudiencePicker value={audience} onChange={setAudience} known={provider?.audiences || []} />
                  </Field>
                  <Field label={t("profile.onlinePayments")} as="div">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.onlinePaymentsEnabled}
                        onChange={(e) => setForm((f) => ({ ...f, onlinePaymentsEnabled: e.target.checked }))}
                      />
                      <span>{t("profile.acceptOnline")}</span>
                    </label>
                  </Field>
                  <button className="primary-button profile-save-button" type="submit" disabled={savingInfo}>
                    {savingInfo ? t("profile.saving") : t("profile.saveChanges")}
                  </button>
                </form>
              </section>
            ) : null}

            {activeTab === "analytics" ? <ProfileAnalyticsTab /> : null}

            {activeTab === "listings" ? (
              <section className="detail-block">
                <div className="detail-block-header">
                  <h2>{t("profile.tabs.listings")}</h2>
                  <Link to="/profile/listings/new" className="cta-button">{t("profile.add")}</Link>
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
                          {Number(item.price) > 0 ? <div className="listing-price">{formatUgx(item.price)}</div> : null}
                          <div style={{ margin: "8px 0" }}>
                            <span className={`status-badge status-${item.status === "approved" ? "fulfilled" : "pending"}`}>
                              {item.status === "approved" ? t("profile.live") : t("profile.pendingReview")}
                            </span>
                          </div>
                          <div className="listing-actions">
                            <Link to={`/profile/listings/${item.id}/edit`}>{t("profile.edit")}</Link>
                            <button type="button" onClick={() => deleteListing(item)}>{t("profile.remove")}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <IconBox />
                    <p>{t("profile.noListings")}</p>
                    <Link to="/profile/listings/new" className="cta-button">{t("profile.addFirst")}</Link>
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === "shopCategories" ? <ProfileShopCategoriesTab /> : null}

            {activeTab === "ads" ? <ProfileAdsTab /> : null}

            {activeTab === "bookings" ? <ProfileBookingsTab /> : null}

            {activeTab === "orders" ? <ProfileOrdersTab focusOrderId={focusOrderId} /> : null}

            {activeTab === "documents" ? <ProfileDocumentsTab provider={provider} onOpenOrder={openOrder} onDirtyChange={setDocsDirty} /> : null}

            {activeTab === "wallet" ? <ProfileWalletTab /> : null}

            {activeTab === "gallery" ? (
              <section className="detail-block">
                <div className="detail-block-header">
                  <h2>{t("profile.tabs.gallery")}</h2>
                  <button type="button" className="cta-button" onClick={() => galleryFileRef.current?.click()} disabled={uploadingGallery}>
                    {uploadingGallery ? t("profile.uploading") : t("profile.addPhoto")}
                  </button>
                  <input ref={galleryFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={addGalleryPhoto} />
                </div>
                <p className="provider-meta profile-section-hint">
                  {t("profile.galleryHint")}
                </p>
                {provider.media?.gallery?.length ? (
                  <div className="gallery-grid">
                    {provider.media.gallery.map((url) => (
                      <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }}>
                        <button type="button" className="gallery-remove" onClick={() => removeGalleryPhoto(url)} aria-label={t("profile.removePhotoAria")}>
                          <IconClose />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <IconImage />
                    <p>{t("profile.noGallery")}</p>
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
