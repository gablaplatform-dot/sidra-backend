import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { addToCart } from "../lib/cart";
import { listingCover } from "../lib/shopMappers";
import { findCategoryPath } from "../lib/categories";
import { cardTags } from "../lib/browseFilters";
import { formatUgx, timeAgo } from "../lib/format";
import { fetchUnlockedContact } from "../lib/providerContact";
import { trackInterest } from "../lib/tracking";
import { getUnlockedContactId } from "../lib/unlockedContacts";
import SiteHeader from "../components/SiteHeader";
import OrderModal from "../components/OrderModal";
import BuyNowModal from "../components/BuyNowModal";
import UnlockModal from "../components/UnlockModal";
import ProductGallery from "../components/product/ProductGallery";
import ProductRow from "../components/product/ProductRow";
import { ProductDetailSkeleton, ProductRowSkeleton } from "../components/Skeleton";
import ProviderContactCard from "../components/ProviderContactCard";
import BookingPanel from "../components/booking/BookingPanel";
// Purely presentational {label, value} list - already generic over any field/value set (built
// for a provider's onboarding answers), reused as-is here for a product's category attributes
// (Make, Color, Mileage, ...) rather than writing a second copy of the same rendering logic.
import ProviderCustomFields, { hasAnsweredCustomFields } from "../components/ProviderCustomFields";
import { IconCart, IconPin } from "../components/icons";

const SERVICE_TIPS = [
  "Agree the price and exactly what is included before any work starts.",
  "Keep your conversation and payments traceable, and pay after the service where you can.",
  "Check reviews and ask for examples of similar work."
];

const SAFETY_TIPS = [
  "Meet the seller in a public place and inspect the item before paying.",
  "Don't pay in advance for something you haven't seen.",
  "Check that the item matches the photos and the description."
];

const uniqueImages = (listing) => {
  const media = listing?.media;
  const list = [];
  if (media && typeof media === "object") {
    if (media.imageUrl) list.push(media.imageUrl);
    if (Array.isArray(media.gallery)) list.push(...media.gallery);
  } else if (typeof media === "string") {
    list.push(media);
  }
  const images = [...new Set(list.filter(Boolean))];
  return images.length ? images : [listingCover(listing)];
};

