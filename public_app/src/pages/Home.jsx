import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { clearSession, getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import SiteHeader from "../components/SiteHeader";
import ProviderCard from "../components/ProviderCard";
import { IconArrowRight, IconBike, IconBus, IconTicket, IconBox, IconCar, IconCart, IconChat, IconClockIcon, IconPin, IconSearch, IconShield, IconSparkles, IconStar, IconStore, IconTruck, IconWrench } from "../components/icons";
import { ProviderCardsSkeleton, Skel } from "../components/Skeleton";
import { mapCategoryDto } from "../lib/shopMappers";
import MobileHome from "../components/mobilehome/MobileHome";
import { busApi, todayEat, ugx } from "../lib/bus";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const SEARCH_TABS = ["nearby", "topRated", "new", "featured"];

function DesktopHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const [activeTab, setActiveTab] = useState("featured");
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [busPlaces, setBusPlaces] = useState({ origins: [], destinations: [] });
  const [busRoutes, setBusRoutes] = useState([]);
  const [busFrom, setBusFrom] = useState("");
  const [busTo, setBusTo] = useState("");
  const [busDate, setBusDate] = useState(() => todayEat());

  // The bus promo is a bonus section: if the bus API is unavailable the rest of Home is unaffected.
  useEffect(() => {
    let active = true;
    Promise.all([busApi.places(), busApi.popularRoutes(6)])
      .then(([places, popular]) => {
        if (!active) return;
        setBusPlaces(places || { origins: [], destinations: [] });
        setBusRoutes(popular?.items || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const searchBuses = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (busFrom) params.set("from", busFrom);
    if (busTo) params.set("to", busTo);
    params.set("date", busDate || todayEat());
    navigate(`/bus/search?${params.toString()}`);
  };

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
        if (active) setError(loadError.message || t("home.loadError"));
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

  const categoryName = (categoryId) => categories.find((c) => c.id === categoryId)?.name || t("home.providers.fallbackCategory");

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
              <IconSparkles /> {t("home.eyebrow")}
            </span>
            <h1 className="home-hero-title">
              {t("home.heroTitle1")}{" "}
              <span className="home-gradient-text">{t("home.heroTitle2")}</span>
            </h1>
            <p className="home-hero-subtitle">
              {t("home.heroSubtitle")}
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
                placeholder={t("home.searchPlaceholder")}
              />
              <div className="home-hero-search-tabs">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`home-hero-tab ${activeTab === tab ? "is-active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`home.tabs.${tab}`)}
                  </button>
                ))}
              </div>
            </form>

            <div className="home-hero-actions">
              <Link to="/shop" className="home-cta home-cta-primary">
                {t("home.shopNow")} <IconArrowRight />
              </Link>
              <Link to="/ride" className="home-cta home-cta-secondary">
                {t("home.getRide")} <IconCar />
              </Link>
            </div>

            <div className="home-hero-trust">
              <div className="home-hero-avatars">
                <span className="home-avatar home-avatar-1" />
                <span className="home-avatar home-avatar-2" />
                <span className="home-avatar home-avatar-3" />
                <span className="home-avatar home-avatar-4" />
              </div>
              <p><strong>500+</strong> {t("home.trustSellers")} · <strong>UGX</strong> {t("home.trustPayments")} · <strong>4.8★</strong> {t("home.trustRating")}</p>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-hero-oval" />
            <div className="home-hero-stage">
              <div className="home-hero-card home-hero-card-tl home-animate-float">
                <span className="home-hero-card-icon"><IconCart /></span>
                <div>
                  <strong>{t("home.cards.newArrivalsTitle")}</strong>
                  <span>{t("home.cards.newArrivalsSub")}</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-tr home-animate-float home-animate-delay-1">
                <span className="home-hero-card-icon home-hero-card-icon-alt"><IconBike /></span>
                <div>
                  <strong>{t("home.cards.rideReadyTitle")}</strong>
                  <span>{t("home.cards.rideReadySub")}</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-ml home-animate-float home-animate-delay-2">
                <span className="home-hero-card-icon home-hero-card-icon-teal"><IconWrench /></span>
                <div>
                  <strong>{t("home.cards.topProsTitle")}</strong>
                  <span>{t("home.cards.topProsSub")}</span>
                </div>
              </div>
              <div className="home-hero-card home-hero-card-br home-animate-float home-animate-delay-3">
                <span className="home-hero-card-icon home-hero-card-icon-violet"><IconTruck /></span>
                <div>
                  <strong>{t("home.cards.fastDeliveryTitle")}</strong>
                  <span>{t("home.cards.fastDeliverySub")}</span>
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
              <strong>{t("home.trustbar.verifiedTitle")}</strong>
              <span>{t("home.trustbar.verifiedSub")}</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconPin /></span>
            <div className="home-trust-copy">
              <strong>{t("home.trustbar.localTitle")}</strong>
              <span>{t("home.trustbar.localSub")}</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconStar /></span>
            <div className="home-trust-copy">
              <strong>{t("home.trustbar.ratedTitle")}</strong>
              <span>{t("home.trustbar.ratedSub")}</span>
            </div>
          </div>
          <div className="home-trust-item">
            <span className="home-trust-icon"><IconClockIcon /></span>
            <div className="home-trust-copy">
              <strong>{t("home.trustbar.supportTitle")}</strong>
              <span>{t("home.trustbar.supportSub")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROMO CARDS DUO ============ */}
      <section className="home-section">
        <div className="home-promo-duo">
          <Link to="/ride" className="home-promo home-promo-ride">
            <div>
              <span className="home-promo-eyebrow">{t("home.promo.rideEyebrow")}</span>
              <h2>{t("home.promo.rideTitle")}</h2>
              <p>{t("home.promo.rideText")}</p>
              <span className="home-promo-cta">{t("home.promo.rideCta")} <IconArrowRight /></span>
            </div>
            <div className="home-promo-icons">
              <span className="home-promo-icon home-promo-icon-a"><IconBike /></span>
              <span className="home-promo-icon home-promo-icon-b"><IconCar /></span>
            </div>
          </Link>

          <Link to="/shop" className="home-promo home-promo-shop">
            <div>
              <span className="home-promo-eyebrow">{t("home.promo.shopEyebrow")}</span>
              <h2>{t("home.promo.shopTitle")}</h2>
              <p>{t("home.promo.shopText")}</p>
              <span className="home-promo-cta">{t("home.promo.shopCta")} <IconArrowRight /></span>
            </div>
            <div className="home-promo-icons">
              <span className="home-promo-icon home-promo-icon-a"><IconCart /></span>
              <span className="home-promo-icon home-promo-icon-b"><IconBox /></span>
            </div>
          </Link>
        </div>
      </section>

      {/* ============ BUS TICKETS ============ */}
      <section className="home-section">
        <div className="bus-promo">
          <div>
            <span className="bus-promo-eyebrow"><IconBus width={16} height={16} /> {t("home.bus.eyebrow")}</span>
            <h2>{t("home.bus.title")}</h2>
            <p>{t("home.bus.text")}</p>
            {busRoutes.length ? (
              <div className="bus-promo-routes">
                {busRoutes.map((r) => (
                  <Link key={`${r.from}-${r.to}`} to={`/bus/search?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&date=${todayEat()}`}>
                    {r.from} &rarr; {r.to}{r.minPrice ? ` · ${ugx(r.minPrice)}` : ""}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <form className="bus-promo-form" onSubmit={searchBuses}>
            <div className="bus-promo-form-row">
              <select value={busFrom} onChange={(e) => setBusFrom(e.target.value)} aria-label={t("home.bus.travellingFrom")}>
                <option value="">{t("home.bus.fromAny")}</option>
                {busPlaces.origins.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={busTo} onChange={(e) => setBusTo(e.target.value)} aria-label={t("home.bus.travellingTo")}>
                <option value="">{t("home.bus.toAny")}</option>
                {busPlaces.destinations.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <input type="date" value={busDate} min={todayEat()} onChange={(e) => setBusDate(e.target.value)} aria-label={t("home.bus.travelDate")} />
            <button type="submit" className="bus-promo-btn"><IconBus width={18} height={18} /> {t("home.bus.findBuses")}</button>
            <Link to="/bus/tickets" className="bus-link" style={{ textAlign: "center" }}><IconTicket width={14} height={14} /> {t("home.bus.myTickets")}</Link>
          </form>
        </div>
      </section>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {/* ============ CATEGORY CARDS ============ */}
      <section id="categories" className="home-section">
        <div className="home-section-header">
          <div>
            <h2 className="home-section-title">{t("home.categories.title")}</h2>
            <p className="home-section-subtitle">{t("home.categories.subtitle")}</p>
          </div>
        </div>

        {!loading && !categories.length ? <p className="home-empty">{t("home.categories.empty")}</p> : null}
        {loading ? (
          <div className="home-category-grid" role="status" aria-busy="true">
            <span className="sr-only">{t("home.categories.loading")}</span>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skel key={i} h={230} w="100%" r={18} />
            ))}
          </div>
        ) : null}
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
                <span className="home-category-chip">{t("home.categories.providersChip", { count: Math.max(40, 18 + ((idx + 1) * 7)) })}</span>
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
            <h2 className="home-section-title">{t("home.providers.title")}</h2>
            <p className="home-section-subtitle">{t("home.providers.subtitle")}</p>
          </div>
          <Link to="/home#providers" className="home-view-all">
            {t("home.providers.cta")} <IconArrowRight />
          </Link>
        </div>

        {loading ? (
          <ProviderCardsSkeleton count={4} />
        ) : providers.length ? (
          <div className="home-provider-grid">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} categoryName={categoryName(p.categoryId)} />
            ))}
          </div>
        ) : (
          <p className="home-empty">{t("home.providers.empty")}</p>
        )}
      </section>
    </main>
  );
}


// Phones get an app-style home (quick actions + category cards); larger screens keep the full landing page.
const PHONE_QUERY = "(max-width: 760px)";

export default function Home() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches);
  const [session, setSessionState] = useState(() => getSession());

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (!phone) return <DesktopHome />;
  return (
    <MobileHome
      session={session}
      onLogout={() => {
        clearSession();
        setSessionState(null);
      }}
    />
  );
}
