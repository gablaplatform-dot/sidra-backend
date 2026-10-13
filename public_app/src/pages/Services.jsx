import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { clearSession, getSession } from "../lib/session";
import { mapCategoryDto } from "../lib/shopMappers";
import SiteHeader from "../components/SiteHeader";
import { Skel } from "../components/Skeleton";
import { TallCard } from "../components/mobilehome/MobileHome";
import { IconFind, IconStarFilled } from "../components/mobilehome/HomeIcons";

const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

// Everything on Gabla that is a service: the categories, and the best-rated providers.
export default function Services() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const [categories, setCategories] = useState(null);
  const [providers, setProviders] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Services | Gabla";
    let active = true;
    request("/categories")
      .then((r) => active && setCategories((r?.items || r || []).map(mapCategoryDto)))
      .catch(() => active && setCategories([]));
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
          <b>Services</b>
          <span>find a trusted pro near you</span>
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plumbers, tailors, mechanics…" aria-label="Search services" enterKeyHint="search" />
        </form>

        <div className="mh-head"><h2>Categories</h2></div>
        {categories === null ? (
          <div className="mh-cols"><div className="mh-col"><Skel h={250} r={26} /><Skel h={250} r={26} /></div><div className="mh-col mh-col-drop"><Skel h={250} r={26} /><Skel h={250} r={26} /></div></div>
        ) : categories.length ? (
          <div className="mh-cols">
            {columns.map((col, ci) => (
              <div key={ci} className={`mh-col ${ci ? "mh-col-drop" : ""}`}>
                {col.map(({ c, i }) => <TallCard key={c.id} to={`/category/${c.id}`} name={c.name} image={c.image} caption="Find a pro" tone={i + 1} />)}
              </div>
            ))}
          </div>
        ) : (
          <p className="mh-empty">No service categories yet.</p>
        )}

        {providers === null || providers.length ? (
          <>
            <div className="mh-head"><h2>Top-rated providers</h2></div>
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
                        <IconStarFilled /> {p.ratingCount ? `${Number(p.ratingAvg).toFixed(1)} (${p.ratingCount})` : "New"}
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
