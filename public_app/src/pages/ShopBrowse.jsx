import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { findCategoryPath } from "../lib/categories";
import { getCurrentPosition } from "../lib/geolocation";
import { getPreferredDistrict, savePreferredDistrict } from "../lib/userLocation";
import { trackInterest } from "../lib/tracking";
import {
  NEAR_RADIUS_KM,
  PAGE_SIZE,
  SORT_OPTIONS,
  activeFilterCount,
  bucketLabel,
  patchParams,
  prettyKey,
  readFilters,
  toApiParams
} from "../lib/browseFilters";
import ShopNavbar from "../components/shop/ShopNavbar";
import ShopFooterTrust from "../components/shop/ShopFooterTrust";
import BrowseSidebar from "../components/shop/browse/BrowseSidebar";
import BrowseCard from "../components/shop/browse/BrowseCard";
import LocationPicker from "../components/shop/browse/LocationPicker";
import Pagination from "../components/Pagination";
import { IconClose } from "../components/icons";
import { ProductGridSkeleton, SidebarSkeleton, Skel } from "../components/Skeleton";

const GEO_NOTICES = {
  denied: "Location access was declined, so we're showing all of Uganda.",
  unsupported: "This browser can't share your location, so we're showing all of Uganda.",
  timeout: "Couldn't get your location in time, so we're showing all of Uganda.",
  unavailable: "Couldn't determine your location, so we're showing all of Uganda."
};

// The Jiji-style browse page behind /shop/:categoryId: category tree + location + price +
// category-specific attribute filters (with live counts) on the left, results grid on the right.
// All filter state lives in the URL (see lib/browseFilters.js).
// "View all" pages reuse this browse page with no category: a fixed server filter plus a sensible
// default sort (the shopper can still re-sort).
const COLLECTIONS = {
  new: { title: "New arrivals", sort: "newest", params: { newArrivals: "true" } },
  bestsellers: { title: "Best sellers", sort: "bestsellers", params: {} },
  all: { title: "All products", sort: "featured", params: {} }
};

