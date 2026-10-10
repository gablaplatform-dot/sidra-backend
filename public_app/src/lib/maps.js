export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

let googleMapsLoadPromise;
export const loadGoogleMaps = () => {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error("Map is not configured."));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load the map"));
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
};

// Where maps open when we don't know where the person is (no location permission): Kampala.
export const KAMPALA = { lat: 0.3476, lng: 32.5825 };

// A calm, uncluttered basemap: soft land and water, no points of interest competing with the pin.
export const CLEAN_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f3f5f8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe3f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffe4cf" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6b86" }] }
];

// "Plot 12 Kira Road, Kampala, Uganda" -> "Plot 12 Kira Road, Kampala": the country adds nothing here.
export const tidyAddress = (text) => String(text || "").replace(/,\s*Uganda\s*$/i, "").trim();

const component = (result, ...types) => (result.address_components || []).find((c) => types.some((t) => c.types.includes(t)));
const isPlusCode = (result) => Boolean(component(result, "plus_code")) || /^[0-9A-Z]{4,}\+[0-9A-Z]{2,}/.test(result.formatted_address || "");
// Ugandan addresses are often a plot or house number on an unnamed road ("Kabowa 14782"): readable only with a real street name.
const hasRealStreet = (result) => {
  const route = component(result, "route")?.long_name || "";
  return route && !/\d{3,}/.test(route);
};

// Turns a map position into a place name. Plus codes ("8HXJ+2XQ") and numbered plots mean nothing to a rider,
// so the first result with a real street name wins; otherwise the name is built from the area and city
// ("Kawempe Division, Kampala"). Resolves null when the lookup fails.
export const reverseGeocode = (google, lat, lng) =>
  new Promise((resolve) => {
    try {
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.length) {
          resolve(null);
          return;
        }
        // Later results drift further from the pin, so only the closest few may name the street.
        const named = results.slice(0, 3).find((r) => !isPlusCode(r) && hasRealStreet(r));
        if (named) {
          resolve(tidyAddress(named.formatted_address));
          return;
        }
        const base = results[0];
        const area = component(base, "sublocality_level_1", "sublocality", "neighborhood", "political")?.long_name;
        const city = component(base, "locality", "administrative_area_level_2")?.long_name;
        const parts = [area, city].filter((v, i, all) => v && all.indexOf(v) === i);
        resolve(parts.length ? parts.join(", ") : tidyAddress(results[0].formatted_address));
      });
    } catch {
      resolve(null);
    }
  });
