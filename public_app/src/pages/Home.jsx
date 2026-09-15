import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { clearSession, getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import SiteHeader from "../components/SiteHeader";
import ProviderCard from "../components/ProviderCard";
import { IconArrowRight, IconBike, IconBox, IconCar, IconCart, IconChat, IconClockIcon, IconPin, IconSearch, IconShield, IconStar, IconStore, IconWrench } from "../components/icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const SEARCH_TABS = ["Nearby", "Top rated", "New", "Featured"];
const CATEGORY_SPIN_MS = 3500;

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const [activeTab, setActiveTab] = useState("Featured");
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      request("/categories"),
      request("/providers?sort=top-rated&limit=8")
    ])
      .then(([categoryResult, providerResult]) => {
        if (!active) return;
        setCategories(categoryResult?.items || categoryResult || []);
        setProviders(providerResult?.items || providerResult || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load Gabla right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // The header's nav links point at /home#section so they work from any page, not just when
  // already on Home — react-router doesn't auto-scroll to a hash on client-side navigation the
  // way a full page load would, so this does it manually whenever the hash changes.
  useEffect(() => {
    const hash = location.hash;
    if (!hash || hash === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  useEffect(() => {
    if (session || !GOOGLE_CLIENT_ID) return;
    let active = true;
    const handleCredential = async (response) => {
      try {
        const result = await request("/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: response.credential })
        });
        setSession(result);
        if (active) setSessionState(result);
      } catch {
        // Silently ignore - user can still use the explicit sign-in button.
      }
    };
    loadGoogleIdentity()
      .then((google) => {
        if (!active) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.accounts.id.prompt();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (categories.length < 2) return;
    const timer = setInterval(() => {
      setActiveCategoryIndex((current) => (current + 1) % categories.length);
    }, CATEGORY_SPIN_MS);
    return () => clearInterval(timer);
  }, [categories.length]);

  const activeCategory = categories[activeCategoryIndex] || null;

  const categoryName = (categoryId) => categories.find((c) => c.id === categoryId)?.name || "Service provider";

  const logout = () => {
    clearSession();
    setSessionState(null);
  };

  return (
    <main className="home-shell">
      <SiteHeader session={session} onLogout={logout} />

      <section className="hero-card">
        <div className="hero-blob hero-blob-a" />
        <div className="hero-blob hero-blob-b" />

        <div className="hero-copy">
          <h1>Find, book and get it done.</h1>
          <p>Discover trusted, reviewed service providers near you &mdash; from repairs to events, all in one place.</p>

          <form
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = searchValue.trim();
              if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
            }}
          >
            <span className="hero-search-icon"><IconSearch /></span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search a service or business"
            />
            <div className="hero-search-tabs">
              {SEARCH_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`hero-tab ${activeTab === tab ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </form>

          <div className="hero-trust">
            <span><IconShield /> {providers.length || "500"}+ verified providers</span>
            <span className="hero-trust-dot">&middot;</span>
            <span><IconStar /> 4.8 average rating</span>
            <span className="hero-trust-dot">&middot;</span>
            <span><IconPin /> {categories.length || "12"}+ categories</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-circle-stage">
            <div className="hero-circle-spin" key={`spin-${activeCategoryIndex}`}>
              <div className="hero-circle" />
              <span className="hero-badge hero-badge-1"><IconStar /></span>
              <span className="hero-badge hero-badge-2"><IconChat /></span>
              <span className="hero-badge hero-badge-3"><IconWrench /></span>
              <span className="hero-badge hero-badge-4"><IconClockIcon /></span>
              <span className="hero-badge hero-badge-5"><IconPin /></span>
            </div>
            <div className="hero-circle-center" key={`center-${activeCategory?.id || "default"}`}>
              {activeCategory ? (
                <>
                  <span className="hero-circle-letter">{initials(activeCategory.name)}</span>
                  <span className="hero-circle-name">{activeCategory.name}</span>
                </>
              ) : (
                <IconStore className="hero-circle-icon" />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ride-promo">
        <div className="ride-promo-copy">
          <span className="ride-promo-eyebrow">Gabla Ride</span>
          <h2>Let&apos;s get you a ride.</h2>
          <p>Boda or car — request a nearby driver and get an upfront fare in seconds.</p>
          <Link to="/ride" className="cta-button ride-promo-cta">
            Get a ride <IconArrowRight />
          </Link>
        </div>
        <div className="ride-promo-icons">
          <span className="ride-promo-icon ride-promo-icon-a"><IconBike /></span>
          <span className="ride-promo-icon ride-promo-icon-b"><IconCar /></span>
        </div>
      </section>

      <section className="ride-promo shop-promo">
        <div className="ride-promo-copy">
          <span className="ride-promo-eyebrow">Gabla Shop</span>
          <h2>Shop now.</h2>
          <p>Browse products from every seller on Gabla, organized by category — all in one storefront.</p>
          <Link to="/shop" className="cta-button ride-promo-cta">
            Shop now <IconArrowRight />
          </Link>
        </div>
        <div className="ride-promo-icons">
          <span className="ride-promo-icon ride-promo-icon-a"><IconCart /></span>
          <span className="ride-promo-icon ride-promo-icon-b"><IconBox /></span>
        </div>
      </section>

      {error ? <div className="error-message home-error">{error}</div> : null}

      <section id="categories" className="home-section">
        <h2>Browse by category</h2>
        {!loading && !categories.length ? <p className="home-empty">No categories yet.</p> : null}
        <div className="category-grid">
          {categories.map((c) => {
            const image = c.settings?.imageUrl || c.settings?.pictureUrl || "";
            return (
              <Link
                to={`/category/${c.id}`}
                key={c.id}
                className={`category-card ${image ? "has-image" : ""}`}
                style={image ? { backgroundImage: `url("${image}")` } : undefined}
              >
                <div className="category-label">
                  {!image ? <span className="category-icon">{initials(c.name)}</span> : null}
                  <span className="category-name">{c.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="providers" className="home-section">
        <h2>Featured providers</h2>
        {loading ? (
          <p className="home-empty">Loading providers…</p>
        ) : providers.length ? (
          <div className="provider-grid">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} categoryName={categoryName(p.categoryId)} />
            ))}
          </div>
        ) : (
          <p className="home-empty">No featured providers yet.</p>
        )}
      </section>
    </main>
  );
}
