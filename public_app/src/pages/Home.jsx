import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { clearSession, getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import SiteHeader from "../components/SiteHeader";
import ProviderCard from "../components/ProviderCard";
import { IconArrowRight, IconBike, IconBox, IconCar, IconCart, IconChat, IconClockIcon, IconPin, IconSearch, IconShield, IconSparkles, IconStar, IconStore, IconTruck, IconWrench } from "../components/icons";
import { mapCategoryDto } from "../lib/shopMappers";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const SEARCH_TABS = ["Nearby", "Top rated", "New", "Featured"];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const [activeTab, setActiveTab] = useState("Featured");
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      request("/categories"),
      request("/providers?sort=top-rated&limit=8")
    ])
      .then(([categoryResult, providerResult]) => {
        if (!active) return;
        const rawCats = categoryResult?.items || categoryResult || [];
        setCategories(rawCats.map(mapCategoryDto));
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

  const categoryName = (categoryId) => categories.find((c) => c.id === categoryId)?.name || "Service provider";

  const logout = () => {
    clearSession();
    setSessionState(null);
  };

  const heroFeatureCategories = useMemo(() => categories.slice(0, 4), [categories]);

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      {/* ============ HERO ============ */}
      <section className="home-hero">
        <div className="home-hero-blob home-hero-blob-1" />
        <div className="home-hero-blob home-hero-blob-2" />

        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-eyebrow">
              <IconSparkles /> Everything Uganda, one app
            </span>
            <h1 className="home-hero-title">
              Shop trendy finds. Book trusted pros.{" "}
              <span className="home-gradient-text">Ride across town.</span>
            </h1>
            <p className="home-hero-subtitle">
              Gabla connects you to fashion, electronics, verified service providers and nearby drivers &mdash; all in a single, beautifully designed experience.
            </p>

            <form
              className="home-hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = searchValue.trim();
                if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
              }}
            >
              <span className="home-hero-search-icon"><IconSearch /></span>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search fashion, services, drivers…"
              />
              <div className="home-hero-search-tabs">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`home-hero-tab ${activeTab === tab ? "is-active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </form>

            <div className="home-hero-actions">
              <Link to="/shop" className="home-cta home-cta-primary">
                Shop now <IconArrowRight />
              </Link>
              <Link to="/ride" className="home-cta home-cta-secondary">
                Get a ride <IconCar />
              </Link>
            </div>

            <div className="home-hero-trust">
              <div className="home-hero-avatars">
                <span className="home-avatar home-avatar-1" />
                <span className="home-avatar home-avatar-2" />
                <span className="home-avatar home-avatar-3" />
                <span className="home-avatar home-avatar-4" />
              </div>
              <p><strong>500+</strong> sellers &amp; providers · <strong>UGX</strong> payments · <strong>4.8★</strong> avg rating</p>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-hero-oval" />
            <div className="home-hero-stage">
              <div className="home-hero-card home-hero-card-tl home-animate-float">
                <span className="home-hero-card-icon"><IconCart /></span>
                <div>
                  <strong>New arrivals</strong>
                  <span>Trending fashion</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-tr home-animate-float home-animate-delay-1">
                <span className="home-hero-card-icon home-hero-card-icon-alt"><IconBike /></span>
                <div>
                  <strong>Ride ready</strong>
                  <span>Boda &amp; car nearby</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-ml home-animate-float home-animate-delay-2">
                <span className="home-hero-card-icon home-hero-card-icon-teal"><IconWrench /></span>
                <div>
                  <strong>Top pros</strong>
                  <span>Verified &amp; reviewed</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-br home-animate-float home-animate-delay-3">
                <span className="home-hero-card-icon home-hero-card-icon-violet"><IconTruck /></span>
                <div>
                  <strong>Fast delivery</strong>
                  <span>Countrywide</span>
                </div>
              </div>
              <div className="home-hero-center">
                <span className="home-hero-center-mark">G</span>
              </div>
              {heroFeatureCategories.length ? (
                <>
                  {heroFeatureCategories[0]?.image ? (
                    <img className="home-hero-ring-img home-hero-ring-img-1" src={heroFeatureCategories[0].image} alt={heroFeatureCategories[0].name} />
                  ) : null}
                  {heroFeatureCategories[1]?.image ? (
                    <img className="home-hero-ring-img home-hero-ring-img-2" src={heroFeatureCategories[1].image} alt={heroFeatureCategories[1].name} />
                  ) : null}
                  {heroFeatureCategories[2]?.image ? (
                    <img className="home-hero-ring-img home-hero-ring-img-3" src={heroFeatureCategories[2].image} alt={heroFeatureCategories[2].name} />
                  ) : null}
                  {heroFeatureCategories[3]?.image ? (
                    <img className="home-hero-ring-img home-hero-ring-img-4" src={heroFeatureCategories[3].image} alt={heroFeatureCategories[3].name} />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST BAR ============ */}
      <section className="home-trustbar">
        <div className="home-trustbar-inner">
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconShield /></span>
            <div className="home-trust-copy">
              <strong>Verified providers</strong>
              <span>Background-checked &amp; reviewed</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconPin /></span>
            <div className="home-trust-copy">
              <strong>Local &amp; nearby</strong>
              <span>Find services around you</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconStar /></span>
            <div className="home-trust-copy">
              <strong>Rated 4.8/5</strong>
              <span>From 10,000+ happy customers</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconClockIcon /></span>
            <div className="home-trust-copy">
              <strong>24/7 support</strong>
              <span>Chat us anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROMO CARDS DUO ============ */}
      <section className="home-section">
        <div className="home-promo-duo">
          <Link to="/ride" className="home-promo home-promo-ride">
            <div>
              <span className="home-promo-eyebrow">Gabla Ride</span>
              <h2>Let&apos;s get you a ride.</h2>
              <p>Boda or car &mdash; request a nearby driver and get an upfront fare in seconds.</p>
              <span className="home-promo-cta">Book a ride <IconArrowRight /></span>
            </div>
            <div className="home-promo-icons">
              <span className="home-promo-icon home-promo-icon-a"><IconBike /></span>
              <span className="home-promo-icon home-promo-icon-b"><IconCar /></span>
            </div>
          </Link>

          <Link to="/shop" className="home-promo home-promo-shop">
            <div>
              <span className="home-promo-eyebrow">Gabla Shop</span>
              <h2>Shop now, live collection.</h2>
              <p>Browse fashion, electronics &amp; lifestyle from every seller on Gabla, all in one storefront.</p>
              <span className="home-promo-cta">Explore shop <IconArrowRight /></span>
            </div>
            <div className="home-promo-icons">
              <span className="home-promo-icon home-promo-icon-a"><IconCart /></span>
              <span className="home-promo-icon home-promo-icon-b"><IconBox /></span>
            </div>
          </Link>
        </div>
      </section>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {/* ============ CATEGORY CARDS ============ */}
      <section id="categories" className="home-section">
        <div className="home-section-header">
          <div>
            <h2 className="home-section-title">Browse by category</h2>
            <p className="home-section-subtitle">Tap into what you love, curated for you.</p>
          </div>
        </div>

        {!loading && !categories.length ? <p className="home-empty">No categories yet.</p> : null}
        <div className="home-category-grid">
          {categories.map((c, idx) => (
            <Link
              to={`/category/${c.id}`}
              key={c.id}
              className="home-category-card home-animate-reveal"
              style={{ animationDelay: `${50 + idx * 60}ms` }}
            >
              <div className={`home-category-img ${c.image ? "" : "home-category-img-fallback"}`}>
                {c.image ? (
                  <img src={c.image} alt={c.name} loading="lazy" />
                ) : (
                  <span className="home-category-fallback-mark">{initials(c.name)}</span>
                )}
                <div className="home-category-overlay" />
                <span className="home-category-chip">{Math.max(40, 18 + ((idx + 1) * 7))}+ providers</span>
              </div>
              <div className="home-category-body">
                <span className="home-category-initials">{initials(c.name)}</span>
                <div>
                  <strong className="home-category-name">{c.name}</strong>
                  <span className="home-category-arrow"><IconArrowRight /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ FEATURED PROVIDERS ============ */}
      <section id="providers" className="home-section home-section-last">
        <div className="home-section-header">
          <div>
            <h2 className="home-section-title">Featured providers</h2>
            <p className="home-section-subtitle">Handpicked professionals near you.</p>
          </div>
          <Link to="/home#providers" className="home-view-all">
            Book a pro <IconArrowRight />
          </Link>
        </div>

        {loading ? (
          <p className="home-empty">Loading providers…</p>
        ) : providers.length ? (
          <div className="home-provider-grid">
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
