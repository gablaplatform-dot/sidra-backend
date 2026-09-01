import { env } from "../config/env.js";

// Wraps Google's Routes API (the current, recommended replacement for the legacy Directions
// API) to get real road distance/duration/polyline for a pickup -> dropoff pair. Every call site
// must treat a null return as "not available" and fall back to a straight-line estimate - this
// service is not required for the ride flow to function, only to make it more accurate.
export class RoutingService {
  async computeRoute({ originLat, originLng, destLat, destLng }) {
    if (!env.googleRoutesApiKey) return null;

    let response;
    try {
      response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env.googleRoutesApiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
          destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
          travelMode: "DRIVE"
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      return null;
    }

    if (!response.ok) return null;

    let data;
    try {
      data = await response.json();
    } catch {
      return null;
    }

    const route = data?.routes?.[0];
    if (!route || typeof route.distanceMeters !== "number" || !route.duration) return null;

    const durationSeconds = Number.parseFloat(String(route.duration).replace("s", ""));
    if (!Number.isFinite(durationSeconds)) return null;

    return {
      distanceKm: route.distanceMeters / 1000,
      durationMin: durationSeconds / 60,
      polyline: route.polyline?.encodedPolyline ?? null
    };
  }
}
