import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addToCart } from "../../lib/cart";
import { IconCart, IconStar } from "../icons";

const IconHeart = (props) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

const IconArrowLeft = (props) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="20" y1="12" x2="4" y2="12" />
    <polyline points="11 19 4 12 11 5" />
  </svg>
);

const IconArrowRight = (props) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

const StarRating = ({ rating, reviews }) => (
  <div className="shop-product-rating">
    <div className="shop-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar
          key={i}
          width={12}
          height={12}
          style={{
            fill: i <= Math.round(rating) ? "#F59E0B" : "none",
            color: i <= Math.round(rating) ? "#F59E0B" : "#CBD5E1"
          }}
        />
      ))}
    </div>
    <span>({reviews.toLocaleString()})</span>
  </div>
);

export const ProductCard = ({ product }) => {
  const [wish, setWish] = useState(false);
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    addToCart(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="shop-product-card">
      <Link to={`/shop/product/${product.id}`} className="shop-product-media">
        {product.isNew ? <span className="shop-badge shop-badge-new">New</span> : null}
        {product.discount ? <span className="shop-badge shop-badge-sale">{product.discount}</span> : null}
        <button
          type="button"
          className={`shop-wish-btn ${wish ? "is-active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            setWish((v) => !v);
          }}
          aria-label="Add to wishlist"
        >
          <IconHeart />
        </button>
        <div className="shop-product-img">
          <img src={product.image} alt={product.name} loading="lazy" />
        </div>
      </Link>
      <div className="shop-product-body">
        <Link to={`/shop/product/${product.id}`} className="shop-product-name-link">
          <h3 className="shop-product-name">{product.name}</h3>
        </Link>
        <div className="shop-product-prices">
          <span className="shop-price-current">{product.price}</span>
          {product.originalPrice ? <span className="shop-price-old">{product.originalPrice}</span> : null}
        </div>
        <StarRating rating={product.rating} reviews={product.reviews} />
        <button
          type="button"
          className={`shop-add-cart ${added ? "is-added" : ""}`}
          onClick={handleAdd}
          aria-label="Add to cart"
        >
          {added ? "Added" : <IconCart width={14} height={14} />}
        </button>
      </div>
    </div>
  );
};

export default function ShopNewArrivals({ products = [] }) {
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScroll({ left: el.scrollLeft > 8, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
  };

  useEffect(() => {
    updateScrollState();
    const t = setTimeout(updateScrollState, 350);
    return () => clearTimeout(t);
  }, [products?.length]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: "smooth" });
    setTimeout(updateScrollState, 500);
  };

  const items = Array.isArray(products) && products.length ? products : [];

  return (
    <section className="shop-section">
      <div className="shop-section-header">
        <h2 className="shop-section-title">New Arrivals</h2>
        <a href="#" className="shop-view-all">View All New Arrivals <IconArrowRight /></a>
      </div>

      <div className="shop-product-wrap">
        {canScroll.left ? (
          <button type="button" className="shop-scroll-btn shop-scroll-left" onClick={() => scroll(-1)} aria-label="Scroll left">
            <IconArrowLeft />
          </button>
        ) : null}

        <div ref={scrollRef} className="shop-product-scroll" onScroll={updateScrollState}>
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {canScroll.right ? (
          <button type="button" className="shop-scroll-btn shop-scroll-right" onClick={() => scroll(1)} aria-label="Scroll right">
            <IconArrowRight />
          </button>
        ) : null}
      </div>
    </section>
  );
}
