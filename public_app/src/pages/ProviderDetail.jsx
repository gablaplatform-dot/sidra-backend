import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { fetchUnlockedContact } from "../lib/providerContact";
import { getUnlockedContactId } from "../lib/unlockedContacts";
import { getDeviceId } from "../lib/deviceId";
import { findCategoryPath } from "../lib/categories";
import SiteHeader from "../components/SiteHeader";
import { ProviderPageSkeleton } from "../components/Skeleton";
import UnlockModal from "../components/UnlockModal";
import ProviderContactCard from "../components/ProviderContactCard";
import ProviderLayoutDefault from "../components/layouts/ProviderLayoutDefault";
import ProviderLayoutGallery from "../components/layouts/ProviderLayoutGallery";
import ProviderLayoutMenu from "../components/layouts/ProviderLayoutMenu";
import ProviderLayoutBooking from "../components/layouts/ProviderLayoutBooking";
import ProviderLayoutPortfolio from "../components/layouts/ProviderLayoutPortfolio";
import ProviderLayoutEcommerce from "../components/layouts/ProviderLayoutEcommerce";

const LAYOUTS = {
  default: ProviderLayoutDefault,
  gallery: ProviderLayoutGallery,
  menu: ProviderLayoutMenu,
  booking: ProviderLayoutBooking,
  portfolio: ProviderLayoutPortfolio,
  ecommerce: ProviderLayoutEcommerce
};

export default function ProviderDetail() {
  const { t } = useTranslation();
  const { providerId } = useParams();
  const [session] = useState(() => getSession());
  const [provider, setProvider] = useState(null);
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);

  const revealContact = (known) => {
    if (known?.contact) setProvider((prev) => (prev ? { ...prev, contactLocked: false, contact: known.contact, location: known.location ?? prev.location } : prev));
    const request_ = fetchUnlockedContact(providerId, session);
    return request_
      .then((result) => {
        setProvider((prev) => (prev ? { ...prev, contactLocked: false, contact: result.contact, location: result.location } : prev));
        return true;
      })
      .catch(() => false);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      request(`/providers/${encodeURIComponent(providerId)}`),
      request("/categories"),
      request(`/listings/provider/${encodeURIComponent(providerId)}?limit=100`).catch(() => ({ items: [] }))
    ])
      .then(([providerResult, categoryResult, listingResult]) => {
        if (!active) return;
        setProvider(providerResult);
        setCategories(categoryResult?.items || categoryResult || []);
        setListings(listingResult?.items || listingResult || []);

        // If this visitor already paid to unlock this provider (on a previous visit), reflect
        // that immediately instead of showing the locked placeholder again.
        if (providerResult?.contactLocked && (session || getUnlockedContactId(providerId))) {
          revealContact();
        }

        // Fire-and-forget: powers the provider's own Analytics tab. Never blocks or affects this
        // page if it fails (network hiccup, ad blocker, etc).
        request(`/engagement/providers/${encodeURIComponent(providerId)}/visit`, {
          method: "POST",
          body: JSON.stringify({ source: "provider_detail", sessionId: getDeviceId() })
        }).catch(() => {});
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || t("provider.detail.notFound"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [providerId]);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  const categoryMatch = provider ? findCategoryPath(categories, provider.categoryId) : null;
  const categoryName = categoryMatch?.node?.name || t("provider.detail.defaultCategory");
  const layoutKey = categoryMatch?.node?.settings?.layout || "default";
  const Layout = LAYOUTS[layoutKey] || ProviderLayoutDefault;
  const gallery = provider?.media?.gallery || [];
  const providerFields = categoryMatch?.node?.effectiveProviderFields || [];

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <ProviderPageSkeleton />
      ) : !provider ? (
        <div className="page-empty-state">
          <p>{error || t("provider.detail.notFound")}</p>
          <Link to="/home" className="secondary-button">{t("services.backHome")}</Link>
        </div>
      ) : (
        <div className="pcc-page">
          <div className="pcc-page-main">
            {provider.audiences?.length ? (
              <div className="aud-serves">
                <strong>{t("audience.serves")}</strong>
                {provider.audiences.map((a) => <span key={a.id} className="aud-chip">{a.name}</span>)}
              </div>
            ) : null}
            <Layout
              provider={provider}
              categoryId={provider.categoryId}
              categoryName={categoryName}
              categories={categories}
              providerFields={providerFields}
              listings={listings}
              gallery={gallery}
              onUnlock={() => setUnlockOpen(true)}
            />
          </div>
          <ProviderContactCard provider={provider} categoryName={categoryName} onUnlock={() => setUnlockOpen(true)} />
        </div>
      )}

      {unlockOpen ? (
        <UnlockModal
          providerId={provider.id}
          providerName={provider.businessName}
          fee={provider.contactFee}
          onClose={() => setUnlockOpen(false)}
          onUnlocked={revealContact}
        />
      ) : null}
    </main>
  );
}
