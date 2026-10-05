import React, { useState } from "react";
import { Link } from "react-router-dom";

import { Skel } from "../Skeleton";
import { IconArrowRight, IconBus, IconStar, IconPin } from "../icons";
import { eatDate, eatTime, normalizeUgPhone, ugx } from "../../lib/bus";

// Stable accent per company so cover-less parks still look distinct.
export const coverStyle = (name, url) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { "--cover-hue": h, ...(url ? { backgroundImage: `url("${url}")` } : {}) };
};

export const initialOf = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

export const ratingText = (avg, count) => {
  const n = Number(avg);
  if (!count || !Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(1);
};

export const asList = (value) => (Array.isArray(value) ? value.filter(Boolean).map(String) : []);

// Company logo with a lettered fallback if there is no image (or it fails to load).
export function BusLogo({ name, src, className = "bus-trip-logo" }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={className} aria-hidden="true">
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : initialOf(name)}
    </span>
  );
}

export function Rating({ avg, count }) {
  const text = ratingText(avg, count);
  if (!text) return <span className="bus-rating is-new">New</span>;
  return (
    <span className="bus-rating" title={`${text} out of 5 from ${count} reviews`}>
      <IconStar width={14} height={14} /> {text} <small>({count})</small>
    </span>
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

export function TripSkeletons({ count = 3 }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading trips…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="bus-card bus-trip" key={i} aria-hidden="true">
          <div>
            <div className="bus-trip-co"><Skel w={38} h={38} r={11} /><Skel w={150} h={16} /></div>
            <div className="bus-trip-times"><Skel w={80} h={26} /><Skel w="30%" h={8} /><Skel w={80} h={26} /></div>
            <div className="bus-trip-meta"><Skel w={90} h={26} r={999} /><Skel w={130} h={26} r={999} /></div>
          </div>
          <div className="bus-trip-buy"><Skel w={110} h={24} /><Skel w={120} h={44} r={12} /></div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6, height = 150 }) {
  return (
    <div className="bus-grid" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="bus-card" key={i} style={{ padding: 16 }} aria-hidden="true">
          <Skel w="60%" h={20} />
          <Skel w="90%" h={14} style={{ marginTop: 12 }} />
          <Skel w="40%" h={14} style={{ marginTop: 8 }} />
          <Skel w="100%" h={Math.max(30, height - 90)} r={12} style={{ marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export function RouteTile({ from, to, companies, minPrice }) {
  const q = new URLSearchParams({ from, to }).toString();
  return (
    <Link to={`/bus/search?${q}`} className="bus-card bus-route-tile" aria-label={`Trips from ${from} to ${to}`}>
      <div className="bus-route-line">
        <span>{from}</span>
        <IconArrowRight className="bus-arrow" width={18} height={18} />
        <span>{to}</span>
      </div>
      <div className="bus-route-foot">
        <span className="bus-hint">{companies} {companies === 1 ? "company" : "companies"}</span>
        {minPrice ? <span className="bus-price"><small>from </small>{ugx(minPrice)}</span> : null}
      </div>
    </Link>
  );
}

export function ParkCard({ park }) {
  return (
    <Link to={`/bus/parks/${park.slug}`} className="bus-card bus-park-card" aria-label={`${park.companyName} - ${park.parkName}`}>
      <div className="bus-park-cover" style={coverStyle(park.companyName, park.coverUrl)}>
        <BusLogo name={park.companyName} src={park.logoUrl} className="bus-park-logo" />
      </div>
      <div className="bus-park-body">
        <div className="bus-park-title">
          <h3>{park.companyName}</h3>
          <Rating avg={park.ratingAvg} count={park.ratingCount} />
        </div>
        <p className="bus-hint bus-park-where"><IconPin width={14} height={14} /> {park.parkName}{park.parkDistrict ? `, ${park.parkDistrict}` : ""}</p>
        {park.destinations?.length ? (
          <div className="bus-chips">
            {park.destinations.map((d) => <span key={d} className="bus-chip">{d}</span>)}
          </div>
        ) : null}
        <div className="bus-route-foot">
          <span className="bus-hint">{park.routeCount} {park.routeCount === 1 ? "route" : "routes"}</span>
          {park.priceFrom ? <span className="bus-price"><small>from </small>{ugx(park.priceFrom)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function TypeCard({ type }) {
  const amenities = asList(type.amenities);
  return (
    <Link to={`/bus/search?busTypeId=${encodeURIComponent(type.id)}`} className="bus-card bus-type-card" aria-label={`${type.name} trips`}>
      <span className="bus-type-art">{type.imageUrl ? <img src={type.imageUrl} alt="" loading="lazy" /> : <IconBus />}</span>
      <div className="bus-type-body">
        <h3>{type.name}</h3>
        <p className="bus-hint">{type.seats} seats{type.upcomingTrips ? ` · ${type.upcomingTrips} upcoming trips` : ""}</p>
        {type.description ? <p className="bus-type-desc">{type.description}</p> : null}
        {amenities.length ? (
          <div className="bus-chips">
            {amenities.slice(0, 4).map((a) => <span key={a} className="bus-chip bus-chip-orange">{a}</span>)}
            {amenities.length > 4 ? <span className="bus-chip">+{amenities.length - 4}</span> : null}
          </div>
        ) : null}
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
  const arrival = new Date(new Date(departureAt).getTime() + (Number(minutes) || 0) * 60000);
  const toUtc = (str) => Date.UTC(...str.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const plus = Math.round((toUtc(eatDate(arrival)) - toUtc(eatDate(departureAt))) / 86400000);
  return (
    <>
      {eatTime(arrival)}
      {plus > 0 ? <sup className="bus-plusday" title={`Arrives ${plus} day${plus > 1 ? "s" : ""} later`}>+{plus}</sup> : null}
    </>
  );
}