export default function ShopBrowse({ categoryId, collection, session, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const queryKey = searchParams.toString();
  const collectionInfo = collection ? COLLECTIONS[collection] : null;
  const sort = searchParams.get("sort") || collectionInfo?.sort || "featured";
  // With no exact position and no explicit location, arrange products nearest-first around the
  // district the shopper picked (welcome form / location picker). An explicit sort wins.
  const preferred = getPreferredDistrict();
  const arranged = Boolean(preferred) && !filters.near && !filters.district && !filters.everywhere && sort === "featured";

  const [tree, setTree] = useState(null);
  const [coords, setCoords] = useState(null);
  const [geoNotice, setGeoNotice] = useState("");
  const [result, setResult] = useState(null);
  const [facets, setFacets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const apply = (patch) => setSearchParams(patchParams(searchParams, patch));

  useEffect(() => {
    let active = true;
    request("/product-categories")
      .then((data) => active && setTree(data?.items || data || []))
      .catch(() => active && setTree([]));
    return () => {
      active = false;
    };
  }, []);

  // "Near me" needs the browser's position; if it can't be had, fall back to all of Uganda and say why.
  useEffect(() => {
    if (!filters.near || coords) return undefined;
    let active = true;
    getCurrentPosition()
      .then((position) => active && setCoords(position))
      .catch((geoError) => {
        if (!active) return;
        setGeoNotice(GEO_NOTICES[geoError.message] || GEO_NOTICES.unavailable);
        setSearchParams(patchParams(searchParams, { location: {} }), { replace: true });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.near, coords]);

  useEffect(() => {
    if (filters.near && !coords) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    const base = { ...toApiParams(filters, { categoryId: categoryId || null, coords }), ...(collectionInfo?.params || {}), ...(arranged ? { around: preferred } : {}) };
    const listParams = new URLSearchParams({ ...base, page: String(filters.page), limit: String(PAGE_SIZE), sort });
    Promise.all([
      request(`/listings?${listParams.toString()}`),
      request(`/listings/facets?${new URLSearchParams(base).toString()}`).catch(() => null)
    ])
      .then(([list, facetData]) => {
        if (!active) return;
        setResult(list);
        setFacets(facetData);
      })
      .catch((loadError) => active && setError(loadError.message || "Unable to load products."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // queryKey covers every filter; coords arrives asynchronously for "near me".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, collection, queryKey, coords, preferred]);

  useEffect(() => {
    if (categoryId) trackInterest({ type: "category", productCategoryId: categoryId });
  }, [categoryId]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [filters.page, categoryId]);

  const found = findCategoryPath(tree || [], categoryId);
  const node = found?.node;
  const ancestors = found?.ancestors || [];
  const parent = ancestors[ancestors.length - 1];
  const siblings = parent ? parent.children || [] : tree || [];
  const fieldDefs = node?.effectiveListingFields || [];

  const locationLabel = filters.near ? `Near you (${NEAR_RADIUS_KM} km)` : filters.district || (arranged ? `Around ${preferred}` : "All Uganda");
  const widenedAway = result?.widened;
  const locationNote = widenedAway
    ? filters.near
      ? `Nothing within ${NEAR_RADIUS_KM} km, showing the closest results across Uganda.`
      : `No matching ads in ${filters.district}, showing all of Uganda.`
    : geoNotice || (result?.arrangedAround ? `Showing the products closest to ${result.arrangedAround} first.` : "");
  const where = widenedAway ? "Uganda" : filters.near ? "your area" : filters.district || "Uganda";
  const total = result?.total ?? 0;
  const filterCount = activeFilterCount(filters);

  useEffect(() => {
    if (node) document.title = `${node.name} in ${where} for sale | Gabla Shop`;
    else if (collectionInfo) document.title = `${collectionInfo.title} | Gabla Shop`;
  }, [node, where, collectionInfo]);

  const clearAll = () => setSearchParams(patchParams(searchParams, { min: null, max: null, discount: false, attrs: {} }));

  const labelFor = (key) => fieldDefs.find((f) => f.key === key)?.label || prettyKey(key);
  const chips = [];
  if (filters.near || filters.district) chips.push({ id: "loc", text: locationLabel, remove: () => apply({ location: {} }) });
  if (filters.q) chips.push({ id: "q", text: `Search: ${filters.q}`, remove: () => apply({ q: null }) });
  if (filters.min !== null || filters.max !== null) {
    const text = bucketLabel({ min: filters.min, max: filters.max === null ? null : filters.max + 1 });
    chips.push({ id: "price", text: `UGX ${text}`, remove: () => apply({ min: null, max: null }) });
  }
  for (const [key, values] of Object.entries(filters.attrs)) {
    for (const value of values) {
      chips.push({
        id: `${key}:${value}`,
        text: value === "true" ? labelFor(key) : `${labelFor(key)}: ${value}`,
        remove: () => {
          const next = values.filter((v) => v !== value);
          const attrs = { ...filters.attrs, [key]: next };
          if (!next.length) delete attrs[key];
          apply({ attrs });
        }
      });
    }
  }
  if (filters.discount) chips.push({ id: "discount", text: "With discount", remove: () => apply({ discount: false }) });

  // Until the category tree and first facets arrive, show the sidebar's shape rather than a half-empty one.
  const sidebar = tree === null || (loading && !facets) ? (
    <SidebarSkeleton blocks={4} />
  ) : (
    <BrowseSidebar
      node={node}
      ancestors={ancestors}
      siblings={siblings}
      fieldDefs={fieldDefs}
      facets={facets}
      filters={filters}
      onChange={apply}
      onOpenLocation={() => setPickerOpen(true)}
      locationLabel={locationLabel}
      onClearAll={clearAll}
    />
  );

  return (
    <main className="shop-shell">
      <ShopNavbar session={session} onLogout={onLogout} />

      <nav className="breadcrumb">
        <Link to="/shop">Shop</Link>
        {ancestors.map((a) => (
          <React.Fragment key={a.id}>
            <span>/</span>
            <Link to={`/shop/${a.id}`}>{a.name}</Link>
          </React.Fragment>
        ))}
        {node ? (
          <>
            <span>/</span>
            <span className="breadcrumb-current">{node.name}</span>
          </>
        ) : collectionInfo ? (
          <>
            <span>/</span>
            <span className="breadcrumb-current">{collectionInfo.title}</span>
          </>
        ) : null}
      </nav>

      <div className="sb-layout">
        <div className={`sb-side-wrap ${drawerOpen ? "is-open" : ""}`}>
          <div className="sb-drawer-head">
            <strong>Filters</strong>
            <button type="button" className="sb-icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close filters">
              <IconClose />
            </button>
          </div>
          {sidebar}
          <div className="sb-drawer-foot">
            <button type="button" className="sb-apply sb-apply-wide" onClick={() => setDrawerOpen(false)}>
              Show {total.toLocaleString()} results
            </button>
          </div>
        </div>
        {drawerOpen ? <div className="sb-scrim" onClick={() => setDrawerOpen(false)} /> : null}

        <section className="sb-results">
          <header className="sb-results-head">
            <div>
              {tree === null && !collectionInfo ? (
                <Skel h={28} w={280} />
              ) : (
                <h1>
                  {filters.q ? `Results for “${filters.q}”` : `${node ? node.name : collectionInfo ? collectionInfo.title : "Products"} in ${where}`}
                </h1>
              )}
              {loading && !result ? (
                <Skel h={14} w={90} style={{ marginTop: 10 }} />
              ) : (
                <p className="sb-count">{`${total.toLocaleString()} result${total === 1 ? "" : "s"}`}</p>
              )}
            </div>
            <div className="sb-head-actions">
              <button type="button" className="sb-filter-btn" onClick={() => setDrawerOpen(true)}>
                Filters{filterCount ? ` (${filterCount})` : ""}
              </button>
              <label className="sb-sort">
                <span>Sort</span>
                <select value={sort} onChange={(event) => apply({ sort: event.target.value === (collectionInfo?.sort || "featured") ? null : event.target.value })}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          {chips.length ? (
            <div className="sb-chips">
              {chips.map((chip) => (
                <button key={chip.id} type="button" className="sb-chip" onClick={chip.remove}>
                  {chip.text}
                  <IconClose width={12} height={12} />
                </button>
              ))}
              {chips.length > 1 ? (
                <button type="button" className="sb-link-btn" onClick={() => setSearchParams(new URLSearchParams())}>
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}

          {locationNote ? <p className="sb-banner">{locationNote}</p> : null}
          {error ? <div className="error-message home-error">{error}</div> : null}

          {loading && !result ? (
            <ProductGridSkeleton count={8} />
          ) : result?.items?.length ? (
            <div className={`sb-grid ${loading ? "is-loading" : ""}`}>
              {result.items.map((listing) => (
                <BrowseCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : !error ? (
            <div className="sb-empty">
              <h2>No products match</h2>
              <p>Try removing a filter or choosing a wider location.</p>
              {chips.length ? (
                <button type="button" className="sb-apply" onClick={() => setSearchParams(new URLSearchParams())}>
                  Clear all filters
                </button>
              ) : (
                <Link to="/shop" className="sb-apply">
                  Back to shop
                </Link>
              )}
            </div>
          ) : null}

          <Pagination page={filters.page} limit={PAGE_SIZE} total={total} onPageChange={(page) => apply({ page })} />
        </section>
      </div>

      {pickerOpen ? (
        <LocationPicker
          districts={facets?.districts || []}
          current={{ district: filters.district, near: filters.near, everywhere: filters.everywhere }}
          preferred={preferred}
          onClose={() => setPickerOpen(false)}
          onSelect={(selection) => {
            setGeoNotice("");
            if (selection.district) savePreferredDistrict(selection.district);
            apply({ location: selection });
            setPickerOpen(false);
          }}
        />
      ) : null}

      <ShopFooterTrust />
    </main>
  );
}
