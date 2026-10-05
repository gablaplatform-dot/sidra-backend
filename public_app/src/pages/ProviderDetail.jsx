import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { fetchUnlockedContact } from "../lib/providerContact";
import { getUnlockedContactId } from "../lib/unlockedContacts";
import { getDeviceId } from "../lib/deviceId";
import { findCategoryPath } from "../lib/categories";
import SiteHeader from "../components/SiteHeader";
import { ProviderPageSkeleton } from "../components/Skeleton";
import UnlockModal from "../components/UnlockModal";
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
  const { providerId } = useParams();
  const [session] = useState(() => getSession());
  const [provider, setProvider] = useState(null);
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);

  const revealContact = () => {
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
        if (active) setError(loadError.message || "This provider could not be found.");
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
  const categoryName = categoryMatch?.node?.name || "Service provider";
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
          <p>{error || "This provider could not be found."}</p>
          <Link to="/home" className="secondary-button">Back to home</Link>
        </div>
      ) : (
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
