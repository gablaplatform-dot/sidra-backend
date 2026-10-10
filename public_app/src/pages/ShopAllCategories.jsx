import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { mapCategoryDto } from "../lib/shopMappers";

import ShopNavbar from "../components/shop/ShopNavbar";
import { CategoryCard } from "../components/shop/ShopCategoryRow";
import ShopFooterTrust from "../components/shop/ShopFooterTrust";
import { CategoryTilesSkeleton } from "../components/Skeleton";

export default function ShopAllCategories() {
  const [session] = useState(() => getSession());
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    document.title = "All Categories — Gabla Shop";
  }, []);

  useEffect(() => {
    let cancelled = false;
    request("/product-categories/roots?limit=60")
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        setCategories(items.map(mapCategoryDto));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => { cancelled = true; };
  }, []);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  return (
    <main className="shop-shell">
      <ShopNavbar session={session} onLogout={logout} />

      <nav className="breadcrumb">
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <span className="breadcrumb-current">All Categories</span>
      </nav>

      <section className="shop-section">
        <div className="shop-section-header">
          <h2 className="shop-section-title">All Categories</h2>
        </div>

        {categories === null ? (
          <CategoryTilesSkeleton count={10} />
        ) : categories.length ? (
          <div className="shop-all-categories-grid">
            {categories.map((cat) => <CategoryCard key={cat.id} category={cat} />)}
          </div>
        ) : (
          <p className="home-empty">No shop categories yet.</p>
        )}
      </section>

      <ShopFooterTrust />
    </main>
  );
}
