import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { request } from "../lib/api";
import { getSession } from "../lib/session";
import { loadGoogleMaps } from "../lib/maps";
import { getActiveTripId, setActiveTripId, clearActiveTripId } from "../lib/activeRide";
import { IconBike, IconCar, IconCash, IconChevronLeft, IconPhone, IconTarget, IconWallet } from "../components/icons";

// Kampala — used only when geolocation is unavailable/denied, purely as a starting map center.
const DEFAULT_CENTER = { lat: 0.3476, lng: 32.5825 };
const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ["completed", "cancelled_by_rider", "cancelled_by_driver", "no_drivers_found"];
const CANCELLABLE_STATUSES = ["searching", "matched", "arrived"];

const RIDE_TYPES = [
  { value: "boda", label: "Boda", description: "Quick & affordable", Icon: IconBike },
  { value: "car", label: "Car", description: "Comfortable ride", Icon: IconCar }
];

const formatUgx = (value) => `UGX ${Number(value || 0).toLocaleString()}`;
const formatEta = (min) => (min < 1 ? "under a minute" : `${Math.round(min)} min`);

const STATUS_COPY = {
  searching: { title: "Finding your driver…", subtitle: "This usually takes a few seconds." },
  matched: { title: "Driver is on the way", subtitle: "Track them below." },
  arrived: { title: "Your driver has arrived", subtitle: "Head out when you're ready." },
  in_progress: { title: "On your way", subtitle: "Enjoy the ride." }
};

