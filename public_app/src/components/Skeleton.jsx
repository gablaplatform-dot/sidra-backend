import React from "react";

// Shimmer placeholders that mirror the real layouts, so a page that is still waiting on data shows
// its final shape instead of a blank screen or a bare "Loading…" line.

const Busy = ({ className = "", children, label = "Loading" }) => (
  <div className={className} role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}…</span>
    {children}
  </div>
);

export const Skel = ({ w, h, r, className = "", style }) => (
  <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
);

export const SkelLines = ({ lines = 3, last = "60%" }) => (
  <span className="skel-lines" aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skel key={i} h={12} w={i === lines - 1 && lines > 1 ? last : "100%"} />
    ))}
  </span>
);

// One product card in the browse / similar / provider grids (matches .sb-card).
export const ProductCardSkeleton = () => (
  <div className="sb-card sb-card-skel" aria-hidden="true">
    <div className="sb-card-media">
      <Skel h="100%" w="100%" r={0} />
    </div>
    <div className="sb-card-body">
      <Skel h={18} w="55%" />
      <Skel h={14} w="90%" />
      <Skel h={12} w="75%" />
      <div className="skel-row">
        <Skel h={20} w={64} r={6} />
        <Skel h={20} w={52} r={6} />
      </div>
      <Skel h={12} w="45%" style={{ marginTop: "auto" }} />
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 8, className = "sb-grid", label = "Loading products" }) => (
  <Busy className={className} label={label}>
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </Busy>
);

// A titled row of product cards (similar products, more from this seller).
export const ProductRowSkeleton = ({ count = 4 }) => (
  <section className="pd-row" aria-hidden="true">
    <div className="pd-row-head">
      <Skel h={24} w={200} />
    </div>
    <div className="pd-row-grid">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  </section>
);

// Shop homepage horizontally scrolling product cards (matches .shop-product-card).
export const ShopScrollSkeleton = ({ count = 5 }) => (
  <Busy className="shop-product-scroll" label="Loading products">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="shop-product-card" aria-hidden="true">
        <div className="shop-product-media">
          <Skel h="100%" w="100%" r={0} />
        </div>
        <div className="shop-product-body">
          <Skel h={14} w="80%" />
          <Skel h={16} w="50%" />
          <Skel h={12} w="40%" />
          <Skel h={38} w="100%" r={12} />
        </div>
      </div>
    ))}
  </Busy>
);

export const ShopCategoriesSkeleton = ({ count = 6 }) => (
  <Busy className="shop-category-scroll skel-categories" label="Loading categories">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="shop-category-card" aria-hidden="true">
        <Skel className="shop-category-img" h={120} w="100%" r={14} />
        <Skel h={14} w="70%" style={{ marginTop: 10 }} />
      </div>
    ))}
  </Busy>
);

export const BannerSkeleton = () => (
  <Busy className="shop-promo-grid" label="Loading offers">
    <Skel h={220} w="100%" r={20} />
    <Skel h={220} w="100%" r={20} />
  </Busy>
);

export const ShopHeroSkeleton = () => (
  <Busy className="shop-hero skel-hero" label="Loading">
    <div className="shop-hero-inner">
      <div className="shop-hero-copy">
        <Skel h={14} w={120} />
        <Skel h={56} w="80%" style={{ marginTop: 16 }} />
        <Skel h={56} w="55%" style={{ marginTop: 10 }} />
        <Skel h={16} w="70%" style={{ marginTop: 20 }} />
        <Skel h={46} w={170} r={999} style={{ marginTop: 28 }} />
      </div>
      <div className="shop-hero-visual">
        <Skel h="100%" w="100%" r={28} style={{ minHeight: 420 }} />
      </div>
    </div>
  </Busy>
);

// Filter sidebar (categories / location / price / attribute groups).
export const SidebarSkeleton = ({ blocks = 4 }) => (
  <Busy className="sb-sidebar" label="Loading filters">
    {Array.from({ length: blocks }).map((_, i) => (
      <section key={i} className="sb-block" aria-hidden="true">
        <div className="sb-block-body">
          <Skel h={16} w="50%" />
          <div className="skel-stack">
            {Array.from({ length: i === 0 ? 5 : 3 }).map((__, j) => (
              <Skel key={j} h={13} w={`${90 - j * 12}%`} />
            ))}
          </div>
        </div>
      </section>
    ))}
  </Busy>
);

// Stacked rows (orders, wallet, ads, categories lists in the profile tabs).
export const ListSkeleton = ({ rows = 4, label = "Loading" }) => (
  <Busy className="skel-list" label={label}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skel-list-row" aria-hidden="true">
        <Skel h={44} w={44} r={10} />
        <div className="skel-list-text">
          <Skel h={14} w="45%" />
          <Skel h={12} w="70%" />
        </div>
        <Skel h={28} w={72} r={999} />
      </div>
    ))}
  </Busy>
);

