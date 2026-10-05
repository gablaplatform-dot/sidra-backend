import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { mapCategoryDto, mapProductDto, mapPromotionDto } from "../lib/shopMappers";
import { getCurrentPosition } from "../lib/geolocation";

import ShopTopBar from "../components/shop/ShopTopBar";
import ShopNavbar from "../components/shop/ShopNavbar";
import ShopHero from "../components/shop/ShopHero";
import ShopAdsHero from "../components/shop/ShopAdsHero";
import { ShopHeroSkeleton } from "../components/Skeleton";
import ShopTrustBar from "../components/shop/ShopTrustBar";
import ShopCategoryRow from "../components/shop/ShopCategoryRow";
import ShopNewArrivals from "../components/shop/ShopNewArrivals";
import ShopBestSellers from "../components/shop/ShopBestSellers";
import ShopPromoBanners from "../components/shop/ShopPromoBanners";
import ShopFooterTrust from "../components/shop/ShopFooterTrust";
import ShopBrowse from "./ShopBrowse";

const safeFetch = async (path, fallback) => {
  try {
    const res = await request(path);
    return res;
  } catch (_err) {
    return null;
  }
};

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

    // Don't leave the hero loading behind a location permission prompt: after a moment show
    // nationwide ads, and swap in the nearby ones if the position arrives later.
    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (!settled) fetchAds(null);
    }, 1500);
    getCurrentPosition()
      .then((coords) => {
        settled = true;
        clearTimeout(fallbackTimer);
        return fetchAds({ lat: coords.lat, lng: coords.lng, radiusKm: ADS_RADIUS_KM });
      })
      .catch(() => {
        settled = true;
        clearTimeout(fallbackTimer);
        fetchAds(null);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
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
    return <ShopBrowse categoryId={categoryId} session={session} onLogout={logout} />;
  }

  const displayCategories = categories ?? [];
  const displayNewArrivals = newArrivals ?? [];
  const displayBestSellers = bestSellers ?? [];

  return (
    <main className="shop-shell">
      <ShopTopBar />
      <ShopNavbar session={session} onLogout={logout} />
      {ads === null ? <ShopHeroSkeleton /> : ads.length ? <ShopAdsHero ads={ads} /> : <ShopHero products={displayNewArrivals.slice(0, 4)} />}
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
