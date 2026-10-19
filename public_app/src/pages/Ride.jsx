import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginPath } from "../lib/authRedirect";

import { request } from "../lib/api";
import { getSession } from "../lib/session";
import { loadGoogleMaps } from "../lib/maps";
import { formatUgx } from "../lib/format";
import { getActiveTripId, setActiveTripId, clearActiveTripId } from "../lib/activeRide";
import { IconBike, IconCar, IconCash, IconChevronLeft, IconPhone, IconTarget, IconWallet } from "../components/icons";

// Kampala — used only when geolocation is unavailable/denied, purely as a starting map center.
const DEFAULT_CENTER = { lat: 0.3476, lng: 32.5825 };
const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ["completed", "cancelled_by_rider", "cancelled_by_driver", "no_drivers_found"];
const CANCELLABLE_STATUSES = ["searching", "matched", "arrived"];

// Labels/descriptions come from ride.types.<value>.* at render time.
const RIDE_TYPES = [
  { value: "boda", Icon: IconBike },
  { value: "car", Icon: IconCar }
];

const STATUS_COPY_KEYS = ["searching", "matched", "arrived", "in_progress"];

export default function Ride() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [session] = useState(() => getSession());

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const activeFieldRef = useRef("pickup");
  const tripIdRef = useRef(null);
  const pollTimerRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const [mapsError, setMapsError] = useState("");
  const [pickup, setPickup] = useState(null); // { lat, lng, address }
  const [dropoff, setDropoff] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [locating, setLocating] = useState(false);

  const [stage, setStage] = useState("setup"); // setup | choose | confirm | live
  const [vehicleType, setVehicleType] = useState("boda");
  const [estimates, setEstimates] = useState({});
  const [estimating, setEstimating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [trip, setTrip] = useState(null);

  // --- Map bootstrap ---------------------------------------------------------------
  useEffect(() => {
    let active = true;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !mapElRef.current) return;
        const map = new google.maps.Map(mapElRef.current, {
          center: DEFAULT_CENTER,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false
        });
        mapRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        // The map measures its container at construction time; in a flex layout that size isn't
        // settled yet on first paint, so it renders at Google's tiny default until nudged. Only
        // re-center on the first real resize — later ones (window resize, etc.) shouldn't yank
        // the view away from wherever the rider has since panned to.
        let recenteredOnce = false;
        const resizeObserver = new ResizeObserver(() => {
          const rect = mapElRef.current.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          google.maps.event.trigger(map, "resize");
          if (!recenteredOnce) {
            map.setCenter(DEFAULT_CENTER);
            recenteredOnce = true;
          }
        });
        resizeObserver.observe(mapElRef.current);
        resizeObserverRef.current = resizeObserver;

        map.addListener("click", (e) => {
          const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          if (activeFieldRef.current === "dropoff") setDropoffPoint(point);
          else setPickupPoint(point);
        });

        if (pickupInputRef.current) {
          const ac = new google.maps.places.Autocomplete(pickupInputRef.current, { fields: ["geometry", "formatted_address", "name"] });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            const loc = place?.geometry?.location;
            if (!loc) return;
            setPickupPoint({ lat: loc.lat(), lng: loc.lng(), address: place.formatted_address || place.name });
          });
        }
        if (dropoffInputRef.current) {
          const ac = new google.maps.places.Autocomplete(dropoffInputRef.current, { fields: ["geometry", "formatted_address", "name"] });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            const loc = place?.geometry?.location;
            if (!loc) return;
            setDropoffPoint({ lat: loc.lat(), lng: loc.lng(), address: place.formatted_address || place.name });
          });
        }

        useMyLocation(map);
        resumeActiveTrip();
      })
      .catch((e) => {
        if (active) setMapsError(e.message || t("ride.map.unavailable"));
      });
    return () => {
      active = false;
      clearTimeout(pollTimerRef.current);
      resizeObserverRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverseGeocode = (lat, lng) =>
    new Promise((resolve) => {
      if (!geocoderRef.current) {
        resolve(null);
        return;
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        resolve(status === "OK" && results?.[0] ? results[0].formatted_address : null);
      });
    });

  const placeMarker = (ref, point, color) => {
    const google = window.google;
    if (!google || !mapRef.current) return;
    if (ref.current) {
      ref.current.setPosition(point);
      return;
    }
    ref.current = new google.maps.Marker({
      position: point,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3
      }
    });
  };

  const drawRoute = (a, b, encodedPolyline) => {
    const google = window.google;
    if (!google || !mapRef.current) return;
    if (routeLineRef.current) routeLineRef.current.setMap(null);
    if (!a || !b) return;

    // A real routed polyline from the backend (Google Routes API) is drawn as a solid road-
    // following line; without one (API not enabled yet, or still fetching) we fall back to the
    // straight dashed line between the two pins so there's always some visual route.
    let path = [a, b];
    let isReal = false;
    if (encodedPolyline && google.maps.geometry?.encoding) {
      try {
        const decoded = google.maps.geometry.encoding.decodePath(encodedPolyline);
        if (decoded.length > 1) {
          path = decoded;
          isReal = true;
        }
      } catch {
        // Fall back to the straight line below.
      }
    }

    routeLineRef.current = new google.maps.Polyline({
      path,
      geodesic: !isReal,
      strokeColor: "#0b2046",
      strokeOpacity: isReal ? 0.85 : 0.65,
      strokeWeight: isReal ? 4 : 3,
      icons: isReal ? undefined : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }],
      map: mapRef.current
    });
    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, 80);
  };

  const setPickupPoint = (point) => {
    setPickup({ lat: point.lat, lng: point.lng, address: point.address || null });
    setPickupText(point.address || t("ride.droppedPin"));
    placeMarker(pickupMarkerRef, point, "#0b2046");
    if (!point.address) {
      reverseGeocode(point.lat, point.lng).then((address) => {
        if (address) {
          setPickup((current) => (current && current.lat === point.lat && current.lng === point.lng ? { ...current, address } : current));
          setPickupText(address);
        }
      });
    }
    if (!dropoff) {
      activeFieldRef.current = "dropoff";
      dropoffInputRef.current?.focus();
    }
  };

  const setDropoffPoint = (point) => {
    setDropoff({ lat: point.lat, lng: point.lng, address: point.address || null });
    setDropoffText(point.address || t("ride.droppedPin"));
    placeMarker(dropoffMarkerRef, point, "#e11d48");
    if (!point.address) {
      reverseGeocode(point.lat, point.lng).then((address) => {
        if (address) {
          setDropoff((current) => (current && current.lat === point.lat && current.lng === point.lng ? { ...current, address } : current));
          setDropoffText(address);
        }
      });
    }
  };

  useEffect(() => {
    if (pickup && dropoff) drawRoute(pickup, dropoff, estimates[vehicleType]?.polyline || trip?.routePolyline || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, estimates[vehicleType]?.polyline, trip?.routePolyline]);

  // Shows the matched driver on the map as soon as they're known — during "confirm" (right after
  // requestTrip), not just once live tracking/polling starts.
  useEffect(() => {
    if (trip?.driver?.lat != null && trip?.driver?.lng != null) {
      placeMarker(driverMarkerRef, { lat: trip.driver.lat, lng: trip.driver.lng }, "#facc15");
    } else if (trip && !trip.driver && driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.driver?.lat, trip?.driver?.lng, trip?.driver]);

  const useMyLocation = (mapOverride) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        (mapOverride || mapRef.current)?.setCenter(point);
        setPickupPoint(point);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // --- Fare estimates ---------------------------------------------------------------
  // Fetched as soon as both points are set (not just once "Choose a ride" is tapped) so the
  // route preview on the setup screen is the real routed line, not only the straight fallback.
  useEffect(() => {
    if (!pickup || !dropoff) return;
    let active = true;
    setEstimating(true);
    Promise.allSettled(
      RIDE_TYPES.map((rt) =>
        request("/rides/estimate", {
          method: "POST",
          body: JSON.stringify({ vehicleType: rt.value, pickup, dropoff })
        }).then((result) => [rt.value, result])
      )
    ).then((results) => {
      if (!active) return;
      const next = {};
      for (const r of results) {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      }
      setEstimates(next);
      if (!next[vehicleType]) {
        const firstAvailable = RIDE_TYPES.find((rt) => next[rt.value]);
        if (firstAvailable) setVehicleType(firstAvailable.value);
      }
      setEstimating(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff]);

  // --- Trip polling ---------------------------------------------------------------
  const pollTrip = async () => {
    const polledTripId = tripIdRef.current;
    if (!polledTripId) return;
    try {
      const result = await request(`/rides/trips/${polledTripId}`);
      // The trip being tracked may have changed (or polling may have been cancelled entirely —
      // e.g. via "Book another ride") while this request was in flight; a stale response landing
      // late must not resurrect old state or spawn a second, untracked poll loop.
      if (tripIdRef.current !== polledTripId) return;
      setTrip(result);
      if (result.driver?.lat != null && result.driver?.lng != null) {
        placeMarker(driverMarkerRef, { lat: result.driver.lat, lng: result.driver.lng }, "#facc15");
      }
      if (TERMINAL_STATUSES.includes(result.status)) {
        clearActiveTripId();
        return;
      }
    } catch (pollError) {
      if (pollError.status === 401) {
        setError(t("ride.errors.sessionExpired"));
        return;
      }
      // Otherwise assume a transient network hiccup — keep polling.
    }
    if (tripIdRef.current === polledTripId) {
      pollTimerRef.current = setTimeout(pollTrip, POLL_INTERVAL_MS);
    }
  };

  const resumeActiveTrip = () => {
    const existingTripId = getActiveTripId();
    if (!existingTripId) return;
    tripIdRef.current = existingTripId;
    request(`/rides/trips/${existingTripId}`)
      .then((result) => {
        if (TERMINAL_STATUSES.includes(result.status)) {
          clearActiveTripId();
          return;
        }
        setTrip(result);
        if (result.status === "matched" && !result.riderConfirmedAt) {
          setStage("confirm");
          return;
        }
        setStage("live");
        pollTimerRef.current = setTimeout(pollTrip, POLL_INTERVAL_MS);
      })
      .catch(() => clearActiveTripId());
  };

  // --- Actions ---------------------------------------------------------------
  const chooseRide = () => {
    if (!pickup || !dropoff) return;
    setError("");
    setStage("choose");
  };

  const requestRide = async () => {
    if (!session) {
      navigate(loginPath(location));
      return;
    }
    if (paymentMethod === "mobile_money" && !phone.trim()) {
      setError(t("ride.errors.phoneRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await request("/rides/trips", {
        method: "POST",
        body: JSON.stringify({
          vehicleType,
          pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || "" },
          dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address || "" },
          paymentMethod,
          ...(paymentMethod === "mobile_money" ? { phone: phone.trim() } : {})
        })
      });
      tripIdRef.current = result.id;
      setActiveTripId(result.id);
      setTrip(result);
      if (result.status === "no_drivers_found") {
        setStage("live");
        return;
      }
      // The rider reviews the auto-matched driver before the driver is ever notified.
      setStage("confirm");
    } catch (submitError) {
      setError(submitError.message || t("ride.errors.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRide = async () => {
    if (!trip?.id) return;
    setConfirming(true);
    setError("");
    try {
      const result = await request(`/rides/trips/${trip.id}/confirm`, { method: "POST" });
      setTrip(result);
      setStage("live");
      if (!TERMINAL_STATUSES.includes(result.status)) pollTrip();
    } catch (confirmError) {
      setError(confirmError.message || t("ride.errors.confirmFailed"));
    } finally {
      setConfirming(false);
    }
  };

  const cancelTrip = async () => {
    if (!trip?.id) return;
    try {
      const result = await request(`/rides/trips/${trip.id}/cancel`, { method: "POST", body: JSON.stringify({}) });
      setTrip((current) => ({ ...current, ...result }));
      setStage("live");
      clearActiveTripId();
      clearTimeout(pollTimerRef.current);
    } catch (cancelError) {
      setError(cancelError.message || t("ride.errors.cancelFailed"));
    }
  };

  const bookAnother = () => {
    clearTimeout(pollTimerRef.current);
    clearActiveTripId();
    tripIdRef.current = null;
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }
    setDropoff(null);
    setDropoffText("");
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setMap(null);
      dropoffMarkerRef.current = null;
    }
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }
    setTrip(null);
    setError("");
    setStage("setup");
  };

  const selectedEstimate = estimates[vehicleType];
  const hasStatusCopy = trip ? STATUS_COPY_KEYS.includes(trip.status) : false;
  const rideTypeLabel = (value) => t(`ride.types.${value}.label`, { defaultValue: value });
  const formatEta = (min) => (min < 1 ? t("ride.eta.underMinute") : t("ride.eta.minutes", { count: Math.round(min) }));

  return (
    <main className="ride-shell">
      <div className="ride-topbar">
        <button type="button" className="icon-button" aria-label={t("ride.back")} onClick={() => navigate("/home")}>
          <IconChevronLeft />
        </button>
        <strong>Gabla Ride</strong>
        <span />
      </div>

      <div className="ride-map-wrap">
        <div ref={mapElRef} className="ride-map" />
        {mapsError ? <div className="ride-map-error">{mapsError}</div> : null}
      </div>

      <div className="ride-sheet">
        {error ? <div className="error-message">{error}</div> : null}

        {stage === "setup" ? (
          <>
            <div className="ride-address-fields">
              <div className="ride-address-row">
                <span className="ride-address-dot ride-address-dot-pickup" />
                <input
                  ref={pickupInputRef}
                  value={pickupText}
                  placeholder={t("ride.pickupPlaceholder")}
                  onFocus={() => (activeFieldRef.current = "pickup")}
                  onChange={(e) => setPickupText(e.target.value)}
                />
                <button type="button" className="icon-button" aria-label={t("ride.useCurrentLocation")} onClick={() => useMyLocation()} disabled={locating}>
                  <IconTarget />
                </button>
              </div>
              <div className="ride-address-row">
                <span className="ride-address-dot ride-address-dot-dropoff" />
                <input
                  ref={dropoffInputRef}
                  value={dropoffText}
                  placeholder={t("ride.dropoffPlaceholder")}
                  onFocus={() => (activeFieldRef.current = "dropoff")}
                  onChange={(e) => setDropoffText(e.target.value)}
                />
              </div>
            </div>
            <p className="ride-hint">{t("ride.searchHint")}</p>
            <button type="button" className="primary-button" disabled={!pickup || !dropoff} onClick={chooseRide}>
              {t("ride.chooseRide")}
            </button>
          </>
        ) : null}

        {stage === "choose" ? (
          <>
            <button type="button" className="ride-edit-link" onClick={() => setStage("setup")}>
              &larr; {t("ride.editLocations")}
            </button>

            <div className="ride-type-list">
              {RIDE_TYPES.map((rt) => {
                const est = estimates[rt.value];
                const disabled = !estimating && !est;
                return (
                  <button
                    key={rt.value}
                    type="button"
                    className={`ride-type-card ${vehicleType === rt.value ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => est && setVehicleType(rt.value)}
                    disabled={disabled}
                  >
                    <span className="ride-type-icon"><rt.Icon /></span>
                    <span className="ride-type-copy">
                      <strong>{rideTypeLabel(rt.value)}</strong>
                      <span>{disabled ? t("ride.notAvailable") : t(`ride.types.${rt.value}.description`)}</span>
                    </span>
                    <span className="ride-type-fare">
                      {estimating ? "…" : est ? formatUgx(est.fare) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedEstimate ? (
              <p className="ride-hint">
                {t("ride.distanceEta", { km: selectedEstimate.distanceKm.toFixed(1), eta: formatEta(selectedEstimate.durationMin) })}
              </p>
            ) : null}

            <div className="ride-payment-row">
              <button
                type="button"
                className={`ride-payment-pill ${paymentMethod === "cash" ? "is-active" : ""}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <IconCash /> {t("ride.payment.cash")}
              </button>
              <button
                type="button"
                className={`ride-payment-pill ${paymentMethod === "mobile_money" ? "is-active" : ""}`}
                onClick={() => setPaymentMethod("mobile_money")}
              >
                <IconWallet /> {t("ride.payment.mobileMoney")}
              </button>
            </div>
            {paymentMethod === "mobile_money" ? (
              <label className="field">
                <span>{t("ride.payment.mobileMoneyNumber")}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("ride.payment.phonePlaceholder")} />
              </label>
            ) : null}

            {!session ? (
              <Link to={loginPath(location)} className="primary-button" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                {t("ride.signInToRequest")}
              </Link>
            ) : (
              <button type="button" className="primary-button" disabled={submitting || !selectedEstimate} onClick={requestRide}>
                {submitting ? t("ride.requesting") : selectedEstimate ? t("ride.requestRide", { type: rideTypeLabel(vehicleType), fare: formatUgx(selectedEstimate.fare) }) : t("ride.chooseType")}
              </button>
            )}
          </>
        ) : null}

        {stage === "confirm" && trip ? (
          <div className="ride-status-panel">
            <h3>{t("ride.confirm.title")}</h3>
            <p>{t("ride.confirm.subtitle")}</p>

            {trip.driver ? (
              <div className="ride-driver-card">
                <span className="ride-driver-avatar">{(trip.driver.contact?.name || "D").slice(0, 1).toUpperCase()}</span>
                <div className="ride-driver-info">
                  <strong>{trip.driver.contact?.name || t("ride.yourDriver")}</strong>
                  <span>{trip.driver.vehicleModel || rideTypeLabel(trip.vehicleType)} {trip.driver.licensePlate ? `• ${trip.driver.licensePlate}` : ""}</span>
                  {trip.driver.ratingAvg ? <span>★ {Number(trip.driver.ratingAvg).toFixed(1)}</span> : null}
                </div>
              </div>
            ) : null}

            <div className="ride-fare-row">
              <span>{t("ride.estimatedFare")}</span>
              <strong>{formatUgx(trip.estimatedFare)}</strong>
            </div>
            <p className="ride-hint">
              {t("ride.distanceEta", { km: trip.estimatedDistanceKm.toFixed(1), eta: formatEta(trip.estimatedDurationMin) })}
            </p>

            <button type="button" className="primary-button" disabled={confirming} onClick={confirmRide}>
              {confirming ? t("ride.confirm.confirming") : t("ride.confirm.button")}
            </button>
            <button type="button" className="secondary-button" disabled={confirming} onClick={cancelTrip}>{t("ride.cancel")}</button>
          </div>
        ) : null}

        {stage === "live" && trip?.status === "no_drivers_found" ? (
          <div className="ride-status-panel">
            <h3>{t("ride.noDrivers.title")}</h3>
            <p>{t("ride.noDrivers.body")}</p>
            <button type="button" className="primary-button" onClick={() => setStage("choose")}>{t("ride.noDrivers.tryAgain")}</button>
          </div>
        ) : null}

        {stage === "live" && trip && ["completed"].includes(trip.status) ? (
          <div className="ride-status-panel">
            <h3>{t("ride.complete.title")}</h3>
            <p>{t("ride.complete.fare", { fare: formatUgx(trip.finalFare) })}</p>
            <p className="modal-hint">{t("ride.complete.thanks")}</p>
            <button type="button" className="primary-button" onClick={bookAnother}>{t("ride.bookAnother")}</button>
          </div>
        ) : null}

        {stage === "live" && trip && ["cancelled_by_rider", "cancelled_by_driver"].includes(trip.status) ? (
          <div className="ride-status-panel">
            <h3>{t("ride.cancelled.title")}</h3>
            <button type="button" className="primary-button" onClick={bookAnother}>{t("ride.bookAnother")}</button>
          </div>
        ) : null}

        {stage === "live" && trip && hasStatusCopy ? (
          <div className="ride-status-panel">
            <h3>{t(`ride.status.${trip.status}.title`)}</h3>
            <p>{t(`ride.status.${trip.status}.subtitle`)}</p>

            {trip.driver ? (
              <div className="ride-driver-card">
                <span className="ride-driver-avatar">{(trip.driver.contact?.name || "D").slice(0, 1).toUpperCase()}</span>
                <div className="ride-driver-info">
                  <strong>{trip.driver.contact?.name || t("ride.yourDriver")}</strong>
                  <span>{trip.driver.vehicleModel || rideTypeLabel(trip.vehicleType)} {trip.driver.licensePlate ? `• ${trip.driver.licensePlate}` : ""}</span>
                </div>
                {trip.driver.contact?.phone ? (
                  <a className="icon-button" href={`tel:${trip.driver.contact.phone}`} aria-label={t("ride.callDriver")}>
                    <IconPhone />
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="ride-fare-row">
              <span>{t("ride.estimatedFare")}</span>
              <strong>{formatUgx(trip.estimatedFare)}</strong>
            </div>

            {CANCELLABLE_STATUSES.includes(trip.status) ? (
              <button type="button" className="secondary-button" onClick={cancelTrip}>{t("ride.cancelRide")}</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
