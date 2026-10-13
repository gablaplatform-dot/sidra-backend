import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { request } from "../../lib/api";
import { getCurrentPosition } from "../../lib/geolocation";
import { CLEAN_MAP_STYLE, KAMPALA, loadGoogleMaps } from "../../lib/maps";
import { getPreferredDistrict } from "../../lib/userLocation";
import { trackInterest } from "../../lib/tracking";
import { formatUgx } from "../../lib/format";
import { listingCover } from "../../lib/shopMappers";
import { Skel } from "../Skeleton";
import LazyImg from "../LazyImg";
import { IconClose } from "../icons";
import { IconFind } from "./HomeIcons";

const RADIUS_KM = 15;
const MIN_CHARS = 2;

// The orange map pin; a number shows when several matches share one spot.
const pinIcon = (google, { count, active }) => {
  const fill = active ? "#0b2046" : "#ea580c";
  const size = active ? 46 : 38;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 44 55"><path d="M22 53C22 53 4 33 4 21A18 18 0 0 1 40 21C40 33 22 53 22 53Z" fill="${fill}" stroke="#fff" stroke-width="3"/><circle cx="22" cy="21" r="${count > 1 ? 11 : 7}" fill="#fff"/>${count > 1 ? `<text x="22" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="800" fill="${fill}">${count > 9 ? "9+" : count}</text>` : ""}</svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(size, Math.round(size * 1.25)), anchor: new google.maps.Point(size / 2, Math.round(size * 1.25)) };
};

function NearbyMap({ items, centre, you, selectedKey, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const youRef = useRef(null);
  const [failed, setFailed] = useState("");

  // One marker per spot, carrying every match found there.
  const spots = useMemo(() => {
    const byKey = new Map();
    for (const item of items) {
      if (!item.pin) continue;
      const key = `${item.pin.lat},${item.pin.lng}`;
      const spot = byKey.get(key) ?? { key, pin: item.pin, items: [] };
      spot.items.push(item);
      byKey.set(key, spot);
    }
    return [...byKey.values()];
  }, [items]);

  useEffect(() => {
    let active = true;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !elRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(elRef.current, { center: centre || KAMPALA, zoom: 13, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "greedy", styles: CLEAN_MAP_STYLE });
        }
        const map = mapRef.current;
        for (const marker of markersRef.current.values()) marker.setMap(null);
        markersRef.current = new Map();
        const bounds = new google.maps.LatLngBounds();
        for (const spot of spots) {
          const marker = new google.maps.Marker({ position: spot.pin, map, icon: pinIcon(google, { count: spot.items.length, active: false }), title: spot.items[0].provider?.businessName || "" });
          marker.addListener("click", () => onSelect(spot.items[0].id));
          marker.__count = spot.items.length;
          markersRef.current.set(spot.key, marker);
          bounds.extend(spot.pin);
        }
        if (you) {
          if (youRef.current) youRef.current.setMap(null);
          youRef.current = new google.maps.Marker({
            position: you,
            map,
            zIndex: 2,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
            title: "You are here"
          });
          bounds.extend(you);
        } else if (centre) bounds.extend(centre);
        google.maps.event.trigger(map, "resize");
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 48);
          google.maps.event.addListenerOnce(map, "idle", () => {
            if (map.getZoom() > 16) map.setZoom(16);
          });
        }
      })
      .catch((e) => active && setFailed(e.message || "The map is not available right now."));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, centre, you]);

  // The picked result's pin turns navy and the map glides to it.
  useEffect(() => {
    const google = window.google;
    if (!google || !mapRef.current) return;
    for (const [key, marker] of markersRef.current) {
      const active = key === selectedKey;
      marker.setIcon(pinIcon(google, { count: marker.__count, active }));
      marker.setZIndex(active ? 5 : 1);
      if (active) mapRef.current.panTo(marker.getPosition());
    }
  }, [selectedKey]);

  if (failed) return <div className="mh-find-map is-error">{failed} The list below still works.</div>;
  return <div ref={elRef} className="mh-find-map" role="region" aria-label="Map of results" />;
}

function ResultCard({ item, selected, onPick, innerRef }) {
  const price = Number(item.price) || 0;
  return (
    <Link ref={innerRef} to={`/shop/product/${item.id}`} className={`mh-find-card ${selected ? "is-selected" : ""}`} onMouseEnter={() => onPick?.(item.id)} onFocus={() => onPick?.(item.id)}>
      <span className="mh-find-thumb"><LazyImg src={listingCover(item)} alt="" loading="lazy" /></span>
      <span className="mh-find-body">
        <span className="mh-find-tags">
          <i className={item.type === "service" ? "is-service" : ""}>{item.type === "service" ? "Service" : "Product"}</i>
          {item.distanceKm !== undefined ? <b>{item.distanceKm < 1 ? "< 1 km" : `${item.distanceKm} km`} away</b> : null}
        </span>
        <strong>{item.name}</strong>
        <span className="mh-find-price">{price > 0 ? formatUgx(price) : "Contact for price"}</span>
        <small>{item.provider?.businessName}{item.provider?.district ? ` · ${item.provider.district}` : ""}</small>
      </span>
    </Link>
  );
}

