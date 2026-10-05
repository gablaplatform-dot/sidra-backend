import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { addToCart } from "../lib/cart";
import { listingCover } from "../lib/shopMappers";
import { findCategoryPath } from "../lib/categories";
import { cardTags } from "../lib/browseFilters";
import { formatUgx, timeAgo } from "../lib/format";
import { fetchUnlockedContact } from "../lib/providerContact";
import { getUnlockedContactId } from "../lib/unlockedContacts";
import SiteHeader from "../components/SiteHeader";
import OrderModal from "../components/OrderModal";
import BuyNowModal from "../components/BuyNowModal";
import UnlockModal from "../components/UnlockModal";
import ProductGallery from "../components/product/ProductGallery";
import ProductRow from "../components/product/ProductRow";
import SellerCard from "../components/product/SellerCard";
// Purely presentational {label, value} list - already generic over any field/value set (built
// for a provider's onboarding answers), reused as-is here for a product's category attributes
// (Make, Color, Mileage, ...) rather than writing a second copy of the same rendering logic.
import ProviderCustomFields, { hasAnsweredCustomFields } from "../components/ProviderCustomFields";
import { IconCart, IconPin } from "../components/icons";

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
  const [listing, setListing] = useState(null);
  const [tree, setTree] = useState([]);
  const [providerRecord, setProviderRecord] = useState(null);
  const [contact, setContact] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [moreFromSeller, setMoreFromSeller] = useState([]);
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
    setSimilar([]);
    setMoreFromSeller([]);
    setProviderRecord(null);
    setContact(null);
    window.scrollTo({ top: 0 });

    request(`/listings/${encodeURIComponent(listingId)}`)
      .then((result) => {
        if (!active) return;
        setListing(result);

        // Everything below is progressive enrichment: none of it may block or break the page.
        if (result?.type === "product") {
          request("/product-categories")
            .then((data) => active && setTree(data?.items || data || []))
            .catch(() => {});
        }
        request(`/listings/${encodeURIComponent(listingId)}/similar?limit=8`)
          .then((data) => active && setSimilar(data?.items || []))
          .catch(() => {});
        request(`/listings?providerId=${encodeURIComponent(result.providerId)}&type=${result.type}&limit=7`)
          .then((data) => active && setMoreFromSeller((data?.items || []).filter((i) => i.id !== result.id).slice(0, 6)))
          .catch(() => {});
        request(`/providers/${encodeURIComponent(result.providerId)}`)
          .then((record) => {
            if (!active) return;
            setProviderRecord(record);
            if (record?.contactLocked && (session || getUnlockedContactId(result.providerId))) {
              fetchUnlockedContact(result.providerId, session)
                .then((unlocked) => active && setContact(unlocked.contact))
                .catch(() => {});
            } else if (record && !record.contactLocked) {
              setContact(record.contact);
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

  const found = useMemo(
    () => (listing?.productCategoryId ? findCategoryPath(tree, listing.productCategoryId) : null),
    [tree, listing?.productCategoryId]
  );
  const specFields = found?.node?.effectiveListingFields || [];
  const images = useMemo(() => (listing ? uniqueImages(listing) : []), [listing]);

  useEffect(() => {
    if (listing) document.title = `${listing.name} - ${formatUgx(listing.price)} | Gabla Shop`;
  }, [listing]);

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
        setContact(unlocked.contact);
        setProviderRecord((prev) => (prev ? { ...prev, contactLocked: false } : prev));
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

  const primaryAction = canBuyNow ? (
    <button type="button" className="cta-button ecommerce-order-button" onClick={() => setBuying(true)}>
      Buy now
    </button>
  ) : (
    <button type="button" className="cta-button ecommerce-order-button" onClick={() => setOrdering(true)}>
      {listing?.type === "service" ? "Request this service" : "Order now"}
    </button>
  );

  return (
    <main className="home-shell home-themed pd-page">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <p className="home-empty page-loading">Loading…</p>
      ) : !listing ? (
        <div className="page-empty-state">
          <p>{error || "This product could not be found."}</p>
          <Link to="/shop" className="secondary-button">Back to shop</Link>
        </div>
      ) : (
        <>
          <nav className="breadcrumb">
            <Link to="/shop">Shop</Link>
            {(found?.ancestors || []).map((a) => (
              <React.Fragment key={a.id}>
                <span>/</span>
                <Link to={`/shop/${a.id}`}>{a.name}</Link>
              </React.Fragment>
            ))}
            {found?.node ? (
              <>
                <span>/</span>
                <Link to={`/shop/${categoryId}`}>{found.node.name}</Link>
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
                  {SAFETY_TIPS.map((tip) => (
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
                  <strong>{price > 0 ? formatUgx(price) : "Contact for price"}</strong>
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
                    <button type="button" className="secondary-button ecommerce-cart-button" onClick={handleAddToCart}>
                      {added ? "Added" : <><IconCart /> Add to cart</>}
                    </button>
                  ) : null}
                </div>

                <button type="button" className="pd-share" onClick={share}>
                  {shareNote || "Share this listing"}
                </button>
              </div>

              {seller ? (
                <SellerCard
                  seller={{ ...seller, ...(providerRecord ? { ratingAvg: providerRecord.ratingAvg ?? seller.ratingAvg } : {}) }}
                  contact={contact}
                  locked={Boolean(providerRecord?.contactLocked) && !contact}
                  listingName={listing.name}
                  onUnlock={() => setUnlockOpen(true)}
                />
              ) : null}
            </aside>
          </div>

          <ProductRow
            title="Similar products"
            items={similar}
            seeAllTo={categoryId ? `/shop/${categoryId}` : "/shop"}
            seeAllLabel="Browse more"
          />
          <ProductRow
            title={`More from ${listing.provider?.businessName || "this seller"}`}
            items={moreFromSeller}
            seeAllTo={`/provider/${listing.providerId}`}
            seeAllLabel="Visit shop"
          />

          <div className="pd-mobilebar">
            <div>
              <strong>{price > 0 ? formatUgx(price) : "Contact for price"}</strong>
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
