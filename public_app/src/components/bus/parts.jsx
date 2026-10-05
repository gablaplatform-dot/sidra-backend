import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Skel } from "../Skeleton";
import { arrivalAt, dayDiff, eatTime, hueOf, imgSize, normalizeUgPhone, ugx } from "../../lib/bus";
import { ArrowRight, BusIcon, Pin, Star, Users, amenityIcon } from "./icons";

// Stable accent per company so cover-less parks still look distinct. (Kept for older callers.)
export const coverStyle = (name, url) => ({ "--cover-hue": hueOf(name), ...(url ? { backgroundImage: `url("${url}")` } : {}) });

export const initialOf = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

export const ratingText = (avg, count) => {
  const n = Number(avg);
  if (!count || !Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(1);
};

export const asList = (value) => (Array.isArray(value) ? value.filter(Boolean).map(String) : []);

// A photo that always has something nice behind it: a tinted gradient (from the company name) shows
// while the picture loads or if it fails, and the picture fades in on top.
export function Photo({ src, name = "", alt = "", className = "", width, children, eager = false }) {
  const ref = useRef(null);
  const [state, setState] = useState(src ? "loading" : "failed");
  useEffect(() => {
    setState(src ? "loading" : "failed");
    const el = ref.current;
    if (src && el?.complete && el.naturalWidth > 0) setState("loaded");
  }, [src]);
  const url = width ? imgSize(src, width) : src;
  return (
    <span className={`bus-photo is-${state} ${className}`} style={{ "--hue": hueOf(name) }}>
      {src && state !== "failed" ? (
        <img ref={ref} src={url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onLoad={() => setState("loaded")} onError={() => setState("failed")} />
      ) : null}
      {children}
    </span>
  );
}

// Company logo as a rounded square, with a lettered fallback if there is no image (or it fails).
export function BusLogo({ name, src, className = "", size }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className={`bus-logo ${className}`} style={{ "--hue": hueOf(name), ...(size ? { "--logo": `${size}px` } : {}) }} aria-hidden="true">
      {src && !broken ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <b>{initialOf(name)}</b>}
    </span>
  );
}

export function Rating({ avg, count, className = "" }) {
  const text = ratingText(avg, count);
  if (!text) return <span className={`bus-rating is-new ${className}`}>New</span>;
  return (
    <span className={`bus-rating ${className}`} title={`${text} out of 5 from ${count} reviews`}>
      <Star size={13} /> {text} <small>({count})</small>
    </span>
  );
}

export function StatusPill({ tone = "muted", children, dot = true }) {
  return <span className={`bus-status is-${tone}`}>{dot ? <i aria-hidden="true" /> : null}{children}</span>;
}

export function AmenityChips({ list, max = 4, tone = "" }) {
  const items = asList(list);
  if (!items.length) return null;
  return (
    <div className="bus-amenities">
      {items.slice(0, max).map((a) => {
        const Icon = amenityIcon(a);
        return <span key={a} className={`bus-amenity ${tone}`}><Icon size={14} />{a}</span>;
      })}
      {items.length > max ? <span className={`bus-amenity ${tone}`}>+{items.length - max}</span> : null}
    </div>
  );
}

export function ErrorBox({ error, onRetry, title = "Couldn't load this right now" }) {
  return (
    <div className="bus-alert bus-alert-error bus-error-box" role="alert">
      <div>
        <strong>{title}</strong>
        <p>{error?.status === 429 ? "Lots of people are booking right now. Wait a few seconds and try again." : error?.message || "Please check your connection and try again."}</p>
      </div>
      {onRetry ? (
        <button type="button" className="bus-btn bus-btn-light bus-btn-sm" onClick={onRetry}>Try again</button>
      ) : null}
    </div>
  );
}

// A friendly empty state: little road illustration, a title, a line of help and an optional action.
export function EmptyState({ title, children, action, icon: Icon = BusIcon, className = "" }) {
  return (
    <div className={`bus-card bus-empty bus-empty-rich ${className}`}>
      <span className="bus-empty-art" aria-hidden="true"><Icon size={30} /></span>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action ? <div className="bus-empty-action">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- skeletons */

export function TripSkeletons({ count = 3 }) {
  return (
    <div className="bus-trip-list" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading trips…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="bus-trip bus-trip-skel" key={i} aria-hidden="true">
          <div className="bus-trip-body">
            <div className="bus-trip-co"><Skel w={48} h={48} r={14} /><span style={{ display: "grid", gap: 8 }}><Skel w={140} h={16} /><Skel w={90} h={12} /></span></div>
            <div className="bus-trip-leg"><Skel w={70} h={12} /><Skel w={110} h={28} style={{ marginTop: 8 }} /><Skel w={90} h={12} style={{ marginTop: 8 }} /></div>
            <div className="bus-trip-track-wrap"><Skel w="100%" h={10} r={999} /></div>
            <div className="bus-trip-leg"><Skel w={70} h={12} /><Skel w={110} h={28} style={{ marginTop: 8 }} /><Skel w={90} h={12} style={{ marginTop: 8 }} /></div>
            <div className="bus-trip-buy"><Skel w={120} h={26} /><Skel w={100} h={12} /><Skel w="100%" h={46} r={14} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, photo = true }) {
  return (
    <div className="bus-grid" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="bus-card bus-skel-card" key={i} aria-hidden="true">
          {photo ? <Skel w="100%" h={150} r={0} /> : null}
          <div style={{ padding: 18, display: "grid", gap: 10 }}>
            <Skel w="60%" h={20} />
            <Skel w="85%" h={14} />
            <Skel w="45%" h={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TileSkeletons({ count = 8 }) {
  return (
    <div className="bus-tiles" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading routes…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="bus-route-tile bus-card" key={i} aria-hidden="true">
          <Skel w={90} h={22} r={999} />
          <Skel w="85%" h={34} style={{ marginTop: 18 }} />
          <Skel w="45%" h={18} style={{ marginTop: 18 }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- tiles */

export function RouteTile({ from, to, companies, minPrice }) {
  const q = new URLSearchParams({ from, to }).toString();
  return (
    <Link to={`/bus/search?${q}`} className="bus-route-tile bus-card" aria-label={`Trips from ${from} to ${to}${minPrice ? `, from ${ugx(minPrice)}` : ""}`} style={{ "--hue": hueOf(to) }}>
      <div className="bus-route-badge"><Users size={13} />{companies} {companies === 1 ? "company" : "companies"}</div>
      <div className="bus-route-graphic">
        <span className="bus-route-track" aria-hidden="true"><i className="dot" /><i className="dash" /><span className="bus"><BusIcon size={14} /></span><i className="dash" /><i className="pin"><Pin size={15} /></i></span>
        <div className="bus-route-names">
          <div><small>From</small><strong>{from}</strong></div>
          <div><small>To</small><strong>{to}</strong></div>
        </div>
      </div>
      <div className="bus-route-foot">
        {minPrice ? <span className="bus-route-price"><small>from</small> {ugx(minPrice)}</span> : <span className="bus-hint">See prices</span>}
        <span className="bus-route-go" aria-hidden="true"><ArrowRight size={16} /></span>
      </div>
    </Link>
  );
}

export function ParkCard({ park }) {
  const dests = asList(park.destinations);
  return (
    <Link to={`/bus/parks/${park.slug}`} className="bus-park-card bus-card" aria-label={`${park.companyName} - ${park.parkName}`}>
      <Photo src={park.coverUrl} name={park.companyName} width={800} className="bus-park-cover">
        <span className="bus-park-shade" aria-hidden="true" />
        <span className="bus-park-rate"><Rating avg={park.ratingAvg} count={park.ratingCount} /></span>
      </Photo>
      <BusLogo name={park.companyName} src={park.logoUrl} className="bus-park-logo" size={58} />
      <div className="bus-park-body">
        <h3>{park.companyName}</h3>
        <p className="bus-park-where"><Pin size={14} /> {park.parkName}{park.parkDistrict ? `, ${park.parkDistrict}` : ""}</p>
        {dests.length ? (
          <div className="bus-chips">
            {dests.slice(0, 3).map((d) => <span key={d} className="bus-chip">{d}</span>)}
            {dests.length > 3 ? <span className="bus-chip">+{dests.length - 3}</span> : null}
          </div>
        ) : null}
        <div className="bus-park-foot">
          <span className="bus-hint">{park.routeCount} {park.routeCount === 1 ? "route" : "routes"}</span>
          {park.priceFrom ? <span className="bus-route-price"><small>from</small> {ugx(park.priceFrom)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function TypeCard({ type }) {
  return (
    <Link to={`/bus/search?busTypeId=${encodeURIComponent(type.id)}`} className="bus-type-card bus-card" aria-label={`${type.name} trips`}>
      <Photo src={type.imageUrl} name={type.name} width={800} className="bus-type-photo">
        <span className="bus-type-seats"><Users size={13} />{type.seats} seats</span>
      </Photo>
      <div className="bus-type-body">
        <h3>{type.name}</h3>
        {type.description ? <p className="bus-type-desc">{type.description}</p> : null}
        <AmenityChips list={type.amenities} max={2} />
        {type.upcomingTrips ? <p className="bus-hint">{type.upcomingTrips} upcoming trips</p> : null}
      </div>
    </Link>
  );
}

// tel: / WhatsApp links for a company's contact numbers.
export const telHref = (phone) => (phone ? `tel:${normalizeUgPhone(phone) ? `+${normalizeUgPhone(phone)}` : String(phone).replace(/\s/g, "")}` : "");
export const waHref = (phone) => {
  const n = normalizeUgPhone(phone) || String(phone || "").replace(/\D/g, "");
  return n ? `https://wa.me/${n}` : "";
};

// Arrival clock time; adds a small "+1" when the trip ends on a later day (overnight buses).
export function ArrivalTime({ departureAt, minutes }) {
  const arrival = arrivalAt(departureAt, minutes);
  const plus = dayDiff(departureAt, arrival);
  return (
    <>
      {eatTime(arrival)}
      {plus > 0 ? <sup className="bus-plusday" title={`Arrives ${plus} day${plus > 1 ? "s" : ""} later`}>+{plus}</sup> : null}
    </>
  );
}

// Title block used above each home / listing section.
export function SectionHead({ kicker, title, sub, action, as: Tag = "h2" }) {
  return (
    <div className="bus-sechead">
      <div>
        {kicker ? <span className="bus-kicker">{kicker}</span> : null}
        <Tag className="bus-section-title">{title}</Tag>
        {sub ? <p className="bus-section-sub">{sub}</p> : null}
      </div>
      {action || null}
    </div>
  );
}
