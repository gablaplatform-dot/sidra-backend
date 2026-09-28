import { prisma } from "../config/db.js";
import { geohashSearchCells, haversineDistanceKm } from "../utils/geohash.js";

const GEOHASH_PRECISION_FINE = 6; // ~1.2km x 0.6km cells - used for tight radii
const GEOHASH_PRECISION_COARSE = 5; // ~4.9km x 4.9km cells - used for wider radii
const MAX_RAW_PROVIDER_CANDIDATES = 1000; // hygiene cap on the raw candidate query, geohash or not
const MAX_NEARBY_PROVIDERS = 200; // the real cost bound: only this many CLOSEST providers ever
// get returned, however many candidates the raw query returned

// Shared by listing.service.js (products inherit their provider's location) and
// promotion.service.js (provider ads, same distance-ranking need) - lifted out once a second
// caller needed it, rather than a second copy-paste of the same geohash-candidate-then-haversine
// logic. Returns providers sorted nearest-first and capped to MAX_NEARBY_PROVIDERS - sorting
// before capping matters: capping by raw DB order (or any other tiebreak) would silently let a
// farther provider crowd out a closer one once a dense area exceeds the cap.
export async function findNearbyProviderIds({ lat, lng, radiusKm, useGeohash }) {
  const where = { isApproved: true, moderationStatus: "approved", lat: { not: null }, lng: { not: null } };
  if (useGeohash) {
    const precision = radiusKm <= 2 ? GEOHASH_PRECISION_FINE : GEOHASH_PRECISION_COARSE;
    where[precision === GEOHASH_PRECISION_FINE ? "geohash6" : "geohash5"] = {
      in: geohashSearchCells(lat, lng, precision)
    };
  }

  const candidates = await prisma.provider.findMany({
    where,
    select: { id: true, lat: true, lng: true },
    take: MAX_RAW_PROVIDER_CANDIDATES
  });

  const withinRadius = [];
  for (const candidate of candidates) {
    const distanceKm = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (distanceKm <= radiusKm) withinRadius.push({ id: candidate.id, distanceKm });
  }
  withinRadius.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = withinRadius.slice(0, MAX_NEARBY_PROVIDERS);

  return {
    orderedIds: nearest.map((p) => p.id),
    distanceById: new Map(nearest.map((p) => [p.id, p.distanceKm]))
  };
}
