import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { mapCategoryDto, mapProductDto, mapPromotionDto } from "../lib/shopMappers";
import { findCategoryPath } from "../lib/categories";
import { getCurrentPosition } from "../lib/geolocation";

import ShopTopBar from "../components/shop/ShopTopBar";
import ShopNavbar from "../components/shop/ShopNavbar";
import ShopHero from "../components/shop/ShopHero";
import ShopAdsHero from "../components/shop/ShopAdsHero";
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
  const [ads, setAds] = useState(null);

  useEffect(() => {
    document.title = "Gabla Shop — Trendy Fashion, Electronics & Lifestyle";
  }, []);

  const ADS_RADIUS_KM = 15;

  useEffect(() => {
    if (categoryId) return;
    let cancelled = false;

    const fetchAds = async (params) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : "";
      const data = await safeFetch(`/promotions/ads/nearby${query}`);
      if (!cancelled) setAds(Array.isArray(data?.items) ? data.items : []);
    };

    getCurrentPosition()
      .then((coords) => fetchAds({ lat: coords.lat, lng: coords.lng, radiusKm: ADS_RADIUS_KM }))
      .catch(() => fetchAds(null));

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

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

      setCategories(Array.isArray(cats?.items) ? cats.items.map(mapCategoryDto) : []);

      setNewArrivals(Array.isArray(arrivals?.items) ? arrivals.items.map((p) => mapProductDto(p)) : []);

      setBestSellers(
        Array.isArray(sellers?.items) ? sellers.items.map((p) => mapProductDto(p, { reviewOffset: 1800 })) : []
      );

      const mappedPromos = Array.isArray(promos?.items) && promos.items.length
        ? promos.items.map(mapPromotionDto)
        : [];

      setFlashSale(pickFlashSale(mappedPromos));
      setNewCollection(pickCollectionBanner(mappedPromos));
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

  const displayCategories = categories ?? [];
  const displayNewArrivals = newArrivals ?? [];
  const displayBestSellers = bestSellers ?? [];

  return (
    <main className="shop-shell">
      <ShopTopBar />
      <ShopNavbar session={session} onLogout={logout} />
      {ads?.length ? <ShopAdsHero ads={ads} /> : <ShopHero products={displayNewArrivals.slice(0, 4)} />}
      <ShopTrustBar />
      {!loaded || displayCategories.length ? (
        <ShopCategoryRow categories={displayCategories} loaded={loaded} />
      ) : null}
      {!loaded || displayNewArrivals.length ? (
        <ShopNewArrivals products={displayNewArrivals} loaded={loaded} />
      ) : null}
      {!loaded || displayBestSellers.length ? (
        <ShopBestSellers products={displayBestSellers} loaded={loaded} />
      ) : null}
      {!loaded || flashSale || newCollection ? (
        <ShopPromoBanners flashSale={flashSale} newCollection={newCollection} loaded={loaded} />
      ) : null}
      <ShopFooterTrust />
    </main>
  );
}