export default function ProductDetail() {
  const { listingId } = useParams();
  const [session] = useState(() => getSession());
  const [searchParams, setSearchParams] = useSearchParams();
  const [listing, setListing] = useState(null);
  const [tree, setTree] = useState([]);
  const [providerRecord, setProviderRecord] = useState(null);
  // null = still loading (shows a skeleton row), [] = loaded and empty (row is hidden).
  const [similar, setSimilar] = useState(null);
  const [moreFromSeller, setMoreFromSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [buying, setBuying] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setListing(null);
    setSimilar(null);
    setMoreFromSeller(null);
    setProviderRecord(null);
    window.scrollTo({ top: 0 });

    request(`/listings/${encodeURIComponent(listingId)}`)
      .then((result) => {
        if (!active) return;
        setListing(result);
        trackInterest({ type: "view", listingId: result.id });

        // Everything below is progressive enrichment: none of it may block or break the page.
        request(result?.type === "service" ? "/service-categories" : "/product-categories")
          .then((data) => active && setTree(data?.items || data || []))
          .catch(() => {});
        request(`/listings/${encodeURIComponent(listingId)}/similar?limit=8`)
          .then((data) => active && setSimilar(data?.items || []))
          .catch(() => active && setSimilar([]));
        request(`/listings?providerId=${encodeURIComponent(result.providerId)}&type=${result.type}&limit=7`)
          .then((data) => active && setMoreFromSeller((data?.items || []).filter((i) => i.id !== result.id).slice(0, 6)))
          .catch(() => active && setMoreFromSeller([]));
        request(`/providers/${encodeURIComponent(result.providerId)}`)
          .then((record) => {
            if (!active) return;
            setProviderRecord(record);
            if (record?.contactLocked && (session || getUnlockedContactId(result.providerId))) {
              fetchUnlockedContact(result.providerId, session)
                .then((unlocked) => active && setProviderRecord((prev) => (prev ? { ...prev, contactLocked: false, contact: unlocked.contact, location: unlocked.location } : prev)))
                .catch(() => {});
            }
          })
          .catch(() => {});
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "This product could not be found.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const categoryKey = listing?.type === "service" ? listing?.serviceCategoryId : listing?.productCategoryId;
  const found = useMemo(() => (categoryKey ? findCategoryPath(tree, categoryKey) : null), [tree, categoryKey]);
  const specFields = found?.node?.effectiveListingFields || [];
  const images = useMemo(() => (listing ? uniqueImages(listing) : []), [listing]);

  useEffect(() => {
    if (listing) document.title = `${listing.name} - ${formatUgx(listing.price)} | Gabla ${listing.type === "service" ? "Services" : "Shop"}`;
  }, [listing]);

  // Back from signing in via the buy / order dialog: reopen it instead of making the shopper find
  // the button again. The marker is consumed straight away so a refresh doesn't keep reopening it.
  const resume = searchParams.get("resume");
  useEffect(() => {
    if (!resume || !listing) return;
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
    if (!getSession()) return;
    const online = listing.provider?.onlinePaymentsEnabled !== false && listing.onlinePaymentEnabled !== false;
    if (resume === "book") document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (resume === "buy" && listing.type === "product" && online) setBuying(true);
    else if (resume === "order" || resume === "buy") setOrdering(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, listing]);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  const handleAddToCart = () => {
    addToCart(listing.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote("Copy the link from your address bar");
    }
    setTimeout(() => setShareNote(""), 2000);
  };

  const revealContact = () =>
    fetchUnlockedContact(listing.providerId, session)
      .then((unlocked) => {
        setProviderRecord((prev) => (prev ? { ...prev, contactLocked: false, contact: unlocked.contact, location: unlocked.location } : prev));
        return true;
      })
      .catch(() => false);

  const onlinePaymentsAllowed = listing?.provider?.onlinePaymentsEnabled !== false;
  const canBuyNow = listing?.type === "product" && onlinePaymentsAllowed && listing?.onlinePaymentEnabled !== false;
  const price = Number(listing?.price) || 0;
  const was = Number(listing?.originalPrice) || 0;
  const saving = was > price ? was - price : 0;
  const tags = listing ? cardTags(listing.customFields, 4) : [];
  const district = listing?.provider?.district;
  const seller = listing?.provider ? { ...listing.provider, id: listing.providerId } : null;
  const hasSpecs = hasAnsweredCustomFields(specFields, listing?.customFields);
  const categoryId = found?.node?.id;

  const isService = listing?.type === "service";
  // Online payment (mobile money) and cash on delivery are both offered when the seller allows
  // online payment; otherwise cash ordering is the only way to buy.
  const bookable = isService && listing?.bookingMode && listing.bookingMode !== "none" && listing.booking;
  const contactOpen = providerRecord && !providerRecord.contactLocked;
  const goToContact = () => {
    if (providerRecord?.contactLocked) setUnlockOpen(true);
    else document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const primaryAction = bookable ? (
    <button type="button" className="cta-button ecommerce-order-button" onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
      {listing.bookingMode === "instant" ? "Book now" : "Check availability"}
    </button>
  ) : isService ? (
    <button type="button" className="cta-button ecommerce-order-button" onClick={goToContact}>
      {contactOpen ? "See contact details" : "Unlock contact details"}
    </button>
  ) : canBuyNow ? (
    <button type="button" className="cta-button ecommerce-order-button" onClick={() => setBuying(true)}>
      Buy now
    </button>
  ) : (
    <button type="button" className="cta-button ecommerce-order-button" onClick={() => setOrdering(true)}>
      Order now · pay on delivery
    </button>
  );
  const unitWord = bookable ? ` / ${listing.booking.unit}` : "";

  return (
    <main className="home-shell home-themed pd-page">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <ProductDetailSkeleton />
      ) : !listing ? (
        <div className="page-empty-state">
          <p>{error || "This product could not be found."}</p>
          <Link to="/shop" className="secondary-button">Back to shop</Link>
        </div>
      ) : (
        <>
          <nav className="breadcrumb">
            <Link to={isService ? "/services" : "/shop"}>{isService ? "Services" : "Shop"}</Link>
            {(found?.ancestors || []).map((a) => (
              <React.Fragment key={a.id}>
                <span>/</span>
                <Link to={isService ? `/services/c/${a.id}` : `/shop/${a.id}`}>{a.name}</Link>
              </React.Fragment>
            ))}
            {found?.node ? (
              <>
                <span>/</span>
                <Link to={isService ? `/services/c/${categoryId}` : `/shop/${categoryId}`}>{found.node.name}</Link>
              </>
            ) : null}
            <span>/</span>
            <span className="breadcrumb-current">{listing.name}</span>
          </nav>

          <div className="pd-layout">
            <div className="pd-main">
              <ProductGallery images={images} alt={listing.name} />

              {listing.description ? (
                <section className="pd-card">
                  <h2>Description</h2>
                  <p className="pd-description">{listing.description}</p>
                </section>
              ) : null}

              {hasSpecs ? (
                <section className="pd-card pd-specs">
                  <h2>Specifications</h2>
                  <ProviderCustomFields fields={specFields} values={listing.customFields} />
                </section>
              ) : null}

              <section className="pd-card pd-safety">
                <h2>Safety tips</h2>
                <ul>
                  {(isService ? SERVICE_TIPS : SAFETY_TIPS).map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="pd-side">
              <div className="pd-card pd-buybox">
                <h1>{listing.name}</h1>
                <p className="pd-meta">
                  {district ? (
                    <span>
                      <IconPin width={14} height={14} /> {district}
                    </span>
                  ) : null}
                  <span>Posted {timeAgo(listing.createdAt)}</span>
                  {listing.viewCount ? <span>{listing.viewCount.toLocaleString()} views</span> : null}
                </p>

                <div className="pd-price">
                  <strong>{price > 0 ? `${formatUgx(price)}${unitWord}` : "Contact for price"}</strong>
                  {was > price ? <s>{formatUgx(was)}</s> : null}
                  {listing.discountPercent ? <span className="pd-discount">-{listing.discountPercent}%</span> : null}
                </div>
                {saving ? <p className="pd-saving">You save {formatUgx(saving)}</p> : null}

                {tags.length ? (
                  <div className="sb-card-tags pd-tags">
                    {tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}

                <div className="pd-actions">
                  {primaryAction}
                  {canBuyNow ? (
                    <div className="pd-actions-row">
                      <button type="button" className="secondary-button" onClick={() => setOrdering(true)}>
                        Pay on delivery
                      </button>
                      <button type="button" className="secondary-button ecommerce-cart-button" onClick={handleAddToCart}>
                        {added ? "Added" : <><IconCart /> Add to cart</>}
                      </button>
                    </div>
                  ) : null}
                  {canBuyNow ? <p className="pd-pay-note">Pay now with mobile money, or order and pay cash when you receive it.</p> : null}
                  {isService && !bookable ? <p className="pd-pay-note">Unlock the provider&apos;s phone and location to talk about the job and agree a price directly.</p> : null}
                </div>

                <button type="button" className="pd-share" onClick={share}>
                  {shareNote || "Share this listing"}
                </button>
              </div>

              {bookable ? <BookingPanel key={listing.id} listing={listing} /> : null}

              {seller ? (
                <div id="contact">
                <ProviderContactCard
                  variant="inline"
                  provider={providerRecord}
                  fallback={seller}
                  pending={providerRecord === null}
                  listingName={listing.name}
                  onUnlock={() => setUnlockOpen(true)}
                />
                </div>
              ) : null}
            </aside>
          </div>

          {similar === null ? (
            <ProductRowSkeleton count={4} />
          ) : (
            <ProductRow
              title={isService ? "Similar services" : "Similar products"}
              items={similar}
              seeAllTo={isService ? (categoryId ? `/services/c/${categoryId}` : "/services") : categoryId ? `/shop/${categoryId}` : "/shop"}
              seeAllLabel="Browse more"
            />
          )}
          {moreFromSeller === null ? (
            <ProductRowSkeleton count={4} />
          ) : (
            <ProductRow
              title={`More from ${listing.provider?.businessName || "this seller"}`}
              items={moreFromSeller}
              seeAllTo={`/provider/${listing.providerId}`}
              seeAllLabel="Visit shop"
            />
          )}

          <div className="pd-mobilebar">
            <div>
              <strong>{price > 0 ? `${formatUgx(price)}${unitWord}` : "Contact for price"}</strong>
              {was > price ? <s>{formatUgx(was)}</s> : null}
            </div>
            {primaryAction}
          </div>
        </>
      )}

      {ordering ? (
        <OrderModal listing={listing} providerId={listing.providerId} onClose={() => setOrdering(false)} />
      ) : null}
      {buying ? <BuyNowModal listing={listing} onClose={() => setBuying(false)} /> : null}
      {unlockOpen && providerRecord ? (
        <UnlockModal
          providerId={listing.providerId}
          providerName={providerRecord.businessName}
          fee={providerRecord.contactFee}
          onClose={() => setUnlockOpen(false)}
          onUnlocked={revealContact}
        />
      ) : null}
    </main>
  );
}
