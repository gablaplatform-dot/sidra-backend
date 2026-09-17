import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { mapCategoryDto, mapProductDto, mapPromotionDto } from "../lib/shopMappers";
import { findCategoryPath } from "../lib/categories";
import { SHOP_CATEGORIES, NEW_ARRIVALS, BEST_SELLERS, FLASH_SALE, NEW_COLLECTION } from "../data/shopData";

import ShopTopBar from "../components/shop/ShopTopBar";
import ShopNavbar from "../components/shop/ShopNavbar";
import ShopHero from "../components/shop/ShopHero";
import ShopTrustBar from "../components/shop/ShopTrustBar";
import ShopCategoryRow from "../components/shop/ShopCategoryRow";
import ShopNewArrivals, { ProductCard } from "../components/shop/ShopNewArrivals";
import ShopBestSellers from "../components/shop/ShopBestSellers";
import ShopPromoBanners from "../components/shop/ShopPromoBanners";
import ShopFooterTrust from "../components/shop/ShopFooterTrust";

const safeFetch = async (path, fallback) => {
  try {
    const res = await request(path);
    return res;
  } catch (_err) {
    return null;
  }
};

// Browsing a specific shop/product category (clicked from ShopCategoryRow) - separate from the
// generic Shop homepage below, since it needs its own breadcrumb/subcategory nav and a product
// grid scoped to that category (and its descendants, expanded server-side).
function ShopCategoryPage({ categoryId, session, onLogout }) {
  const [tree, setTree] = useState(null);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      safeFetch("/product-categories"),
      safeFetch(`/listings?type=product&productCategoryId=${encodeURIComponent(categoryId)}&limit=48`)
    ]).then(([categoryResult, listingResult]) => {
      if (cancelled) return;
      setTree(categoryResult?.items || categoryResult || []);
      setProducts(listingResult?.items || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [categoryId]);

  const found = findCategoryPath(tree || [], categoryId);
  const category = found?.node;
  const ancestors = found?.ancestors || [];
  const children = category?.children || [];
  const mappedProducts = (products || []).map((p) => mapProductDto(p));

  return (
    <main className="shop-shell">
      <ShopTopBar />
      <ShopNavbar session={session} onLogout={onLogout} />

      <nav className="breadcrumb">
        <Link to="/shop">Shop</Link>
        {ancestors.map((a) => (
          <React.Fragment key={a.id}>
            <span>/</span>
            <Link to={`/shop/${a.id}`}>{a.name}</Link>
          </React.Fragment>
        ))}
        {category ? (
          <>
            <span>/</span>
            <span className="breadcrumb-current">{category.name}</span>
          </>
        ) : null}
      </nav>

      {children.length ? (
        <div className="shop-subcategory-row">
          {children.map((c) => (
            <Link key={c.id} to={`/shop/${c.id}`} className="shop-subcategory-chip">{c.name}</Link>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="home-empty page-loading">Loading…</p>
      ) : mappedProducts.length ? (
        <div className="shop-category-product-grid">
          {mappedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="home-empty">No products in {category?.name || "this category"} yet.</p>
      )}

      <ShopFooterTrust />
    </main>
  );
}

const pickFlashSale = (promos) => {
  if (!promos?.length) return null;
  const flash = promos.find((p) => p.type === "flash_sale");
  return flash ?? promos.find((p) => !!p.remainingSecs) ?? promos[0];
};

const pickCollectionBanner = (promos) => {
  if (!promos?.length) return null;
  const collection = promos.find((p) => p.type === "new_collection");
  if (collection) return collection;
  const rest = promos.filter((p) => p.type !== "flash_sale");
  return rest[0] ?? null;
};

export default function Shop() {
  const { categoryId } = useParams();
  const [session] = useState(() => getSession());
  const [categories, setCategories] = useState(null);
  const [newArrivals, setNewArrivals] = useState(null);
  const [bestSellers, setBestSellers] = useState(null);
  const [flashSale, setFlashSale] = useState(null);
  const [newCollection, setNewCollection] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = "Gabla Shop — Trendy Fashion, Electronics & Lifestyle";
  }, []);

  useEffect(() => {
    if (categoryId) return;
    let cancelled = false;
    const load = async () => {
      const [cats, arrivals, sellers, promos] = await Promise.all([
        safeFetch("/product-categories/roots?limit=6"),
        safeFetch("/listings/new-arrivals?limit=6&type=product"),
        safeFetch("/listings/best-sellers?limit=3&type=product"),
        safeFetch("/promotions/featured?limit=4")
      ]);
      if (cancelled) return;

      if (Array.isArray(cats?.items) && cats.items.length) {
        setCategories(cats.items.map(mapCategoryDto));
      } else {
        setCategories(SHOP_CATEGORIES);
      }

      if (Array.isArray(arrivals?.items) && arrivals.items.length) {
        setNewArrivals(arrivals.items.map((p) => mapProductDto(p)));
      } else {
        setNewArrivals(NEW_ARRIVALS);
      }

      if (Array.isArray(sellers?.items) && sellers.items.length) {
        setBestSellers(sellers.items.map((p) => mapProductDto(p, { reviewOffset: 1800 })));
      } else {
        setBestSellers(BEST_SELLERS);
      }

      const mappedPromos = Array.isArray(promos?.items) && promos.items.length
        ? promos.items.map(mapPromotionDto)
        : [];

      const flash = pickFlashSale(mappedPromos) ?? {
        type: "flash_sale",
        title: FLASH_SALE.title,
        subtitle: FLASH_SALE.subtitle,
        cta: FLASH_SALE.cta,
        ctaHref: "/shop",
        image: FLASH_SALE.image,
        remainingSecs: 2 * 86400 + 15 * 3600 + 45 * 60 + 30,
        isActiveNow: true
      };
      setFlashSale(flash);

      const collection = pickCollectionBanner(mappedPromos) ?? {
        type: "new_collection",
        tag: NEW_COLLECTION.tag,
        title: NEW_COLLECTION.title,
        subtitle: NEW_COLLECTION.subtitle,
        cta: NEW_COLLECTION.cta,
        ctaHref: "/shop",
        image: NEW_COLLECTION.image,
        isActiveNow: true
      };
      setNewCollection(collection);
      setLoaded(true);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  if (categoryId) {
    return <ShopCategoryPage categoryId={categoryId} session={session} onLogout={logout} />;
  }

  const displayCategories = categories ?? SHOP_CATEGORIES;
  const displayNewArrivals = newArrivals ?? NEW_ARRIVALS;
  const displayBestSellers = bestSellers ?? BEST_SELLERS;
  const displayFlash = flashSale ?? {
    type: "flash_sale",
    title: FLASH_SALE.title,
    subtitle: FLASH_SALE.subtitle,
    cta: FLASH_SALE.cta,
    ctaHref: "/shop",
    image: FLASH_SALE.image,
    remainingSecs: 2 * 86400 + 15 * 3600 + 45 * 60 + 30,
    isActiveNow: true
  };
  const displayCollection = newCollection ?? {
    type: "new_collection",
    tag: NEW_COLLECTION.tag,
    title: NEW_COLLECTION.title,
    subtitle: NEW_COLLECTION.subtitle,
    cta: NEW_COLLECTION.cta,
    ctaHref: "/shop",
    image: NEW_COLLECTION.image,
    isActiveNow: true
  };

  return (
    <main className="shop-shell">
      <ShopTopBar />
      <ShopNavbar session={session} onLogout={logout} />
      <ShopHero />
      <ShopTrustBar />
      <ShopCategoryRow categories={displayCategories} loaded={loaded} />
      <ShopNewArrivals products={displayNewArrivals} loaded={loaded} />
      <ShopBestSellers products={displayBestSellers} loaded={loaded} />
      <ShopPromoBanners flashSale={displayFlash} newCollection={displayCollection} loaded={loaded} />
      <ShopFooterTrust />
    </main>
  );
}
