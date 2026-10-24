import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { clearSession, getSession, setSession } from "../lib/session";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from "../lib/google";
import SiteHeader from "../components/SiteHeader";
import ProviderCard from "../components/ProviderCard";
import { IconArrowRight } from "../components/icons";
import { ProviderCardsSkeleton, Skel } from "../components/Skeleton";
import { mapCategoryDto, mapProductDto } from "../lib/shopMappers";
import MobileHome from "../components/mobilehome/MobileHome";
import OrbitStage from "../components/home/OrbitStage";
import Reveal from "../components/home/Reveal";
import { busApi } from "../lib/bus";

const FOOTER_LINKS = [
  { key: "shop", href: "/shop" },
  { key: "ride", href: "/ride" },
  { key: "busTickets", href: "/bus" },
  { key: "categories", href: "/home#categories" },
  { key: "providers", href: "/home#providers" }
];

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

function DesktopHome() {
  const { t } = useTranslation();
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());
  const [categories, setCategories] = useState([]);
  const [orbitCategories, setOrbitCategories] = useState([]);
  const [shopCards, setShopCards] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [busRoutes, setBusRoutes] = useState([]);

  // The bus chapter is a bonus: if the bus API is unavailable the rest of Home is unaffected.
  useEffect(() => {
    let active = true;
    busApi
      .popularRoutes(6)
      .then((popular) => {
        if (active) setBusRoutes(popular?.items || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // The shop chapter of the hero: newest products, or the shop's top categories until there are products.
  useEffect(() => {
    let active = true;
    const safe = (path) => request(path).catch(() => null);
    Promise.all([safe("/listings/new-arrivals?limit=4&type=product"), safe("/product-categories/roots?limit=4")]).then(([arrivals, roots]) => {
      if (!active) return;
      const products = Array.isArray(arrivals?.items) ? arrivals.items.map((p) => mapProductDto(p)) : [];
      if (products.length) {
        setShopCards(products.slice(0, 4).map((p) => ({ kind: "product", id: p.id, to: `/shop/product/${p.id}`, name: p.name, price: p.price, image: p.image })));
        return;
      }
      const cats = Array.isArray(roots?.items) ? roots.items.map(mapCategoryDto) : [];
      setShopCards(cats.slice(0, 4).map((c) => ({ kind: "category", id: c.id, to: `/shop/${c.id}`, name: c.name, image: c.image })));
    });
    return () => {
      active = false;
    };
  }, []);



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
        // The ring wants about sixteen tiles: top-level categories first, then their subcategories to fill it.
        const flat = [...rawCats, ...rawCats.flatMap((c) => c.children || [])];
        setOrbitCategories(flat.slice(0, 16).map(mapCategoryDto));
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

  // Real providers when there are some; until then the phone shows the categories so it is never empty.
  const phoneProviders = useMemo(
    () => (providers.length ? providers : categories.slice(0, 3).map((c) => ({ id: c.id, businessName: c.name }))),
    [providers, categories]
  );

  return (
    <main className="home-shell home-themed home-landing">
      <SiteHeader session={session} onLogout={logout} />

      {/* ============ HERO STORY: categories orbit the search, fall into the bowl, which then visits Shop, Bus, Ride and Find/Unlock/Book and ends under the category cards ============ */}
      <OrbitStage categories={orbitCategories} shopCards={shopCards} busRoutes={busRoutes} phoneProviders={phoneProviders} searchValue={searchValue} onSearchChange={setSearchValue}>
    <section className="home-section hs-categories">

      {!loading && !categories.length ? <p className="home-empty">{t("home.categories.empty")}</p> : null}
      {loading ? (
        <div className="home-category-grid" role="status" aria-busy="true">
          <span className="sr-only">{t("home.categories.loading")}</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skel key={i} h={230} w="100%" r={22} />
          ))}
        </div>
      ) : null}
      <div className="home-category-grid">
        {categories.map((c, idx) => (
          <Reveal as={Link} from="bowl" delay={(idx % 4) * 90} to={`/category/${c.id}`} key={c.id} className="home-category-card">
            <div className={`home-category-img ${c.image ? "" : "home-category-img-fallback"}`}>
              {c.image ? (
                <img src={c.image} alt="" loading="lazy" />
              ) : (
                <span className="home-category-fallback-mark">{initials(c.name)}</span>
              )}
              <div className="home-category-overlay" />
              <div className="hc-label">
                <strong className="home-category-name">{c.name}</strong>
                <span className="home-category-arrow"><IconArrowRight /></span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
      </OrbitStage>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {/* ============ FEATURED PROVIDERS ============ */}
      <section id="providers" className="home-section home-section-last hs-providers">
        <Reveal className="home-section-header">
          <div>
            <h2 className="home-section-title">{t("home.providers.title")}</h2>
            <p className="home-section-subtitle">{t("home.providers.subtitle")}</p>
          </div>
          <Link to="/home#providers" className="home-view-all">
            {t("home.providers.cta")} <IconArrowRight />
          </Link>
        </Reveal>

        {loading ? (
          <ProviderCardsSkeleton count={4} />
        ) : providers.length ? (
          <div className="home-provider-grid">
            {providers.map((p, i) => (
              <Reveal key={p.id} from="bowl" delay={(i % 4) * 90}>
                <ProviderCard provider={p} categoryName={categoryName(p.categoryId)} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="home-empty">{t("home.providers.empty")}</p>
        )}
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <Link to="/home#top" className="home-footer-brand">
            <span className="brand-mark">G</span>
            <strong>Gabla</strong>
          </Link>
          <nav className="home-footer-links">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.key} to={link.href}>{t(`nav.${link.key}`)}</Link>
            ))}
          </nav>
          <span className="home-footer-copy">&copy; {new Date().getFullYear()} Gabla</span>
        </div>
      </footer>
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