export default function Ride() {
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
        if (active) setMapsError(e.message || "Map is not available right now.");
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
    setPickupText(point.address || "Dropped pin");
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
    setDropoffText(point.address || "Dropped pin");
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
      RIDE_TYPES.map((t) =>
        request("/rides/estimate", {
          method: "POST",
          body: JSON.stringify({ vehicleType: t.value, pickup, dropoff })
        }).then((result) => [t.value, result])
      )
    ).then((results) => {
      if (!active) return;
      const next = {};
      for (const r of results) {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      }
      setEstimates(next);
      if (!next[vehicleType]) {
        const firstAvailable = RIDE_TYPES.find((t) => next[t.value]);
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
        setError("Your session expired. Sign in again to keep tracking this ride.");
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
      navigate("/login");
      return;
    }
    if (paymentMethod === "mobile_money" && !phone.trim()) {
      setError("Enter the phone number to pay from.");
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
      setError(submitError.message || "Unable to request a ride right now.");
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
      setError(confirmError.message || "Unable to confirm this ride.");
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
      setError(cancelError.message || "Unable to cancel this trip.");
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
  const statusCopy = trip ? STATUS_COPY[trip.status] : null;

  return (
    <main className="ride-shell">
      <div className="ride-topbar">
        <button type="button" className="icon-button" aria-label="Back" onClick={() => navigate("/home")}>
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
                  placeholder="Pickup location"
                  onFocus={() => (activeFieldRef.current = "pickup")}
                  onChange={(e) => setPickupText(e.target.value)}
                />
                <button type="button" className="icon-button" aria-label="Use current location" onClick={() => useMyLocation()} disabled={locating}>
                  <IconTarget />
                </button>
              </div>
              <div className="ride-address-row">
                <span className="ride-address-dot ride-address-dot-dropoff" />
                <input
                  ref={dropoffInputRef}
                  value={dropoffText}
                  placeholder="Where to?"
                  onFocus={() => (activeFieldRef.current = "dropoff")}
                  onChange={(e) => setDropoffText(e.target.value)}
                />
              </div>
            </div>
            <p className="ride-hint">Search an address, or tap the map to drop a pin.</p>
            <button type="button" className="primary-button" disabled={!pickup || !dropoff} onClick={chooseRide}>
              Choose a ride
            </button>
          </>
        ) : null}

        {stage === "choose" ? (
          <>
            <button type="button" className="ride-edit-link" onClick={() => setStage("setup")}>
              &larr; Edit pickup &amp; drop-off
            </button>

            <div className="ride-type-list">
              {RIDE_TYPES.map((t) => {
                const est = estimates[t.value];
                const disabled = !estimating && !est;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`ride-type-card ${vehicleType === t.value ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                    onClick={() => est && setVehicleType(t.value)}
                    disabled={disabled}
                  >
                    <span className="ride-type-icon"><t.Icon /></span>
                    <span className="ride-type-copy">
                      <strong>{t.label}</strong>
                      <span>{disabled ? "Not available right now" : t.description}</span>
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
                ~{selectedEstimate.distanceKm.toFixed(1)} km &middot; {formatEta(selectedEstimate.durationMin)}
              </p>
            ) : null}

            <div className="ride-payment-row">
              <button
                type="button"
                className={`ride-payment-pill ${paymentMethod === "cash" ? "is-active" : ""}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <IconCash /> Cash
              </button>
              <button
                type="button"
                className={`ride-payment-pill ${paymentMethod === "mobile_money" ? "is-active" : ""}`}
                onClick={() => setPaymentMethod("mobile_money")}
              >
                <IconWallet /> Mobile Money
              </button>
            </div>
            {paymentMethod === "mobile_money" ? (
              <label className="field">
                <span>Mobile money number</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +256 700 000000" />
              </label>
            ) : null}

            {!session ? (
              <Link to="/login" className="primary-button" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Sign in to request a ride
              </Link>
            ) : (
              <button type="button" className="primary-button" disabled={submitting || !selectedEstimate} onClick={requestRide}>
                {submitting ? "Requesting…" : selectedEstimate ? `Request ${RIDE_TYPES.find((t) => t.value === vehicleType)?.label} • ${formatUgx(selectedEstimate.fare)}` : "Choose a ride type"}
              </button>
            )}
          </>
        ) : null}

        {stage === "confirm" && trip ? (
          <div className="ride-status-panel">
            <h3>We found you a driver</h3>
            <p>Review their details, then confirm to send the request.</p>

            {trip.driver ? (
              <div className="ride-driver-card">
                <span className="ride-driver-avatar">{(trip.driver.contact?.name || "D").slice(0, 1).toUpperCase()}</span>
                <div className="ride-driver-info">
                  <strong>{trip.driver.contact?.name || "Your driver"}</strong>
                  <span>{trip.driver.vehicleModel || trip.vehicleType} {trip.driver.licensePlate ? `• ${trip.driver.licensePlate}` : ""}</span>
                  {trip.driver.ratingAvg ? <span>★ {Number(trip.driver.ratingAvg).toFixed(1)}</span> : null}
                </div>
              </div>
            ) : null}

            <div className="ride-fare-row">
              <span>Estimated fare</span>
              <strong>{formatUgx(trip.estimatedFare)}</strong>
            </div>
            <p className="ride-hint">
              ~{trip.estimatedDistanceKm.toFixed(1)} km &middot; {formatEta(trip.estimatedDurationMin)}
            </p>

            <button type="button" className="primary-button" disabled={confirming} onClick={confirmRide}>
              {confirming ? "Confirming…" : "Confirm this driver"}
            </button>
            <button type="button" className="secondary-button" disabled={confirming} onClick={cancelTrip}>Cancel</button>
          </div>
        ) : null}

        {stage === "live" && trip?.status === "no_drivers_found" ? (
          <div className="ride-status-panel">
            <h3>No drivers nearby</h3>
            <p>We couldn&apos;t find a driver right now. Try again in a moment.</p>
            <button type="button" className="primary-button" onClick={() => setStage("choose")}>Try again</button>
          </div>
        ) : null}

        {stage === "live" && trip && ["completed"].includes(trip.status) ? (
          <div className="ride-status-panel">
            <h3>Trip complete</h3>
            <p>Fare: {formatUgx(trip.finalFare)}</p>
            <p className="modal-hint">Thanks for riding with Gabla.</p>
            <button type="button" className="primary-button" onClick={bookAnother}>Book another ride</button>
          </div>
        ) : null}

        {stage === "live" && trip && ["cancelled_by_rider", "cancelled_by_driver"].includes(trip.status) ? (
          <div className="ride-status-panel">
            <h3>Trip cancelled</h3>
            <button type="button" className="primary-button" onClick={bookAnother}>Book another ride</button>
          </div>
        ) : null}

        {stage === "live" && trip && statusCopy ? (
          <div className="ride-status-panel">
            <h3>{statusCopy.title}</h3>
            <p>{statusCopy.subtitle}</p>

            {trip.driver ? (
              <div className="ride-driver-card">
                <span className="ride-driver-avatar">{(trip.driver.contact?.name || "D").slice(0, 1).toUpperCase()}</span>
                <div className="ride-driver-info">
                  <strong>{trip.driver.contact?.name || "Your driver"}</strong>
                  <span>{trip.driver.vehicleModel || trip.vehicleType} {trip.driver.licensePlate ? `• ${trip.driver.licensePlate}` : ""}</span>
                </div>
                {trip.driver.contact?.phone ? (
                  <a className="icon-button" href={`tel:${trip.driver.contact.phone}`} aria-label="Call driver">
                    <IconPhone />
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="ride-fare-row">
              <span>Estimated fare</span>
              <strong>{formatUgx(trip.estimatedFare)}</strong>
            </div>

            {CANCELLABLE_STATUSES.includes(trip.status) ? (
              <button type="button" className="secondary-button" onClick={cancelTrip}>Cancel ride</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
