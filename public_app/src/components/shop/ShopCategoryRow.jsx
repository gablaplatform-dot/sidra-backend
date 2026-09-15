import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

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

export default function ShopCategoryRow({ categories = [] }) {
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
  }, [categories?.length]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.7), behavior: "smooth" });
    setTimeout(updateScrollState, 500);
  };

  const items = Array.isArray(categories) && categories.length ? categories : [];

  return (
    <section className="shop-section">
      <div className="shop-section-header">
        <h2 className="shop-section-title">Shop by Categories</h2>
        <Link to="/home#categories" className="shop-view-all">View All Categories <IconArrowRight /></Link>
      </div>

      <div className="shop-category-wrap">
        {canScroll.left ? (
          <button type="button" className="shop-scroll-btn shop-scroll-left" onClick={() => scroll(-1)} aria-label="Scroll left">
            <IconArrowLeft />
          </button>
        ) : null}

        <div
          ref={scrollRef}
          className="shop-category-scroll"
          onScroll={updateScrollState}
        >
          {items.map((cat) => (
            <Link to={`/shop/${cat.id}`} className="shop-category-card" key={cat.id}>
              <div className="shop-category-img">
                <img src={cat.image} alt={cat.name} loading="lazy" />
              </div>
              <div className="shop-category-info">
                <h3>{cat.name}</h3>
                <span className="shop-category-cta">
                  Shop Now <IconArrowRight />
                </span>
              </div>
            </Link>
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
