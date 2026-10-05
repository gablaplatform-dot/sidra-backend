import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { request } from "../lib/api";
import { findCategoryPath } from "../lib/categories";
import { SORT_OPTIONS, activeFilterCount, bucketLabel, patchParams, prettyKey, readFilters, toApiParams } from "../lib/browseFilters";
import BrowseSidebar from "./shop/browse/BrowseSidebar";
import BrowseCard from "./shop/browse/BrowseCard";
import Pagination from "./Pagination";
import { IconBox, IconClose } from "./icons";
import { ProductGridSkeleton, SidebarSkeleton, Skel } from "./Skeleton";

const PRODUCT_PAGE_SIZE = 12;

const subtreeCount = (node, counts) =>
  (counts[node.id] || 0) + (node.children || []).reduce((sum, child) => sum + subtreeCount(child, counts), 0);

// True when `id` is `node` or sits anywhere beneath it.
const containsId = (node, id) => node.id === id || (node.children || []).some((child) => containsId(child, id));

// Provider-page category filter: selects in place (no navigation), shows only branches that hold
// products, and opens the branch that contains the current selection.
function ProviderCategoryBlock({ tree, counts, selectedId, total, onSelect }) {
  const branches = tree.map((node) => ({ node, count: subtreeCount(node, counts) })).filter((b) => b.count > 0);
  if (!branches.length) return null;
  return (
    <section className="sb-block sb-block-categories">
      <h2 className="sb-block-head">Categories</h2>
      <div className="sb-block-body">
        <button type="button" className={`sb-cat-link sb-cat-btn ${!selectedId ? "is-active" : ""}`} onClick={() => onSelect(null)}>
          <span>All products</span>
          <em>{total.toLocaleString()}</em>
        </button>
        <ul className="sb-cat-plain">
          {branches.map(({ node, count }) => {
            const open = selectedId && containsId(node, selectedId);
            const kids = (node.children || []).map((child) => ({ child, count: subtreeCount(child, counts) })).filter((k) => k.count > 0);
            return (
              <li key={node.id}>
                <button type="button" className={`sb-cat-link sb-cat-btn ${selectedId === node.id ? "is-active" : ""}`} onClick={() => onSelect(node.id)}>
                  <span>{node.name}</span>
                  <em>{count.toLocaleString()}</em>
                </button>
                {open && kids.length ? (
                  <ul className="sb-cat-list">
                    {kids.map(({ child, count: kidCount }) => (
                      <li key={child.id}>
                        <button type="button" className={`sb-cat-link sb-cat-btn ${selectedId === child.id ? "is-active" : ""}`} onClick={() => onSelect(child.id)}>
                          <span>{child.name}</span>
                          <em>{kidCount.toLocaleString()}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// The provider's products with the same filter sidebar as the Shop page, scoped to this provider.
// Filters live in the URL (?cat=&min=&a.brand=...) so a filtered view can be shared.
function ProviderProducts({ provider }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const cat = searchParams.get("cat") || "";
  const queryKey = searchParams.toString();

  const [shopTree, setShopTree] = useState(null);
  const [productTree, setProductTree] = useState(null);
  const [result, setResult] = useState(null);
  const [facets, setFacets] = useState(null);
  const [categoryFacets, setCategoryFacets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const apply = (patch) => setSearchParams(patchParams(searchParams, patch), { replace: false });

  useEffect(() => {
    let active = true;
    Promise.all([
      request(`/shop-categories/provider/${encodeURIComponent(provider.id)}`).catch(() => ({ items: [] })),
      request("/product-categories").catch(() => ({ items: [] }))
    ]).then(([shop, product]) => {
      if (!active) return;
      setShopTree(shop?.items || []);
      setProductTree(product?.items || product || []);
    });
    return () => {
      active = false;
    };
  }, [provider.id]);

  // A provider who organised their shop into their own categories gets those; otherwise the
  // shared product-category tree (trimmed to what they actually sell).
  const mode = shopTree && shopTree.length ? "shop" : "product";
  const tree = mode === "shop" ? shopTree : productTree || [];

  useEffect(() => {
    if (shopTree === null) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    const scope = { providerId: provider.id, ...(cat ? (mode === "shop" ? { shopCategoryId: cat } : { productCategoryId: cat }) : {}) };
    const base = { ...toApiParams(filters, { categoryId: null, coords: null }), ...scope };
    // Sidebar category counts must not collapse to the selected branch, so they come from a call without it.
    const { shopCategoryId: _s, productCategoryId: _p, ...withoutCategory } = base;
    const listParams = new URLSearchParams({ ...base, page: String(filters.page), limit: String(PRODUCT_PAGE_SIZE), sort: filters.sort });
    Promise.all([
      request(`/listings?${listParams.toString()}`),
      request(`/listings/facets?${new URLSearchParams(base).toString()}`).catch(() => null),
      cat ? request(`/listings/facets?${new URLSearchParams(withoutCategory).toString()}`).catch(() => null) : Promise.resolve(null)
    ])
      .then(([list, facetData, unscoped]) => {
        if (!active) return;
        setResult(list);
        setFacets(facetData);
        setCategoryFacets(unscoped || facetData);
      })
      .catch((loadError) => active && setError(loadError.message || "Unable to load products."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // queryKey covers every filter and the category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, queryKey, shopTree, mode]);

  const counts = (mode === "shop" ? categoryFacets?.shopCategoryCounts : categoryFacets?.categoryCounts) || {};
  const productNode = mode === "product" && cat ? findCategoryPath(productTree || [], cat)?.node : null;
  const fieldDefs = productNode?.effectiveListingFields || [];
  const total = result?.total ?? 0;
  const allTotal = categoryFacets?.total ?? 0; // not the sum of category counts: products without a category still count
  const filterCount = activeFilterCount(filters);

  const labelFor = (key) => fieldDefs.find((f) => f.key === key)?.label || prettyKey(key);
  const chips = [];
  if (cat) {
    const name = (findCategoryPath(tree, cat)?.node || {}).name;
    if (name) chips.push({ id: "cat", text: name, remove: () => apply({ cat: null }) });
  }
  if (filters.min !== null || filters.max !== null) {
    chips.push({ id: "price", text: `UGX ${bucketLabel({ min: filters.min, max: filters.max === null ? null : filters.max + 1 })}`, remove: () => apply({ min: null, max: null }) });
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
  const clearAll = () => setSearchParams(patchParams(searchParams, { cat: null, min: null, max: null, discount: false, attrs: {} }));

  const sidebar = shopTree === null || (loading && !facets) ? (
    <SidebarSkeleton blocks={3} />
  ) : (
    <BrowseSidebar
      fieldDefs={fieldDefs}
      facets={facets}
      filters={filters}
      onChange={apply}
      onClearAll={clearAll}
      hideLocation
      categorySlot={<ProviderCategoryBlock tree={tree} counts={counts} selectedId={cat} total={allTotal} onSelect={(id) => apply({ cat: id })} />}
    />
  );

  return (
    <div className="sb-layout pl-layout">
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

      <div className="sb-results">
        <header className="sb-results-head">
          {loading && !result ? <Skel h={14} w={90} /> : <p className="sb-count">{`${total.toLocaleString()} product${total === 1 ? "" : "s"}`}</p>}
          <div className="sb-head-actions">
            <button type="button" className="sb-filter-btn" onClick={() => setDrawerOpen(true)}>
              Filters{filterCount ? ` (${filterCount})` : ""}
            </button>
            <label className="sb-sort">
              <span>Sort</span>
              <select value={filters.sort} onChange={(event) => apply({ sort: event.target.value === "featured" ? null : event.target.value })}>
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
              <button type="button" className="sb-link-btn" onClick={clearAll}>
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="error-message home-error">{error}</div> : null}

        {loading && !result ? (
          <ProductGridSkeleton count={6} className="sb-grid pl-grid" />
        ) : result?.items?.length ? (
          <div className={`sb-grid pl-grid ${loading ? "is-loading" : ""}`}>
            {result.items.map((listing) => (
              <BrowseCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : !error ? (
          <div className="sb-empty">
            <h2>No products match</h2>
            <p>Try removing a filter.</p>
            {chips.length ? (
              <button type="button" className="sb-apply" onClick={clearAll}>
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : null}

        <Pagination page={filters.page} limit={PRODUCT_PAGE_SIZE} total={total} onPageChange={(page) => apply({ page })} />
      </div>
    </div>
  );
}

function ServiceCards({ services, onOrder }) {
  return (
    <div className="listing-grid">
      {services.map((item) => (
        <div key={item.id} className="listing-card">
          <div className="listing-cover" style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}>
            {!item.media?.imageUrl ? <IconBox /> : null}
          </div>
          <div className="listing-body">
            <h3>{item.name}</h3>
            {item.description ? <p className="provider-meta">{item.description}</p> : null}
            {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
            {onOrder ? (
              <button type="button" className="cta-button ecommerce-order-button" onClick={() => onOrder(item)}>
                Order now
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// Replaces the old single "Products & services" grid on a provider page: products and services are
// separate tabs (a tab only appears when the provider has that kind), and products get the Shop
// page's filter sidebar.
export default function ProviderListings({ provider, listings, onOrderService, id }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const products = listings.filter((l) => l.type === "product");
  const services = listings.filter((l) => l.type !== "product");
  const hasBoth = products.length > 0 && services.length > 0;

  const requested = searchParams.get("tab");
  const tab = requested === "services" && services.length ? "services" : requested === "products" && products.length ? "products" : products.length ? "products" : "services";

  const selectTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    for (const key of [...params.keys()]) if (key !== "tab") params.delete(key); // filters belong to the products tab
    setSearchParams(params);
  };

  return (
    <section className="pl-section" id={id}>
      {!listings.length ? (
        <div className="detail-block">
          <h2>Products &amp; services</h2>
          <div className="empty-state">
            <IconBox />
            <p>No products or services listed yet.</p>
          </div>
        </div>
      ) : (
        <>
          {hasBoth ? (
            <div className="pl-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "products"} className={tab === "products" ? "is-active" : ""} onClick={() => selectTab("products")}>
                Products <span>{products.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "services"} className={tab === "services" ? "is-active" : ""} onClick={() => selectTab("services")}>
                Services <span>{services.length}</span>
              </button>
            </div>
          ) : (
            <h2 className="pl-title">{tab === "products" ? "Products" : "Services"}</h2>
          )}
          {tab === "products" ? <ProviderProducts provider={provider} /> : <ServiceCards services={services} onOrder={onOrderService} />}
        </>
      )}
    </section>
  );
}
