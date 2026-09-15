import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import { findCategoryPath } from "../lib/categories";
import SiteHeader from "../components/SiteHeader";
import ProviderCard from "../components/ProviderCard";
import { IconBox, IconChevronLeft } from "../components/icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const [session] = useState(() => getSession());
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      request("/categories"),
      request(`/providers?categoryId=${encodeURIComponent(categoryId)}&limit=50`),
      request(`/listings?categoryId=${encodeURIComponent(categoryId)}&limit=50`)
    ])
      .then(([categoryResult, providerResult, listingResult]) => {
        if (!active) return;
        setCategories(categoryResult?.items || categoryResult || []);
        setProviders(providerResult?.items || providerResult || []);
        setListings(listingResult?.items || listingResult || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load this category right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId]);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  const found = findCategoryPath(categories, categoryId);
  const category = found?.node;
  const ancestors = found?.ancestors || [];
  const image = category?.settings?.imageUrl || category?.settings?.pictureUrl || "";
  const children = category?.children || [];

  return (
    <main className="home-shell">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <p className="home-empty page-loading">Loading…</p>
      ) : !category ? (
        <div className="page-empty-state">
          <p>This category could not be found.</p>
          <Link to="/home" className="secondary-button">Back to home</Link>
        </div>
      ) : (
        <>
          <nav className="breadcrumb">
            <Link to="/home">Home</Link>
            {ancestors.map((a) => (
              <React.Fragment key={a.id}>
                <span>/</span>
                <Link to={`/category/${a.id}`}>{a.name}</Link>
              </React.Fragment>
            ))}
            <span>/</span>
            <span className="breadcrumb-current">{category.name}</span>
          </nav>

          <section
            className={`category-banner ${image ? "has-image" : ""}`}
            style={image ? { backgroundImage: `url("${image}")` } : undefined}
          >
            {ancestors.length ? (
              <Link to={`/category/${ancestors[ancestors.length - 1].id}`} className="banner-back">
                <IconChevronLeft /> {ancestors[ancestors.length - 1].name}
              </Link>
            ) : (
              <Link to="/home" className="banner-back">
                <IconChevronLeft /> Home
              </Link>
            )}
            <div className="category-banner-label">
              {!image ? <span className="category-icon">{initials(category.name)}</span> : null}
              <h1>{category.name}</h1>
            </div>
          </section>

          {error ? <div className="error-message home-error">{error}</div> : null}

          {children.length ? (
            <section className="home-section">
              <h2>Browse subcategories</h2>
              <div className="category-grid">
                {children.map((c) => {
                  const childImage = c.settings?.imageUrl || c.settings?.pictureUrl || "";
                  return (
                    <Link
                      to={`/category/${c.id}`}
                      key={c.id}
                      className={`category-card ${childImage ? "has-image" : ""}`}
                      style={childImage ? { backgroundImage: `url("${childImage}")` } : undefined}
                    >
                      <div className="category-label">
                        {!childImage ? <span className="category-icon">{initials(c.name)}</span> : null}
                        <span className="category-name">{c.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="home-section">
            <h2>Service providers</h2>
            {providers.length ? (
              <div className="provider-grid">
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} categoryName={category.name} />
                ))}
              </div>
            ) : (
              <p className="home-empty">No providers in {category.name} yet.</p>
            )}
          </section>

          <section className="home-section">
            <h2>Products &amp; services</h2>
            {listings.length ? (
              <div className="listing-grid">
                {listings.map((item) => (
                  <Link key={item.id} to={`/provider/${item.providerId}`} className="listing-card">
                    <div
                      className="listing-cover"
                      style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}
                    >
                      {!item.media?.imageUrl ? <IconBox /> : null}
                    </div>
                    <div className="listing-body">
                      <h3>{item.name}</h3>
                      {item.provider?.businessName ? <p className="provider-meta">{item.provider.businessName}</p> : null}
                      {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="home-empty">No products or services in {category.name} yet.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