// A tab / section body: heading + intro + a list.
export const SectionSkeleton = ({ rows = 4, label = "Loading" }) => (
  <section className="detail-block" aria-hidden="true">
    <Skel h={26} w={180} />
    <Skel h={13} w="55%" style={{ margin: "12px 0 22px" }} />
    <ListSkeleton rows={rows} label={label} />
  </section>
);

export const ProviderCardsSkeleton = ({ count = 4 }) => (
  <Busy className="home-provider-grid" label="Loading providers">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skel-provider-card" aria-hidden="true">
        <Skel h={140} w="100%" r={0} />
        <div className="skel-provider-body">
          <Skel h={16} w="65%" />
          <Skel h={12} w="45%" />
          <Skel h={12} w="80%" />
        </div>
      </div>
    ))}
  </Busy>
);

export const CategoryTilesSkeleton = ({ count = 8 }) => (
  <Busy className="shop-all-categories-grid" label="Loading categories">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} aria-hidden="true">
        <Skel h={150} w="100%" r={14} />
        <Skel h={14} w="65%" style={{ marginTop: 10 }} />
      </div>
    ))}
  </Busy>
);

export const ProductDetailSkeleton = () => (
  <Busy className="pd-layout" label="Loading product">
    <div className="pd-main" aria-hidden="true">
      <Skel h={460} w="100%" r={16} />
      <div className="skel-thumbs">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel key={i} h={76} w={76} r={10} />
        ))}
      </div>
      <div className="pd-card">
        <Skel h={20} w={140} />
        <div style={{ marginTop: 14 }}>
          <SkelLines lines={4} />
        </div>
      </div>
    </div>
    <aside className="pd-side" aria-hidden="true">
      <div className="pd-card">
        <Skel h={28} w="85%" />
        <Skel h={14} w="55%" style={{ marginTop: 12 }} />
        <Skel h={36} w="60%" style={{ marginTop: 20 }} />
        <div className="skel-row" style={{ marginTop: 16 }}>
          <Skel h={24} w={70} r={6} />
          <Skel h={24} w={60} r={6} />
          <Skel h={24} w={80} r={6} />
        </div>
        <Skel h={48} w="100%" r={999} style={{ marginTop: 22 }} />
        <Skel h={44} w="100%" r={999} style={{ marginTop: 10 }} />
      </div>
      <div className="pd-seller">
        <div className="skel-row">
          <Skel h={52} w={52} r={999} />
          <div className="skel-list-text">
            <Skel h={16} w="60%" />
            <Skel h={12} w="80%" />
          </div>
        </div>
        <Skel h={46} w="100%" r={12} />
      </div>
    </aside>
  </Busy>
);

export const ProviderPageSkeleton = () => (
  <Busy label="Loading provider">
    <div className="skel-provider-hero" aria-hidden="true">
      <Skel h="100%" w="100%" r={0} />
    </div>
    <div className="provider-detail-grid" aria-hidden="true">
      <div className="provider-detail-main">
        <div className="detail-block">
          <Skel h={24} w={120} />
          <div style={{ marginTop: 14 }}>
            <SkelLines lines={4} />
          </div>
        </div>
        <div className="detail-block">
          <Skel h={24} w={200} />
          <div className="listing-grid" style={{ marginTop: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skel key={i} h={210} w="100%" r={14} />
            ))}
          </div>
        </div>
      </div>
      <aside className="provider-detail-sidebar">
        <div className="sidebar-card">
          <Skel h={20} w="60%" />
          <div style={{ marginTop: 16 }}>
            <SkelLines lines={3} />
          </div>
          <Skel h={44} w="100%" r={12} style={{ marginTop: 18 }} />
        </div>
      </aside>
    </div>
  </Busy>
);

// Generic page body: heading + a card grid. Used by simple pages that just wait on a list.
export const PageSkeleton = ({ cards = 6 }) => (
  <Busy className="skel-page" label="Loading">
    <div aria-hidden="true">
      <Skel h={30} w={260} />
      <Skel h={14} w={340} style={{ marginTop: 12 }} />
    </div>
    <ProductGridSkeleton count={cards} className="sb-grid" />
  </Busy>
);

export const FormSkeleton = ({ fields = 5 }) => (
  <Busy className="listing-form-page" label="Loading form">
    <div aria-hidden="true">
      <Skel h={14} w={70} />
      <Skel h={32} w={320} style={{ marginTop: 10 }} />
      <div className="skel-stack" style={{ marginTop: 28, gap: 22 }}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skel h={13} w={110} />
            <Skel h={46} w="100%" r={10} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  </Busy>
);
