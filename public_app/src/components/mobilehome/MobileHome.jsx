import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../../lib/api";
import { mapCategoryDto } from "../../lib/shopMappers";
import { loginPath } from "../../lib/authRedirect";
import { Skel } from "../Skeleton";
import LazyImg from "../LazyImg";
import { IconBell, IconBusTicket, IconFind, IconMenuLines, IconRideCar, IconServicesWrench, IconShopBag, IconArrowUpRight, IconStarFilled } from "./HomeIcons";
import { IconClose } from "../icons";

const TILES = [
  { key: "shop", label: "Go shopping", to: "/shop", Icon: IconShopBag, tone: "orange" },
  { key: "services", label: "Services", to: "/services", Icon: IconServicesWrench, tone: "navy" },
  { key: "bus", label: "Bus ticket", to: "/bus", Icon: IconBusTicket, tone: "orange" },
  { key: "ride", label: "Get a ride", to: "/ride", Icon: IconRideCar, tone: "navy" }
];

const initial = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

// A tall category card: photo (or a tinted fallback), name at the bottom and a small arrow.
export function TallCard({ to, name, image, caption = "Explore", tone = 0 }) {
  return (
    <Link to={to} className={`mh-tall mh-tone-${tone % 4}`}>
      {image ? <LazyImg src={image} alt="" loading="lazy" /> : <span className="mh-tall-mark">{initial(name)}</span>}
      <span className="mh-tall-shade" aria-hidden="true" />
      <span className="mh-tall-go" aria-hidden="true"><IconArrowUpRight /></span>
      <span className="mh-tall-text">
        <strong>{name}</strong>
        <small>{caption}</small>
      </span>
    </Link>
  );
}

function SectionHead({ title, to, label = "See all" }) {
  return (
    <div className="mh-head">
      <h2>{title}</h2>
      {to ? <Link to={to}>{label}</Link> : null}
    </div>
  );
}

export default function MobileHome({ session, onLogout }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const [shopCats, setShopCats] = useState(null);
  const [serviceCats, setServiceCats] = useState(null);
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    let active = true;
    request("/product-categories/roots?limit=12")
      .then((r) => active && setShopCats((r?.items || []).map(mapCategoryDto)))
      .catch(() => active && setShopCats([]));
    request("/categories")
      .then((r) => active && setServiceCats((r?.items || r || []).map(mapCategoryDto)))
      .catch(() => active && setServiceCats([]));
    request("/providers?sort=top-rated&limit=8")
      .then((r) => active && setProviders(r?.items || r || []))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);

  // Two columns, with the second dropped a little, so the long cards read as a staggered grid.
  const columns = useMemo(() => {
    const left = [];
    const right = [];
    (serviceCats || []).forEach((c, i) => (i % 2 ? right : left).push({ c, i }));
    return [left, right];
  }, [serviceCats]);

  const user = session?.user;
  const isProvider = Boolean(session?.provider);
  const submit = (event) => {
    event.preventDefault();
    const text = q.trim();
    navigate(text ? `/search?q=${encodeURIComponent(text)}` : "/search");
  };

  return (
    <div className="mh">
      <header className="mh-bar">
        <button type="button" className="mh-round" onClick={() => setMenuOpen(true)} aria-label="Open menu"><IconMenuLines /></button>
        <div className="mh-bar-right">
          <Link to={session ? "/orders" : loginPath({ pathname: "/home", search: "", hash: "" })} className="mh-round mh-bell" aria-label="My orders and updates">
            <IconBell />
            {session ? <i aria-hidden="true" /> : null}
          </Link>
          {session ? (
            <Link to={isProvider ? "/profile" : "/orders"} className="mh-avatar" aria-label="Your account">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initial(user?.name)}</span>}
            </Link>
          ) : (
            <Link to="/login?next=%2Fhome" className="mh-signin">Sign in</Link>
          )}
        </div>
      </header>

      <h1 className="mh-title">
        <b>What</b>
        <span>do you need today?</span>
      </h1>

      <form className="mh-search" onSubmit={submit} role="search">
        <IconFind />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What would you like to find?" aria-label="Search Gabla" enterKeyHint="search" />
      </form>

      <nav className="mh-tiles" aria-label="Quick actions">
        {TILES.map(({ key, label, to, Icon, tone }) => (
          <Link key={key} to={to} className={`mh-tile mh-tile-${tone}`}>
            <span className="mh-tile-icon"><Icon /></span>
            <span className="mh-tile-label">{label}</span>
          </Link>
        ))}
      </nav>

      <SectionHead title="Shop by category" to="/shop/categories" />
      <div className="mh-rail">
        {shopCats === null
          ? Array.from({ length: 3 }).map((_, i) => <Skel key={i} w={168} h={228} r={26} style={{ flex: "none" }} />)
          : shopCats.length
            ? shopCats.map((c, i) => <TallCard key={c.id} to={`/shop/${c.id}`} name={c.name} image={c.image} caption="Shop now" tone={i} />)
            : <p className="mh-empty">Shop categories will show here.</p>}
      </div>

      <SectionHead title="Service categories" to="/services" />
      {serviceCats === null ? (
        <div className="mh-cols"><div className="mh-col"><Skel h={250} r={26} /><Skel h={250} r={26} /></div><div className="mh-col mh-col-drop"><Skel h={250} r={26} /><Skel h={250} r={26} /></div></div>
      ) : serviceCats.length ? (
        <div className="mh-cols">
          {columns.map((col, ci) => (
            <div key={ci} className={`mh-col ${ci ? "mh-col-drop" : ""}`}>
              {col.map(({ c, i }) => <TallCard key={c.id} to={`/category/${c.id}`} name={c.name} image={c.image} caption="Find a pro" tone={i + 1} />)}
            </div>
          ))}
        </div>
      ) : (
        <p className="mh-empty">Service categories will show here.</p>
      )}

      {providers === null || providers.length ? (
        <>
          <SectionHead title="Recommended providers" to="/services" />
          <div className="mh-rail">
            {providers === null
              ? Array.from({ length: 3 }).map((_, i) => <Skel key={i} w={220} h={176} r={24} style={{ flex: "none" }} />)
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

      <div className="mh-end" />

      {menuOpen ? (
        <div className="mh-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mh-menu-scrim" onClick={() => setMenuOpen(false)} />
          <aside>
            <div className="mh-menu-top">
              <span className="mh-brand"><b>G</b> Gabla</span>
              <button type="button" className="mh-round" onClick={() => setMenuOpen(false)} aria-label="Close menu"><IconClose /></button>
            </div>
            <nav onClick={() => setMenuOpen(false)}>
              <Link to="/shop">Go shopping</Link>
              <Link to="/services">Services</Link>
              <Link to="/bus">Bus tickets</Link>
              <Link to="/ride">Get a ride</Link>
              {session ? <Link to="/orders">My orders</Link> : null}
              {session ? <Link to="/bus/tickets">My bus tickets</Link> : null}
              {isProvider ? <Link to="/profile">My business profile</Link> : null}
              <Link to="/cart">Cart</Link>
            </nav>
            {session ? (
              <button type="button" className="mh-menu-out" onClick={onLogout}>Log out</button>
            ) : (
              <Link to="/login?next=%2Fhome" className="mh-menu-in">Sign in</Link>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
