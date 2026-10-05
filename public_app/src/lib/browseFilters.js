// URL <-> filter state for the Shop browse page. The URL is the single source of truth, so every
// filtered view is shareable/bookmarkable and Back/Forward just work:
//   ?district=Kampala | ?near=1  &min=100000 &max=900000 &discount=1 &sort=price_asc &page=2
//   &a.brand=HP&a.brand=Dell&a.condition=Used     (a.<fieldKey> repeated per chosen value)

export const NEAR_RADIUS_KM = 15;
export const PAGE_SIZE = 24;

export const SORT_OPTIONS = [
  { value: "featured", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Cheapest" },
  { value: "price_desc", label: "Most expensive" },
  { value: "bestsellers", label: "Best selling" }
];

export const readFilters = (searchParams) => {
  const attrs = {};
  for (const key of new Set(searchParams.keys())) {
    if (!key.startsWith("a.")) continue;
    const values = searchParams.getAll(key).filter(Boolean);
    if (values.length) attrs[key.slice(2)] = values;
  }
  const num = (name) => {
    const raw = searchParams.get(name);
    return raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  return {
    q: (searchParams.get("q") || "").trim(),
    district: searchParams.get("district") || "",
    near: searchParams.get("near") === "1",
    // Explicitly chose "All Uganda" - so the default of arranging around their own district is off.
    everywhere: searchParams.get("loc") === "all",
    min: num("min"),
    max: num("max"),
    discount: searchParams.get("discount") === "1",
    sort: searchParams.get("sort") || "featured",
    page: Math.max(1, num("page") || 1),
    attrs
  };
};

// Applies a patch to the current params. Any change other than `page` resets to page 1, since the
// old page number is meaningless against a different result set.
export const patchParams = (searchParams, patch) => {
  const next = new URLSearchParams(searchParams);
  const set = (name, value) => {
    if (value === null || value === undefined || value === "" || value === false) next.delete(name);
    else next.set(name, value === true ? "1" : String(value));
  };
  for (const [name, value] of Object.entries(patch)) {
    if (name === "attrs") {
      for (const key of [...next.keys()]) if (key.startsWith("a.")) next.delete(key);
      for (const [attrKey, values] of Object.entries(value || {})) for (const v of values) next.append(`a.${attrKey}`, v);
    } else if (name === "location") {
      next.delete("district");
      next.delete("near");
      next.delete("loc");
      if (value?.district) next.set("district", value.district);
      if (value?.near) next.set("near", "1");
      if (value?.everywhere) next.set("loc", "all");
    } else {
      set(name, value);
    }
  }
  if (!("page" in patch)) next.delete("page");
  return next;
};

// Query for /listings and /listings/facets - identical filters, which is what keeps the sidebar
// counts honest with respect to the grid.
export const toApiParams = (filters, { categoryId, coords }) => {
  const params = { type: "product" };
  if (categoryId) params.productCategoryId = categoryId;
  if (filters.q) params.q = filters.q;
  if (filters.min !== null) params.minPrice = String(filters.min);
  if (filters.max !== null) params.maxPrice = String(filters.max);
  if (filters.discount) params.discountOnly = "true";
  if (Object.keys(filters.attrs).length) params.attrs = JSON.stringify(filters.attrs);
  if (filters.near && coords) {
    params.lat = String(coords.lat);
    params.lng = String(coords.lng);
    params.radiusKm = String(NEAR_RADIUS_KM);
  } else if (filters.district) {
    params.district = filters.district;
  }
  return params;
};

export const activeFilterCount = (filters) =>
  Object.values(filters.attrs).reduce((n, v) => n + v.length, 0) +
  (filters.min !== null || filters.max !== null ? 1 : 0) +
  (filters.discount ? 1 : 0);

// 35000 -> "35 K", 1500000 -> "1.5 M"
export const shortMoney = (n) => {
  const trim = (x) => String(Math.round(x * 10) / 10).replace(/\.0$/, "");
  if (n >= 1_000_000) return `${trim(n / 1_000_000)} M`;
  if (n >= 1_000) return `${trim(n / 1_000)} K`;
  return String(n);
};

export const bucketLabel = ({ min, max }) => {
  if (min === null) return `Under ${shortMoney(max)}`;
  if (max === null) return `More than ${shortMoney(min)}`;
  return `${shortMoney(min)} - ${shortMoney(max)}`;
};

// "internalStorage" -> "Internal Storage" (fallback label when the category defines no field for a key).
export const prettyKey = (key) =>
  key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

// A few short answers to show as chips on a card, most meaningful first.
const CARD_TAG_KEYS = ["condition", "yearOfManufacture", "transmission", "internalStorage", "ram", "storageCapacity", "screenSize", "size", "fuel", "type", "brand"];
export const cardTags = (customFields = {}, limit = 3) => {
  const tags = [];
  for (const key of CARD_TAG_KEYS) {
    const raw = customFields[key];
    if (raw === undefined || raw === null || raw === "" || typeof raw === "boolean") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === "") continue;
    const text = String(value);
    if (text.length > 22 || tags.includes(text)) continue;
    tags.push(text);
    if (tags.length >= limit) break;
  }
  return tags;
};
