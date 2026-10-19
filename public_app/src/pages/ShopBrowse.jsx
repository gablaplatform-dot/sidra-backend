import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
import SiteHeader from "../components/SiteHeader";
import ShopFooterTrust from "../components/shop/ShopFooterTrust";
import BrowseSidebar from "../components/shop/browse/BrowseSidebar";
import BrowseCard from "../components/shop/browse/BrowseCard";
import LocationPicker from "../components/shop/browse/LocationPicker";
import LayoutToggle from "../components/shop/browse/LayoutToggle";
import { useListLayout } from "../lib/listLayout";
import Pagination from "../components/Pagination";
import { IconClose, IconPin } from "../components/icons";
import { ProductGridSkeleton, SidebarSkeleton, Skel } from "../components/Skeleton";

// Geolocation error codes (from lib/geolocation); shown as shop.browse.geo.<code>.
const GEO_NOTICE_CODES = ["denied", "unsupported", "timeout", "unavailable"];

// The Jiji-style browse page behind /shop/:categoryId: category tree + location + price +
// category-specific attribute filters (with live counts) on the left, results grid on the right.
// All filter state lives in the URL (see lib/browseFilters.js).
// "View all" pages reuse this browse page with no category: a fixed server filter plus a sensible
// default sort (the shopper can still re-sort).
// The title is looked up at render time: shop.browse.collection.<key>.
const COLLECTIONS = {
  new: { sort: "newest", params: { newArrivals: "true" } },
  bestsellers: { sort: "bestsellers", params: {} },
  all: { sort: "featured", params: {} }
};

