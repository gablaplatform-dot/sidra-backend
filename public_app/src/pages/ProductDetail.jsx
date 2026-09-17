import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { addToCart } from "../lib/cart";
import { listingCover } from "../lib/shopMappers";
import SiteHeader from "../components/SiteHeader";
import OrderModal from "../components/OrderModal";
import BuyNowModal from "../components/BuyNowModal";
import { IconCart } from "../components/icons";

export default function ProductDetail() {
  const { listingId } = useParams();
  const [session] = useState(() => getSession());
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request(`/listings/${encodeURIComponent(listingId)}`)
      .then((result) => {
        if (active) setListing(result);
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
  }, [listingId]);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  const handleAddToCart = () => {
    addToCart(listing.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const onlinePaymentsAllowed = listing?.provider?.onlinePaymentsEnabled !== false;
  const canBuyNow = listing?.type === "product" && onlinePaymentsAllowed && listing?.onlinePaymentEnabled !== false;

  return (
    <main className="home-shell">
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
            <span>/</span>
            <span className="breadcrumb-current">{listing.name}</span>
          </nav>

          <section className="product-detail">
            <div className="product-detail-media">
              <img src={listingCover(listing)} alt={listing.name} />
            </div>

            <div className="product-detail-body">
              <h1>{listing.name}</h1>
              {listing.provider?.businessName ? (
                <Link to={`/provider/${listing.providerId}`} className="provider-meta">
                  Sold by {listing.provider.businessName}
                </Link>
              ) : null}

              <div className="listing-price product-detail-price">
                {Number(listing.price) > 0 ? `UGX ${Number(listing.price).toLocaleString()}` : null}
                {listing.originalPrice && Number(listing.originalPrice) > Number(listing.price) ? (
                  <span className="shop-price-old">UGX {Number(listing.originalPrice).toLocaleString()}</span>
                ) : null}
              </div>

              {listing.description ? <p className="product-detail-description">{listing.description}</p> : null}

              <div className="listing-actions-row product-detail-actions">
                {canBuyNow ? (
                  <>
                    <button type="button" className="cta-button ecommerce-order-button" onClick={() => setBuying(true)}>
                      Buy now
                    </button>
                    <button type="button" className="secondary-button ecommerce-cart-button" onClick={handleAddToCart}>
                      {added ? "Added" : <><IconCart /> Add to cart</>}
                    </button>
                  </>
                ) : (
                  <button type="button" className="cta-button ecommerce-order-button" onClick={() => setOrdering(true)}>
                    Order now
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {ordering ? (
        <OrderModal listing={listing} providerId={listing.providerId} onClose={() => setOrdering(false)} />
      ) : null}
      {buying ? <BuyNowModal listing={listing} onClose={() => setBuying(false)} /> : null}
    </main>
  );
}
