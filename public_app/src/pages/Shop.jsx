import React, { useEffect, useState } from "react";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { mapCategoryDto, mapProductDto, mapPromotionDto } from "../lib/shopMappers";
import { SHOP_CATEGORIES, NEW_ARRIVALS, BEST_SELLERS, FLASH_SALE, NEW_COLLECTION } from "../data/shopData";

import ShopTopBar from "../components/shop/ShopTopBar";
import ShopNavbar from "../components/shop/ShopNavbar";
import ShopHero from "../components/shop/ShopHero";
import ShopTrustBar from "../components/shop/ShopTrustBar";
import ShopCategoryRow from "../components/shop/ShopCategoryRow";
import ShopNewArrivals from "../components/shop/ShopNewArrivals";
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
    let cancelled = false;
    const load = async () => {
      const [cats, arrivals, sellers, promos] = await Promise.all([
        safeFetch("/categories/ecommerce?limit=6"),
        safeFetch("/listings/new-arrivals?limit=6"),
        safeFetch("/listings/best-sellers?limit=3"),
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
