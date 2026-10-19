import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../lib/api";
import { clearSession, getSession } from "../lib/session";
import { mapCategoryDto } from "../lib/shopMappers";
import SiteHeader from "../components/SiteHeader";
import BrowseCard from "../components/shop/browse/BrowseCard";
import { Skel } from "../components/Skeleton";
import { TallCard } from "../components/mobilehome/MobileHome";
import { IconFind, IconStarFilled } from "../components/mobilehome/HomeIcons";

const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

// Everything on Gabla that is a service: the categories, and the best-rated providers.
export default function Services() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const [categories, setCategories] = useState(null);
  const [providers, setProviders] = useState(null);
  const [bookable, setBookable] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = `${t("services.title")} | Gabla`;
    let active = true;
    request("/service-categories")
      .then((r) => active && setCategories((r?.items || r || []).map(mapCategoryDto)))
      .catch(() => active && setCategories([]));
    request("/listings?type=service&bookable=true&limit=6&sort=featured")
      .then((r) => active && setBookable(r?.items || []))
      .catch(() => active && setBookable([]));
    request("/providers?sort=top-rated&limit=12")
      .then((r) => active && setProviders(r?.items || r || []))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(() => {
    const cols = [[], []];
    (categories || []).forEach((c, i) => cols[i % 2].push({ c, i }));
    return cols;
  }, [categories]);

  return (
    <main className="home-shell home-themed">
      <SiteHeader
        session={session}
        onLogout={() => {
          clearSession();
          setSession(null);
        }}
      />
      <div className="mh sv-page">
        <h1 className="mh-title">
          <b>{t("services.title")}</b>
          <span>{t("services.tagline")}</span>
        </h1>
        <form
          className="mh-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
          }}
        >
          <IconFind />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("services.searchPlaceholder")} aria-label={t("services.searchLabel")} enterKeyHint="search" />
        </form>

        <div className="mh-head"><h2>{t("services.categories")}</h2><Link to="/services/all">{t("services.seeAllServices")}</Link></div>
        {categories === null ? (
          <div className="mh-cols"><div className="mh-col"><Skel h={250} r={26} /><Skel h={250} r={26} /></div><div className="mh-col mh-col-drop"><Skel h={250} r={26} /><Skel h={250} r={26} /></div></div>
        ) : categories.length ? (
          <div className="mh-cols">
            {columns.map((col, ci) => (
              <div key={ci} className={`mh-col ${ci ? "mh-col-drop" : ""}`}>
                {col.map(({ c, i }) => <TallCard key={c.id} to={`/services/c/${c.id}`} name={c.name} image={c.image} caption={t("services.browseServices")} tone={i + 1} />)}
              </div>
            ))}
          </div>
        ) : (
          <p className="mh-empty">{t("services.noCategories")}</p>
        )}

        {bookable && bookable.length ? (
          <>
            <div className="mh-head"><h2>{t("services.bookOnline")}</h2><Link to="/services/all?sort=featured">{t("common.seeAll")}</Link></div>
            <div className="sb-grid sv-bookable">
              {bookable.map((listing) => <BrowseCard key={listing.id} listing={listing} />)}
            </div>
          </>
        ) : null}

        {providers === null || providers.length ? (
          <>
            <div className="mh-head"><h2>{t("services.topRated")}</h2></div>
            <div className="sv-providers">
              {providers === null
                ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={176} r={24} />)
                : providers.map((p) => (
                    <Link key={p.id} to={`/provider/${p.id}`} className="mh-prov">
                      <span className="mh-prov-cover" style={p.media?.coverUrl ? { backgroundImage: `url("${p.media.coverUrl}")` } : undefined}>
                        <span className="mh-prov-avatar">{p.media?.avatarUrl ? <img src={p.media.avatarUrl} alt="" /> : initial(p.businessName)}</span>
                      </span>
                      <strong>{p.businessName}</strong>
                      <small>
                        <IconStarFilled /> {p.ratingCount ? `${Number(p.ratingAvg).toFixed(1)} (${p.ratingCount})` : t("common.new")}
                        {p.location?.city ? ` · ${p.location.city}` : ""}
                      </small>
                    </Link>
                  ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
