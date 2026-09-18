import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { getSession, clearSession } from "../lib/session";
import SiteHeader from "../components/SiteHeader";
import { IconBox, IconSearch, IconStar } from "../components/icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function SearchResults() {
  const navigate = useNavigate();
  const [session] = useState(() => getSession());
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(query);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setInputValue(query);
    if (!query) {
      setResult(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request(`/search?q=${encodeURIComponent(query)}`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Search failed. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const logout = () => {
    clearSession();
    window.location.reload();
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (!value.trim()) navigate("/home");
  };

  const hasResults = Boolean(
    result && (result.categories.length || result.providers.length || result.listings.length)
  );

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      <section className="search-results-header">
        <form className="hero-search search-results-bar" onSubmit={submitSearch}>
          <span className="hero-search-icon"><IconSearch /></span>
          <input
            type="text"
            autoFocus
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search a service or business"
          />
          <button type="submit" className="cta-button">Search</button>
        </form>
      </section>

      {!query ? (
        <p className="home-empty">Search for a category, service or business — e.g. &ldquo;wash my car&rdquo; or &ldquo;wedding cake&rdquo;.</p>
      ) : loading ? (
        <p className="home-empty page-loading">Searching…</p>
      ) : error ? (
        <div className="error-message home-error">{error}</div>
      ) : !hasResults ? (
        <div className="page-empty-state">
          <p>No matches for &ldquo;{query}&rdquo;. Try a different word or check your spelling.</p>
        </div>
      ) : (
        <>
          {result.categories.length ? (
            <section className="home-section">
              <h2>Categories</h2>
              <div className="category-grid">
                {result.categories.map((c) => (
                  <Link to={`/category/${c.id}`} key={c.id} className="category-card">
                    <div className="category-label">
                      <span className="category-icon">{initials(c.name)}</span>
                      <span className="category-name">{c.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {result.providers.length ? (
            <section className="home-section">
              <h2>Service providers</h2>
              <div className="provider-grid">
                {result.providers.map((p) => (
                  <Link to={`/provider/${p.id}`} key={p.id} className="provider-card">
                    <div className="provider-cover" style={p.imageUrl ? { backgroundImage: `url("${p.imageUrl}")` } : undefined}>
                      {!p.imageUrl ? <span>{initials(p.businessName)}</span> : null}
                    </div>
                    <div className="provider-body">
                      <h3>{p.businessName}</h3>
                      <div className="provider-rating"><IconStar /> {p.ratingAvg ? p.ratingAvg.toFixed(1) : "New"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {result.listings.length ? (
            <section className="home-section">
              <h2>Products &amp; services</h2>
              <div className="listing-grid">
                {result.listings.map((item) => (
                  <Link to={`/provider/${item.providerId}`} key={item.id} className="listing-card">
                    <div className="listing-cover" style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : undefined}>
                      {!item.imageUrl ? <IconBox /> : null}
                    </div>
                    <div className="listing-body">
                      <h3>{item.name}</h3>
                      {item.providerName ? <p className="provider-meta">{item.providerName}</p> : null}
                      {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
