// Standard base32 geohash encode/neighbor implementation. This is what makes driver matching an
// indexed lookup over a handful of cells instead of a distance comparison against every driver:
// encode a location to a short string, index that string, and "nearby" becomes "same string
// prefix, or one of its 8 neighbors" - a WHERE ... IN (...) query the DB can actually use an
// index for.
//
// Precision -> approximate cell size (at the equator, cells narrow toward the poles):
//   5 -> ~4.9km x 4.9km   (coarse fallback bucket)
//   6 -> ~1.2km x 0.61km  (primary bucket most searches resolve against)
//   7 -> ~153m x 153m     (fine-grained, not currently used but available)

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohashEncode(lat, lng, precision = 6) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngRange[0] = mid;
      } else {
        ch = ch << 1;
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latRange[0] = mid;
      } else {
        ch = ch << 1;
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;
    bit += 1;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

const decodeBounds = (geohash) => {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let evenBit = true;
  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    for (let i = 4; i >= 0; i -= 1) {
      const bit = (idx >> i) & 1;
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (bit === 1) lngRange[0] = mid;
        else lngRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (bit === 1) latRange[0] = mid;
        else latRange[1] = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latRange, lngRange };
};

// The 8 geohashes surrounding (and including, via the caller) the given one - N/S/E/W plus the
// 4 diagonals. Used to build the small candidate cell set for a proximity search.
export function geohashNeighbors(geohash) {
  const { latRange, lngRange } = decodeBounds(geohash);
  const latCenter = (latRange[0] + latRange[1]) / 2;
  const lngCenter = (lngRange[0] + lngRange[1]) / 2;
  const latSpan = latRange[1] - latRange[0];
  const lngSpan = lngRange[1] - lngRange[0];
  const precision = geohash.length;

  const offsets = [
    [1, -1], [1, 0], [1, 1],
    [0, -1], [0, 1],
    [-1, -1], [-1, 0], [-1, 1]
  ];

  const neighbors = [];
  for (const [dLat, dLng] of offsets) {
    let lat = latCenter + dLat * latSpan;
    let lng = lngCenter + dLng * lngSpan;
    // Clamp latitude (no wraparound at the poles); wrap longitude around the antimeridian.
    lat = Math.max(-90, Math.min(90, lat));
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    neighbors.push(geohashEncode(lat, lng, precision));
  }
  return neighbors;
}

// All cells worth querying for a "near this point" search: the point's own cell plus its 8
// neighbors, deduplicated (cells can coincide near the poles or after longitude wraparound).
export function geohashSearchCells(lat, lng, precision) {
  const center = geohashEncode(lat, lng, precision);
  const cells = new Set([center, ...geohashNeighbors(center)]);
  return Array.from(cells);
}

const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in km - only ever run against the small candidate set a geohash cell
// query returns, never against every driver in the table.
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
