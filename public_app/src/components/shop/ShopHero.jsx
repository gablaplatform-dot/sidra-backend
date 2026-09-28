import React from "react";
import { Link } from "react-router-dom";
import { HERO_MODEL_IMAGE } from "../../data/shopData";

const IconArrowRight = (props) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

const FloatingProductCard = ({ product, positionClass }) => (
  <div className={`shop-hero-float ${positionClass}`}>
    <div className="shop-hero-float-img">
      <img src={product.image} alt={product.name} loading="lazy" />
    </div>
    <div className="shop-hero-float-body">
      <strong>{product.name}</strong>
      <span>{product.price}</span>
    </div>
  </div>
);

// Empty-state fallback for when no provider ads exist anywhere (not even nationwide) - shown by
// Shop.jsx in place of ShopAdsHero. `products` are real listings (New Arrivals), never invented.
export default function ShopHero({ products = [] }) {
  return (
    <section className="shop-hero">
      <div className="shop-hero-blob shop-hero-blob-1" />
      <div className="shop-hero-blob shop-hero-blob-2" />

      <div className="shop-hero-inner">
        <div className="shop-hero-copy">
          <p className="shop-eyebrow">TRENDING NOW</p>
          <h1 className="shop-hero-title">
            Discover Products<br />You&rsquo;ll Love
          </h1>
          <p className="shop-hero-subtitle">
            Shop the latest trending products curated for modern lifestyles.
          </p>
          <div className="shop-hero-actions">
            <Link to="/shop" className="shop-cta-primary">
              Shop Now <IconArrowRight />
            </Link>
            <button type="button" className="shop-cta-secondary">
              Explore Collection
            </button>
          </div>
          <div className="shop-hero-trust">
            <div className="shop-hero-avatars">
              <span className="shop-avatar shop-avatar-1" />
              <span className="shop-avatar shop-avatar-2" />
              <span className="shop-avatar shop-avatar-3" />
              <span className="shop-avatar shop-avatar-4" />
            </div>
            <p>Loved by <strong>50,000+</strong> customers worldwide</p>
          </div>
        </div>

        <div className="shop-hero-visual">
          {products[0] ? <FloatingProductCard product={products[0]} positionClass="float-tl" /> : null}
          {products[1] ? <FloatingProductCard product={products[1]} positionClass="float-tr" /> : null}
          {products[2] ? <FloatingProductCard product={products[2]} positionClass="float-ml" /> : null}
          {products[3] ? <FloatingProductCard product={products[3]} positionClass="float-br" /> : null}
          <div className="shop-hero-image-wrap">
            <div className="shop-hero-oval" />
            <img src={HERO_MODEL_IMAGE} alt="Featured model" className="shop-hero-model" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
