import React, { useState } from "react";
import { addToCart } from "../../lib/cart";
import { IconStar } from "../icons";

const IconHeart = (props) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const IconArrowRight = (props) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

const BestSellerCard = ({ product }) => {
  const [wish, setWish] = useState(false);
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    addToCart(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="shop-bestseller-card">
      <div className="shop-bestseller-media">
        <span className="shop-badge shop-badge-bestseller">Bestseller</span>
        <div className="shop-bestseller-img">
          <img src={product.image} alt={product.name} loading="lazy" />
        </div>
      </div>
      <div className="shop-bestseller-body">
        <div>
          <h3 className="shop-bestseller-name">{product.name}</h3>
          <span className="shop-bestseller-price">{product.price}</span>
          <div className="shop-bestseller-rating">
            <div className="shop-stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <IconStar
                  key={i}
                  width={12}
                  height={12}
                  style={{
                    fill: i <= Math.round(product.rating) ? "#F59E0B" : "none",
                    color: i <= Math.round(product.rating) ? "#F59E0B" : "#CBD5E1"
                  }}
                />
              ))}
            </div>
            <span>({product.reviews.toLocaleString()})</span>
          </div>
          <p className="shop-bestseller-desc">{product.description}</p>
        </div>
        <div className="shop-bestseller-actions">
          <button
            type="button"
            className={`shop-quick-add ${added ? "is-added" : ""}`}
            onClick={handleAdd}
          >
            {added ? "Added ✓" : "Quick Add"}
          </button>
          <button
            type="button"
            className={`shop-wish-circle ${wish ? "is-active" : ""}`}
            onClick={() => setWish((v) => !v)}
            aria-label="Add to wishlist"
          >
            <IconHeart />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ShopBestSellers({ products = [] }) {
  const items = Array.isArray(products) && products.length ? products : [];
  return (
    <section className="shop-section">
      <div className="shop-section-header">
        <h2 className="shop-section-title">Best Sellers</h2>
        <a href="#" className="shop-view-all">View All Best Sellers <IconArrowRight /></a>
      </div>

      <div className="shop-bestseller-grid">
        {items.map((p) => (
          <BestSellerCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
