import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { getCurrentPosition } from "../lib/geolocation";
import { CLEAN_MAP_STYLE, KAMPALA, loadGoogleMaps, reverseGeocode, tidyAddress } from "../lib/maps";
import { IconClose, IconPin, IconSearch, IconTarget } from "./icons";

// Where to deliver. Two ways in:
//   - "Pick on map": a full-screen map that opens on the buyer's position (Kampala if they don't share it),
//     with a pin fixed in the middle. Moving the map moves the pin; the place name is looked up behind
//     the scenes and the coordinates are kept without ever being shown.
//   - "Type it in": a search box that suggests real places to pick from.
// Either way the chosen place is { address, lat, lng, source: "map" | "search" }.
export default function DeliveryLocationPicker({ value, onChange }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(value?.source === "search" ? "search" : "map");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapsError, setMapsError] = useState("");

  useEffect(() => {
    let active = true;
    loadGoogleMaps().catch((e) => active && setMapsError(e.message || t("delivery.mapsUnavailable")));
    return () => {
      active = false;
    };
  }, []);

  const clear = () => onChange(null);

  return (
    <div className="dlp">
      <div className="dlp-modes" role="tablist" aria-label={t("delivery.modesLabel")}>
        <button type="button" role="tab" aria-selected={mode === "map"} className={mode === "map" ? "is-active" : ""} onClick={() => setMode("map")}>
          <IconPin width={18} height={18} /> {t("delivery.pickOnMap")}
        </button>
        <button type="button" role="tab" aria-selected={mode === "search"} className={mode === "search" ? "is-active" : ""} onClick={() => setMode("search")}>
          <IconSearch width={18} height={18} /> {t("delivery.enterLocation")}
        </button>
      </div>

      {mode === "map" ? (
        value?.address && value.source === "map" ? (
          <SelectedPlace place={value} onChange={() => setSheetOpen(true)} onClear={clear} />
        ) : (
          <button type="button" className="dlp-open" onClick={() => setSheetOpen(true)} disabled={Boolean(mapsError)}>
            <span className="dlp-open-icon"><IconTarget /></span>
            <span>
              <strong>{t("delivery.chooseOnMap")}</strong>
              <small>{mapsError ? t("delivery.mapUnavailableHint") : t("delivery.mapOpensHint")}</small>
            </span>
          </button>
        )
      ) : (
        <SearchBox value={value?.source === "search" ? value : null} onChange={onChange} mapsError={mapsError} />
      )}

      {sheetOpen ? (
        <MapSheet
          initial={value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null}
          onClose={() => setSheetOpen(false)}
          onConfirm={(place) => {
            onChange({ ...place, source: "map" });
            setSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function SelectedPlace({ place, onChange, onClear }) {
  const { t } = useTranslation();
  return (
    <div className="dlp-selected">
      <span className="dlp-selected-icon"><IconPin /></span>
      <div className="dlp-selected-text">
        <small>{t("delivery.deliverTo")}</small>
        <strong>{place.address}</strong>
      </div>
      <div className="dlp-selected-actions">
        <button type="button" onClick={onChange}>{t("delivery.change")}</button>
        <button type="button" onClick={onClear} aria-label={t("delivery.removeLocation")}><IconClose width={16} height={16} /></button>
      </div>
    </div>
  );
}

// Typing narrows suggestions down to real places; choosing one saves its name and position. Typing again
// after choosing drops the old position, so a name and a position can never disagree.
function SearchBox({ value, onChange, mapsError }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [text, setText] = useState(value?.address || "");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let listener;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !inputRef.current) return;
        const bounds = new google.maps.LatLngBounds({ lat: 0.2, lng: 32.4 }, { lat: 0.5, lng: 32.8 });
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ug" },
          bounds,
          fields: ["geometry", "formatted_address", "name"]
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const loc = place?.geometry?.location;
          if (!loc) return;
          const name = tidyAddress(place.formatted_address || place.name);
          const label = place.name && !name.startsWith(place.name) ? `${place.name}, ${name}` : name;
          setText(label);
          onChange({ address: label, lat: loc.lat(), lng: loc.lng(), source: "search" });
        });
        setReady(true);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (listener) window.google?.maps?.event?.removeListener(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (next) => {
    setText(next);
    if (mapsError) onChange(next.trim() ? { address: next.trim(), lat: null, lng: null, source: "text" } : null);
    else if (value) onChange(null);
  };

  return (
    <div className="dlp-search">
      <label className="dlp-search-field">
        <IconSearch width={18} height={18} />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => edit(e.target.value)}
          placeholder={t("delivery.searchPlaceholder")}
          autoComplete="off"
          aria-label={t("delivery.locationLabel")}
        />
        {value ? <span className="dlp-search-ok" title={t("delivery.savedTitle")}>✓</span> : null}
      </label>
      {mapsError ? (
        <p className="dlp-hint">{t("delivery.searchUnavailable")}</p>
      ) : value ? (
        <p className="dlp-hint is-ok">{t("delivery.savedHint")}</p>
      ) : (
        <p className="dlp-hint">{ready ? t("delivery.pickSuggestion") : t("delivery.loadingSuggestions")}</p>
      )}
    </div>
  );
}

// The map itself. The pin stays in the middle; the map moves under it.
function MapSheet({ initial, onClose, onConfirm }) {
  const { t } = useTranslation();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const lookupRef = useRef(0);
  const [place, setPlace] = useState(null); // { lat, lng, address }
  const [resolving, setResolving] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const resolve = useCallback((google, lat, lng) => {
    const ticket = (lookupRef.current += 1);
    setResolving(true);
    reverseGeocode(google, lat, lng).then((address) => {
      if (ticket !== lookupRef.current) return; // the map moved again while this was looking up
      setPlace({ lat, lng, address: address || "Pinned location" });
      setResolving(false);
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    let idleTimer;
    loadGoogleMaps()
      .then(async (google) => {
        if (!active || !mapElRef.current) return;
        const start = initial || KAMPALA;
        const map = new google.maps.Map(mapElRef.current, {
          center: start,
          zoom: initial ? 17 : 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: CLEAN_MAP_STYLE
        });
        mapRef.current = map;
        map.addListener("dragstart", () => setDragging(true));
        map.addListener("zoom_changed", () => setResolving(true));
        map.addListener("idle", () => {
          setDragging(false);
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            const c = map.getCenter();
            if (c) resolve(google, c.lat(), c.lng());
          }, 250);
        });
        setTimeout(() => google.maps.event.trigger(map, "resize"), 60);

        // Start from where the person is. If they say no (or it fails) the map simply stays on Kampala.
        if (!initial) {
          try {
            const here = await getCurrentPosition();
            if (!active) return;
            map.setCenter(here);
            map.setZoom(17);
          } catch (e) {
            if (!active) return;
            setNotice(e.message === "denied" ? t("delivery.noticeOff") : t("delivery.noticeNotFound"));
          }
        }
      })
      .catch((e) => active && setError(e.message || t("delivery.mapLoadFailed")));
    return () => {
      active = false;
      clearTimeout(idleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateMe = async () => {
    if (!mapRef.current) return;
    setLocating(true);
    setNotice("");
    try {
      const here = await getCurrentPosition();
      mapRef.current.panTo(here);
      mapRef.current.setZoom(17);
    } catch (e) {
      setNotice(e.message === "denied" ? t("delivery.allowLocation") : t("delivery.locateFailed"));
    } finally {
      setLocating(false);
    }
  };

  const zoom = (delta) => mapRef.current && mapRef.current.setZoom((mapRef.current.getZoom() || 15) + delta);

  return createPortal(
    <div className="dlp-sheet" role="dialog" aria-modal="true" aria-label={t("delivery.sheetLabel")}>
      <div className="dlp-sheet-panel">
        <header className="dlp-sheet-head">
          <button type="button" className="dlp-circle" onClick={onClose} aria-label={t("delivery.closeMap")}><IconClose /></button>
          <div>
            <strong>{t("delivery.sheetTitle")}</strong>
            <small>{t("delivery.sheetHint")}</small>
          </div>
        </header>

        <div className="dlp-map-wrap">
          <div ref={mapElRef} className="dlp-map" />
          {error ? <div className="dlp-map-error">{error}</div> : null}
          <div className={`dlp-pin ${dragging ? "is-lifted" : ""}`} aria-hidden="true">
            <svg width="44" height="56" viewBox="0 0 44 56"><path d="M22 54C22 54 4 33.5 4 21A18 18 0 0 1 40 21C40 33.5 22 54 22 54Z" fill="#ea580c" stroke="#fff" strokeWidth="3" /><circle cx="22" cy="21" r="7" fill="#fff" /></svg>
            <span className="dlp-pin-shadow" />
          </div>
          <div className="dlp-map-tools">
            <button type="button" className="dlp-circle" onClick={() => zoom(1)} aria-label={t("delivery.zoomIn")}>+</button>
            <button type="button" className="dlp-circle" onClick={() => zoom(-1)} aria-label={t("delivery.zoomOut")}>&minus;</button>
            <button type="button" className={`dlp-circle dlp-locate ${locating ? "is-busy" : ""}`} onClick={locateMe} aria-label={t("delivery.useMyLocation")}><IconTarget /></button>
          </div>
          {notice ? <div className="dlp-notice" role="status">{notice}</div> : null}
        </div>

        <footer className="dlp-sheet-foot">
          <div className="dlp-place">
            <span className="dlp-place-icon"><IconPin /></span>
            <div>
              <small>{t("delivery.deliveringTo")}</small>
              {resolving || !place ? <span className="skel dlp-place-skel" aria-label={t("delivery.findingPlace")} /> : <strong>{place.address}</strong>}
            </div>
          </div>
          <button type="button" className="primary-button dlp-confirm" disabled={resolving || !place || Boolean(error)} onClick={() => onConfirm(place)}>
            {t("delivery.confirm")}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