export default function ShopBrowse({ categoryId, collection, session, onLogout, kind = "product" }) {
  const { t } = useTranslation();
  // The same browse page serves services (their own category tree, /services/c/:id); only the
  // endpoint, links and wording change.
  const isService = kind === "service";
  const basePath = isService ? "/services/c" : "/shop";
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useListLayout();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const queryKey = searchParams.toString();
  const collectionInfo = collection ? COLLECTIONS[collection] : null;
  const collectionTitle = collectionInfo ? t(`shop.browse.collection.${collection}`) : "";
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
    request(isService ? "/service-categories" : "/product-categories")
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
        setGeoNotice(t(`shop.browse.geo.${GEO_NOTICE_CODES.includes(geoError.message) ? geoError.message : "unavailable"}`));
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
    const base = { ...toApiParams(filters, { categoryId: categoryId || null, coords, kind }), ...(collectionInfo?.params || {}), ...(arranged ? { around: preferred } : {}) };
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
      .catch((loadError) => active && setError(loadError.message || t(isService ? "shop.browse.loadErrorServices" : "shop.browse.loadErrorProducts")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // queryKey covers every filter; coords arrives asynchronously for "near me".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, collection, queryKey, coords, preferred]);

  useEffect(() => {
    if (categoryId && !isService) trackInterest({ type: "category", productCategoryId: categoryId });
  }, [categoryId, isService]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [filters.page, categoryId]);

  const found = findCategoryPath(tree || [], categoryId);
  const node = found?.node;
  const ancestors = found?.ancestors || [];
  const parent = ancestors[ancestors.length - 1];
  const siblings = parent ? parent.children || [] : tree || [];
  const fieldDefs = node?.effectiveListingFields || [];

  const locationLabel = filters.near
    ? t("shop.browse.nearYou", { km: NEAR_RADIUS_KM })
    : filters.district || (arranged ? t("shop.browse.around", { district: preferred }) : t("shop.browse.allUganda"));
  const widenedAway = result?.widened;
  const locationNote = widenedAway
    ? filters.near
      ? t("shop.browse.widenedNear", { km: NEAR_RADIUS_KM })
      : t("shop.browse.widenedDistrict", { district: filters.district })
    : geoNotice || (result?.arrangedAround ? t(isService ? "shop.browse.arrangedServices" : "shop.browse.arrangedProducts", { place: result.arrangedAround }) : "");
  const where = widenedAway ? t("shop.browse.whereUganda") : filters.near ? t("shop.browse.whereYourArea") : filters.district || t("shop.browse.whereUganda");
  const total = result?.total ?? 0;
  const filterCount = activeFilterCount(filters);

  useEffect(() => {
    if (node) document.title = t(isService ? "shop.meta.browseService" : "shop.meta.browseProduct", { name: node.name, where });
    else if (collectionInfo) document.title = t("shop.meta.collection", { title: collectionTitle });
  }, [node, where, collectionInfo, collectionTitle]);

  const clearAll = () => setSearchParams(patchParams(searchParams, { min: null, max: null, discount: false, attrs: {} }));

  const labelFor = (key) => fieldDefs.find((f) => f.key === key)?.label || prettyKey(key);
  const chips = [];
  if (filters.near || filters.district) chips.push({ id: "loc", text: locationLabel, remove: () => apply({ location: {} }) });
  if (filters.q) chips.push({ id: "q", text: t("shop.browse.searchChip", { q: filters.q }), remove: () => apply({ q: null }) });
  if (filters.min !== null || filters.max !== null) {
    const text = bucketLabel({ min: filters.min, max: filters.max === null ? null : filters.max + 1 });
    chips.push({ id: "price", text: t("shop.browse.priceChip", { range: text }), remove: () => apply({ min: null, max: null }) });
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
  if (filters.discount) chips.push({ id: "discount", text: t("shop.browse.discountChip"), remove: () => apply({ discount: false }) });

  // Until the category tree and first facets arrive, show the sidebar's shape rather than a half-empty one.
  const sidebar = tree === null || (loading && !facets) ? (
    <SidebarSkeleton blocks={4} />
  ) : (
    <BrowseSidebar
      node={node}
      ancestors={ancestors}
      siblings={siblings}
      fieldDefs={fieldDefs}
      facets={isService && facets ? { ...facets, categoryCounts: facets.serviceCategoryCounts || {} } : facets}
      basePath={basePath}
      rootPath={isService ? "/services" : "/shop/categories"}
      filters={filters}
      onChange={apply}
      onOpenLocation={() => setPickerOpen(true)}
      locationLabel={locationLabel}
      hideLocation
      onClearAll={clearAll}
    />
  );

  return (
    <main className="shop-shell">
      {isService ? <SiteHeader session={session} onLogout={onLogout} /> : <ShopNavbar session={session} onLogout={onLogout} />}

      <nav className="breadcrumb">
        <Link to={isService ? "/services" : "/shop"}>{isService ? t("shop.browse.breadcrumbServices") : t("shop.browse.breadcrumbShop")}</Link>
        {ancestors.map((a) => (
          <React.Fragment key={a.id}>
            <span>/</span>
            <Link to={`${basePath}/${a.id}`}>{a.name}</Link>
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
            <span className="breadcrumb-current">{collectionTitle}</span>
          </>
        ) : null}
      </nav>

      <div className="sb-layout">
        <div className={`sb-side-wrap ${drawerOpen ? "is-open" : ""}`}>
          <div className="sb-drawer-head">
            <strong>{t("shop.browse.filters")}</strong>
            <button type="button" className="sb-icon-btn" onClick={() => setDrawerOpen(false)} aria-label={t("shop.browse.closeFilters")}>
              <IconClose />
            </button>
          </div>
          {sidebar}
          <div className="sb-drawer-foot">
            <button type="button" className="sb-apply sb-apply-wide" onClick={() => setDrawerOpen(false)}>
              {t("shop.browse.showResults", { count: total, n: total.toLocaleString() })}
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
                  {filters.q
                    ? t("shop.browse.resultsFor", { q: filters.q })
                    : t("shop.browse.titleIn", {
                        name: node ? node.name : collectionInfo ? collectionTitle : isService ? t("shop.browse.allServices") : t("shop.browse.products"),
                        where
                      })}
                </h1>
              )}
              {loading && !result ? (
                <Skel h={14} w={90} style={{ marginTop: 10 }} />
              ) : (
                <p className="sb-count">{t("shop.browse.count", { count: total, n: total.toLocaleString() })}</p>
              )}
            </div>
            <div className="sb-head-actions">
              <button type="button" className={`sb-loc-btn ${filters.near || filters.district ? "is-set" : ""}`} onClick={() => setPickerOpen(true)} aria-label={t("shop.browse.locationAria", { label: locationLabel })}>
                <IconPin width={18} height={18} />
                <span>
                  <small>{t("shop.browse.location")}</small>
                  <b>{locationLabel}</b>
                </span>
                <i aria-hidden="true" />
              </button>
              <button type="button" className="sb-filter-btn" onClick={() => setDrawerOpen(true)}>
                {filterCount ? t("shop.browse.filtersBtn", { count: filterCount }) : t("shop.browse.filters")}
              </button>
              <label className="sb-sort">
                <span>{t("shop.browse.sort_label")}</span>
                <select value={sort} onChange={(event) => apply({ sort: event.target.value === (collectionInfo?.sort || "featured") ? null : event.target.value })}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <LayoutToggle value={layout} onChange={setLayout} />
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
                  {t("shop.browse.clearAll")}
                </button>
              ) : null}
            </div>
          ) : null}

          {locationNote ? <p className="sb-banner">{locationNote}</p> : null}
          {error ? <div className="error-message home-error">{error}</div> : null}

          {loading && !result ? (
            <ProductGridSkeleton count={8} className={`sb-grid ${layout === "list" ? "is-list" : ""}`} />
          ) : result?.items?.length ? (
            <div className={`sb-grid ${layout === "list" ? "is-list" : ""} ${loading ? "is-loading" : ""}`}>
              {result.items.map((listing) => (
                <BrowseCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : !error ? (
            <div className="sb-empty">
              <h2>{t(isService ? "shop.browse.noMatchServices" : "shop.browse.noMatchProducts")}</h2>
              <p>{t("shop.browse.tryRemoving")}</p>
              {chips.length ? (
                <button type="button" className="sb-apply" onClick={() => setSearchParams(new URLSearchParams())}>
                  {t("shop.browse.clearAllFilters")}
                </button>
              ) : (
                <Link to={isService ? "/services" : "/shop"} className="sb-apply">
                  {isService ? t("shop.browse.backToServices") : t("shop.browse.backToShop")}
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

      {isService ? null : <ShopFooterTrust />}
    </main>
  );
}