// The home search: type what you want and see where nearby it is, on a map or as a list ordered by distance.
export default function NearbyFinder({ session }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("map");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [where, setWhere] = useState(null); // { lat, lng, source, district }
  const [selectedId, setSelectedId] = useState(null);
  const whereRef = useRef(null);
  const trackedRef = useRef("");
  const railRef = useRef(null);
  const cardRefs = useRef(new Map());
  const seq = useRef(0);
  const [refresh, setRefresh] = useState(0);

  // Where "nearby" is: the phone's position, else the district on the account, else Kampala.
  const resolveWhere = useCallback(
    async (force = false) => {
      if (whereRef.current && !force) return whereRef.current;
      let next;
      try {
        const here = await getCurrentPosition();
        next = { lat: here.lat, lng: here.lng, source: "gps" };
      } catch (e) {
        const district = session?.user?.profile?.district || getPreferredDistrict();
        next = district ? { district, source: "district", reason: e.message } : { lat: KAMPALA.lat, lng: KAMPALA.lng, source: "default", reason: e.message };
      }
      whereRef.current = next;
      setWhere(next);
      return next;
    },
    [session]
  );

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) {
      setQuery("");
      setData(null);
      setError("");
      return undefined;
    }
    const t = setTimeout(() => setQuery(trimmed), 380);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (!query) return undefined;
    const ticket = (seq.current += 1);
    setLoading(true);
    setError("");
    (async () => {
      const spot = await resolveWhere();
      if (ticket !== seq.current) return;
      const params = new URLSearchParams({ q: query, limit: "40" });
      if (spot.lat != null) {
        params.set("lat", String(spot.lat));
        params.set("lng", String(spot.lng));
        params.set("radiusKm", String(RADIUS_KM));
      } else if (spot.district) params.set("around", spot.district);
      try {
        const result = await request(`/listings/nearby-map?${params.toString()}`);
        if (ticket !== seq.current) return;
        setData(result);
        setSelectedId(result.items?.[0]?.id ?? null);
        if (trackedRef.current !== query) {
          trackedRef.current = query;
          trackInterest({ type: "search", query });
        }
      } catch (e) {
        if (ticket === seq.current) setError(e.message || "We couldn't search right now.");
      } finally {
        if (ticket === seq.current) setLoading(false);
      }
    })();
    return () => {};
  }, [query, refresh, resolveWhere]);

  const items = data?.items || [];
  const selected = items.find((i) => i.id === selectedId);
  const selectedKey = selected?.pin ? `${selected.pin.lat},${selected.pin.lng}` : null;
  const you = where?.source === "gps" ? { lat: where.lat, lng: where.lng } : null;
  const centre = data?.centre || (where?.lat != null ? { lat: where.lat, lng: where.lng } : null);

  const pick = (id) => {
    setSelectedId(id);
    const el = cardRefs.current.get(id);
    if (el && railRef.current) railRef.current.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
  };

  const note =
    where?.source === "gps"
      ? "Around your current location"
      : where?.source === "district"
        ? `Around ${where.district}, from your account. Turn on location for results around you.`
        : where
          ? "Around Kampala. Turn on location for results around you."
          : "";

  const active = text.trim().length >= MIN_CHARS;

  return (
    <div className={`mh-find ${active ? "is-open" : ""}`}>
      <form
        className="mh-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= MIN_CHARS) setQuery(text.trim());
          document.activeElement?.blur?.();
        }}
      >
        <IconFind />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What would you like to find nearby?" aria-label="Find products and services nearby" enterKeyHint="search" autoComplete="off" />
        {text ? (
          <button type="button" className="mh-search-clear" onClick={() => setText("")} aria-label="Clear search"><IconClose width={16} height={16} /></button>
        ) : null}
      </form>

      {active ? (
        <section className="mh-find-panel" aria-live="polite">
          <header className="mh-find-head">
            <div>
              <strong>{loading && !data ? "Searching nearby…" : `${data?.total ?? 0} result${data?.total === 1 ? "" : "s"} for “${query || text.trim()}”`}</strong>
              <small>{data?.widened ? "Nothing very close, so we widened the search · " : ""}Nearest first</small>
            </div>
            <div className="mh-find-toggle" role="group" aria-label="Results view">
              <button type="button" className={mode === "map" ? "is-active" : ""} onClick={() => setMode("map")} aria-pressed={mode === "map"}>Map</button>
              <button type="button" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")} aria-pressed={mode === "list"}>List</button>
            </div>
          </header>
          {note ? (
            <p className="mh-find-note">
              {note}
              {where?.source !== "gps" ? <button type="button" onClick={() => resolveWhere(true).then(() => setRefresh((n) => n + 1))}>Use my location</button> : null}
            </p>
          ) : null}

          {error ? <div className="mh-find-empty">{error}</div> : null}

          {loading && !data ? (
            <div className="mh-find-skel"><Skel h={300} r={22} /><Skel h={96} r={18} /></div>
          ) : !error && data && !items.length ? (
            <div className="mh-find-empty">
              <strong>Nothing found for “{query}”</strong>
              <p>Try a shorter word, or search everything.</p>
              <Link to={`/search?q=${encodeURIComponent(query)}`}>Search all of Gabla</Link>
            </div>
          ) : items.length ? (
            mode === "map" ? (
              <>
                <NearbyMap items={items} centre={centre} you={you} selectedKey={selectedKey} onSelect={pick} />
                <div className="mh-find-rail" ref={railRef}>
                  {items.map((item) => (
                    <ResultCard key={item.id} item={item} selected={item.id === selectedId} onPick={setSelectedId} innerRef={(el) => (el ? cardRefs.current.set(item.id, el) : cardRefs.current.delete(item.id))} />
                  ))}
                </div>
              </>
            ) : (
              <div className="mh-find-list">
                {items.map((item) => <ResultCard key={item.id} item={item} />)}
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
