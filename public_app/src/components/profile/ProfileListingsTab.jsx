import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { findCategoryPath } from "../../lib/categories";
import { formatUgx } from "../../lib/format";
import { useListLayout } from "../../lib/listLayout";
import { listingCover } from "../../lib/shopMappers";
import { ProviderCategoryBlock } from "../ProviderListings";
import LayoutToggle from "../shop/browse/LayoutToggle";
import LazyImg from "../LazyImg";
import { IconBox, IconClose, IconSearch } from "../icons";

const STATUSES = ["approved", "pending", "suspended"];
const SORTS = ["newest", "oldest", "priceLow", "priceHigh", "name"];

const subtreeIds = (node) => [node.id, ...(node.children || []).flatMap(subtreeIds)];

// The seller's own catalogue, laid out the way shoppers see it on the public page - product / service tabs,
// category filter, price range, sort, grid or list - plus what only the owner needs: status, Edit and Remove.
export default function ProfileListingsTab({ listings, onDelete }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useListLayout();
  const [trees, setTrees] = useState({ product: [], service: [] });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const products = useMemo(() => listings.filter((l) => l.type === "product"), [listings]);
  const services = useMemo(() => listings.filter((l) => l.type !== "product"), [listings]);

  const requested = searchParams.get("kind");
  const kind = requested === "service" || requested === "product" ? requested : products.length || !services.length ? "product" : "service";
  const items = kind === "product" ? products : services;

  const [filters, setFilters] = useState({ q: "", cat: "", status: "", min: "", max: "", sort: "newest" });
  const patch = (next) => setFilters((current) => ({ ...current, ...next }));
  // Changing tab starts from a clean filter set: a category from the other kind would match nothing.
  const selectKind = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("kind", next);
    setSearchParams(params, { replace: true });
    setFilters({ q: "", cat: "", status: "", min: "", max: "", sort: filters.sort });
  };

  useEffect(() => {
    let active = true;
    Promise.all([request("/product-categories").catch(() => ({ items: [] })), request("/service-categories").catch(() => ({ items: [] }))]).then(([product, service]) => {
      if (active) setTrees({ product: product?.items || product || [], service: service?.items || service || [] });
    });
    return () => {
      active = false;
    };
  }, []);

  const tree = trees[kind];
  const catKey = kind === "product" ? "productCategoryId" : "serviceCategoryId";
  const counts = useMemo(() => {
    const map = {};
    for (const item of items) if (item[catKey]) map[item[catKey]] = (map[item[catKey]] || 0) + 1;
    return map;
  }, [items, catKey]);

  const catNode = filters.cat ? findCategoryPath(tree, filters.cat)?.node : null;
  const catIds = useMemo(() => (catNode ? new Set(subtreeIds(catNode)) : null), [catNode]);

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const min = filters.min === "" ? null : Number(filters.min);
    const max = filters.max === "" ? null : Number(filters.max);
    const rows = items.filter((item) => {
      if (catIds && !catIds.has(item[catKey])) return false;
      if (filters.status && item.status !== filters.status) return false;
      const price = Number(item.price) || 0;
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      if (q && !`${item.name} ${item.description || ""} ${item.sku || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const by = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
      name: (a, b) => String(a.name).localeCompare(String(b.name))
    }[filters.sort];
    return [...rows].sort(by);
  }, [items, catIds, catKey, filters]);

  const statusCounts = useMemo(() => {
    const map = {};
    for (const item of items) map[item.status] = (map[item.status] || 0) + 1;
    return map;
  }, [items]);

  const chips = [];
  if (catNode) chips.push({ id: "cat", text: catNode.name, remove: () => patch({ cat: "" }) });
  if (filters.status) chips.push({ id: "status", text: t(`profile.mine.status.${filters.status}`), remove: () => patch({ status: "" }) });
  if (filters.min !== "" || filters.max !== "") {
    chips.push({ id: "price", text: `UGX ${filters.min || 0} – ${filters.max || "∞"}`, remove: () => patch({ min: "", max: "" }) });
  }
  if (filters.q.trim()) chips.push({ id: "q", text: `“${filters.q.trim()}”`, remove: () => patch({ q: "" }) });
  const clearAll = () => setFilters({ q: "", cat: "", status: "", min: "", max: "", sort: filters.sort });

  const sidebar = (
    <>
      <section className="sb-block">
        <h2 className="sb-block-head sb-block-head-plain">{t("profile.mine.search")}</h2>
        <div className="sb-block-body">
          <label className="po-search">
            <IconSearch aria-hidden="true" />
            <input type="search" value={filters.q} onChange={(e) => patch({ q: e.target.value })} placeholder={t("profile.mine.searchPlaceholder")} aria-label={t("profile.mine.search")} />
          </label>
        </div>
      </section>

      <ProviderCategoryBlock
        tree={tree}
        counts={counts}
        selectedId={filters.cat}
        total={items.length}
        allLabel={t(kind === "product" ? "profile.mine.allProducts" : "profile.mine.allServices")}
        onSelect={(id) => patch({ cat: id || "" })}
      />

      <section className="sb-block">
        <h2 className="sb-block-head sb-block-head-plain">{t("profile.mine.statusTitle")}</h2>
        <div className="sb-block-body">
          <ul className="sb-options">
            {STATUSES.map((status) => (
              <li key={status}>
                <label className="sb-check">
                  <input type="checkbox" checked={filters.status === status} onChange={() => patch({ status: filters.status === status ? "" : status })} />
                  <span>{t(`profile.mine.status.${status}`)}</span>
                  <em>{(statusCounts[status] || 0).toLocaleString()}</em>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sb-block">
        <h2 className="sb-block-head sb-block-head-plain">{t("shop.sidebar.priceUgx")}</h2>
        <div className="sb-block-body">
          <div className="sb-price-inputs">
            <input type="number" inputMode="numeric" min="0" placeholder={t("shop.sidebar.min")} value={filters.min} onChange={(e) => patch({ min: e.target.value })} />
            <input type="number" inputMode="numeric" min="0" placeholder={t("shop.sidebar.max")} value={filters.max} onChange={(e) => patch({ max: e.target.value })} />
          </div>
        </div>
      </section>
    </>
  );

  const addPath = `/profile/listings/new?type=${kind}`;

  return (
    <section className="detail-block pm-tab">
      <div className="detail-block-header">
        <h2>{t("profile.tabs.listings")}</h2>
        <Link to={addPath} className="cta-button">{t(kind === "product" ? "profile.mine.addProduct" : "profile.mine.addService")}</Link>
      </div>

      <div className="pl-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "product"} className={kind === "product" ? "is-active" : ""} onClick={() => selectKind("product")}>
          {t("provider.listings.products")} <span>{products.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={kind === "service"} className={kind === "service" ? "is-active" : ""} onClick={() => selectKind("service")}>
          {t("provider.listings.services")} <span>{services.length}</span>
        </button>
      </div>

      {!items.length ? (
        <div className="empty-state">
          <IconBox />
          <p>{t(kind === "product" ? "profile.mine.noProducts" : "profile.mine.noServices")}</p>
          <Link to={addPath} className="cta-button">{t(kind === "product" ? "profile.mine.addProduct" : "profile.mine.addService")}</Link>
        </div>
      ) : (
        <div className="sb-layout pl-layout">
          <div className={`sb-side-wrap ${drawerOpen ? "is-open" : ""}`}>
            <div className="sb-drawer-head">
              <strong>{t("provider.listings.filters")}</strong>
              <button type="button" className="sb-icon-btn" onClick={() => setDrawerOpen(false)} aria-label={t("provider.listings.closeFilters")}><IconClose /></button>
            </div>
            {sidebar}
            <div className="sb-drawer-foot">
              <button type="button" className="sb-apply sb-apply-wide" onClick={() => setDrawerOpen(false)}>{t("profile.mine.showResults", { count: visible.length })}</button>
            </div>
          </div>
          {drawerOpen ? <div className="sb-scrim" onClick={() => setDrawerOpen(false)} /> : null}

          <div className="sb-results">
            <header className="sb-results-head">
              <p className="sb-count">{t(kind === "product" ? "profile.mine.productCount" : "profile.mine.serviceCount", { count: visible.length })}</p>
              <div className="sb-head-actions">
                <button type="button" className="sb-filter-btn" onClick={() => setDrawerOpen(true)}>
                  {t("provider.listings.filters")}{chips.length ? ` (${chips.length})` : ""}
                </button>
                <label className="sb-sort">
                  <span>{t("provider.listings.sort")}</span>
                  <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value })}>
                    {SORTS.map((s) => <option key={s} value={s}>{t(`profile.mine.sort.${s}`)}</option>)}
                  </select>
                </label>
                <LayoutToggle value={layout} onChange={setLayout} />
              </div>
            </header>

            {chips.length ? (
              <div className="sb-chips">
                {chips.map((chip) => (
                  <button key={chip.id} type="button" className="sb-chip" onClick={chip.remove}>{chip.text}<IconClose width={12} height={12} /></button>
                ))}
                {chips.length > 1 ? <button type="button" className="sb-link-btn" onClick={clearAll}>{t("provider.listings.clearAll")}</button> : null}
              </div>
            ) : null}

            {visible.length ? (
              <div className={`sb-grid pl-grid ${layout === "list" ? "is-list" : ""}`}>
                {visible.map((item) => {
                  const price = Number(item.price) || 0;
                  const was = Number(item.originalPrice) || 0;
                  return (
                    <article key={item.id} className="sb-card pm-card">
                      <div className="sb-card-media">
                        <LazyImg src={listingCover(item)} alt={item.name} loading="lazy" />
                        <span className={`pm-status is-${item.status}`}>{t(`profile.mine.status.${item.status}`, { defaultValue: item.status })}</span>
                        {item.discountPercent ? <span className="sb-card-badge">-{item.discountPercent}%</span> : null}
                      </div>
                      <div className="sb-card-body">
                        <div className="sb-card-price">
                          <strong>{price > 0 ? formatUgx(price) : t("shop.listing.contactForPrice")}</strong>
                          {was > price ? <s>{formatUgx(was)}</s> : null}
                        </div>
                        <h3 className="sb-card-name">{item.name}</h3>
                        <p className={`sb-card-desc ${item.description ? "" : "is-empty"}`}>{item.description || " "}</p>
                        <div className="pm-actions">
                          <Link to={`/profile/listings/${item.id}/edit`} className="po-primary">{t("profile.edit")}</Link>
                          {item.status === "approved" ? <Link to={`/shop/product/${item.id}`} className="po-ghost">{t("profile.mine.view")}</Link> : null}
                          <button type="button" className="po-danger" onClick={() => onDelete(item)}>{t("profile.remove")}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="sb-empty">
                <h2>{t("provider.listings.noMatch")}</h2>
                <p>{t("provider.listings.tryRemoving")}</p>
                {chips.length ? <button type="button" className="sb-apply" onClick={clearAll}>{t("provider.listings.clearAllFilters")}</button> : null}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
