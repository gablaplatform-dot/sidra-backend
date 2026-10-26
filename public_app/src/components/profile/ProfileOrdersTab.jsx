import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { IconBox, IconClose, IconGrid, IconList, IconSearch } from "../icons";
import { SectionSkeleton } from "../Skeleton";
import QuotationModal from "./QuotationModal";
import {
  ORDER_STATUSES, Avatar, MoreIcon, StatusBadge, actionsFor, canEditQuotation, customerName, formatOrderDate, formatUgx, itemCount,
  itemsLine, orderRef, paymentChip, updateOrderStatus
} from "./orderKit";

const PAGE_SIZE = 30;
const VIEW_KEY = "gabla-orders-view";
const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
};

const EMPTY_FILTERS = { statuses: [], from: "", to: "" };

// The "..." menu on a table row: shown with fixed positioning so the scrolling table never clips it.
function RowMenu({ order, t, busy, onView, onAction, onQuote }) {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const actions = actionsFor(order);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return undefined;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos, close]);

  const toggle = () => {
    if (pos) return close();
    const rect = buttonRef.current.getBoundingClientRect();
    const flip = rect.bottom + 230 > window.innerHeight;
    setPos({ right: Math.max(8, window.innerWidth - rect.right), ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
  };

  return (
    <>
      <button ref={buttonRef} type="button" className="po-more" aria-haspopup="menu" aria-expanded={Boolean(pos)} aria-label={t("profile.orders.actions")} onClick={toggle} disabled={busy}>
        <MoreIcon />
      </button>
      {pos ? (
        <>
          <div className="po-menu-scrim" onClick={close} />
          <div className="po-menu" role="menu" style={pos}>
            <button type="button" role="menuitem" onClick={() => { close(); onView(); }}>{t("profile.orders.viewOrder")}</button>
            {actions.map((action) => (
              <button key={action.status} type="button" role="menuitem" className={action.tone === "danger" ? "is-danger" : ""} onClick={() => { close(); onAction(action); }}>
                {t(action.labelKey)}
              </button>
            ))}
            {canEditQuotation(order) ? <button type="button" role="menuitem" onClick={() => { close(); onQuote(); }}>{t("profile.orders.editQuotation")}</button> : null}
          </div>
        </>
      ) : null}
    </>
  );
}

function FilterDialog({ t, value, onApply, onClose }) {
  const [draft, setDraft] = useState(value);
  const toggle = (status) => setDraft((d) => ({ ...d, statuses: d.statuses.includes(status) ? d.statuses.filter((s) => s !== status) : [...d.statuses, status] }));
  return (
    <div className="po-modal" role="dialog" aria-modal="true" aria-label={t("profile.orders.filtersTitle")} onClick={onClose}>
      <div className="po-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{t("profile.orders.filtersTitle")}</h3>
          <button type="button" className="po-icon-btn" onClick={onClose} aria-label={t("profile.orders.close")}><IconClose /></button>
        </header>
        <div className="po-sheet-body">
          <fieldset>
            <legend>{t("profile.orders.statusLabel")}</legend>
            <div className="po-chips">
              {ORDER_STATUSES.map((status) => (
                <button key={status} type="button" className={draft.statuses.includes(status) ? "is-on" : ""} aria-pressed={draft.statuses.includes(status)} onClick={() => toggle(status)}>
                  {t(`profile.orders.status.${status}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("profile.orders.dateLabel")}</legend>
            <div className="po-dates">
              <label><span>{t("profile.orders.from")}</span><input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
              <label><span>{t("profile.orders.to")}</span><input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
            </div>
          </fieldset>
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={() => setDraft(EMPTY_FILTERS)}>{t("profile.orders.clearAll")}</button>
          <button type="button" className="cta-button" onClick={() => onApply(draft)}>{t("profile.orders.apply")}</button>
        </footer>
      </div>
    </div>
  );
}

export default function ProfileOrdersTab({ focusOrderId = null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [quoteOrder, setQuoteOrder] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [view, setView] = useState(readView);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const filterCount = filters.statuses.length + (filters.from || filters.to ? 1 : 0);

  // Typing in the search box waits a beat before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildPath = useCallback(
    (pageNumber) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageNumber) });
      if (query) params.set("q", query);
      if (filters.statuses.length) params.set("status", filters.statuses.join(","));
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      return `/engagement/provider/orders?${params.toString()}`;
    },
    [query, filters]
  );

  const load = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      return request(buildPath(1))
        .then((result) => {
          setOrders(result?.items || []);
          setTotal(result?.total || 0);
          setPage(1);
          setError("");
        })
        .catch((loadError) => setError(loadError.message || t("profile.orders.errLoad")))
        .finally(() => setLoading(false));
    },
    [buildPath, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await request(buildPath(page + 1));
      setOrders((current) => [...current, ...(result?.items || [])]);
      setPage(page + 1);
    } catch (moreError) {
      setError(moreError.message || t("profile.orders.errLoad"));
    } finally {
      setLoadingMore(false);
    }
  };

  // Arriving from "Open order" in Quotes & receipts: scroll to that order and flash it.
  useEffect(() => {
    if (!focusOrderId || loading) return undefined;
    const node = document.querySelector(`[data-order-id="${focusOrderId}"]`);
    if (!node) return undefined;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(focusOrderId);
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timer);
  }, [focusOrderId, loading]);

  const chooseView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode - the choice just won't be remembered */
    }
  };

  const viewOrder = (order) => navigate(`/profile/orders/${order.id}`);

  const runAction = async (order, action) => {
    if (action.tone === "danger" && !window.confirm(t("profile.orders.confirmClose"))) return;
    setUpdatingId(order.id);
    setError("");
    try {
      await updateOrderStatus(order.id, action.status);
      await load({ quiet: true });
    } catch (updateError) {
      setError(updateError.message || t("profile.orders.errUpdate"));
    } finally {
      setUpdatingId(null);
    }
  };

  const hasMore = orders.length < total;
  const filtering = Boolean(query) || filterCount > 0;

  return (
    <section className="detail-block po-tab">
      <div className="po-head">
        <h2>{t("profile.tabs.orders")}</h2>
        <span className="po-count">{t("profile.orders.count", { count: total })}</span>
      </div>

      <div className="po-toolbar">
        <label className="po-search">
          <IconSearch aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("profile.orders.searchPlaceholder")} aria-label={t("profile.orders.searchPlaceholder")} />
          {search ? <button type="button" onClick={() => setSearch("")} aria-label={t("profile.orders.clearSearch")}><IconClose /></button> : null}
        </label>
        <button type="button" className={`po-filter-btn${filterCount ? " is-active" : ""}`} onClick={() => setFilterOpen(true)}>
          {t("profile.orders.filters")}
          {filterCount ? <b>{filterCount}</b> : null}
        </button>
        <div className="po-toggle" role="group" aria-label={t("profile.orders.viewAria")}>
          <button type="button" className={view === "cards" ? "is-on" : ""} onClick={() => chooseView("cards")} aria-pressed={view === "cards"} title={t("profile.orders.viewCards")}><IconGrid /></button>
          <button type="button" className={view === "list" ? "is-on" : ""} onClick={() => chooseView("list")} aria-pressed={view === "list"} title={t("profile.orders.viewList")}><IconList /></button>
        </div>
      </div>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {loading ? (
        <SectionSkeleton rows={4} label={t("profile.orders.loading")} />
      ) : orders.length ? (
        <>
          {view === "cards" ? (
            <div className="po-grid">
              {orders.map((order) => {
                const name = customerName(order, t);
                const chip = paymentChip(order, t);
                const primary = actionsFor(order).find((a) => a.tone === "primary");
                return (
                  <article key={order.id} data-order-id={order.id} className={`po-card${highlightId === order.id ? " is-highlighted" : ""}`}>
                    <header>
                      <Avatar name={name} />
                      <div className="po-who">
                        <strong>{name}</strong>
                        <small>{orderRef(order.id)} · {formatOrderDate(order.createdAt)}</small>
                      </div>
                      <StatusBadge status={order.status} t={t} />
                    </header>
                    <p className="po-items-line">{itemsLine(order, t)}</p>
                    <div className="po-money">
                      <strong>{formatUgx(order.total)}</strong>
                      <span className={`po-pay is-${chip.tone}`}>{chip.label}</span>
                    </div>
                    <footer>
                      {primary ? (
                        <button type="button" className="po-primary" disabled={updatingId === order.id} onClick={() => runAction(order, primary)}>{t(primary.labelKey)}</button>
                      ) : null}
                      <button type="button" className="po-ghost" onClick={() => viewOrder(order)}>{t("profile.orders.viewOrder")}</button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="po-table-wrap" tabIndex={0}>
              <table className="po-table">
                <thead>
                  <tr>
                    <th>{t("profile.orders.colOrder")}</th>
                    <th>{t("profile.orders.colCustomer")}</th>
                    <th>{t("profile.orders.colItems")}</th>
                    <th>{t("profile.orders.colDate")}</th>
                    <th>{t("profile.orders.colPayment")}</th>
                    <th className="is-num">{t("profile.orders.colTotal")}</th>
                    <th>{t("profile.orders.colStatus")}</th>
                    <th className="po-col-actions"><span className="sr-only">{t("profile.orders.colActions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const name = customerName(order, t);
                    const chip = paymentChip(order, t);
                    return (
                      <tr key={order.id} data-order-id={order.id} className={highlightId === order.id ? "is-highlighted" : ""}>
                        <td><button type="button" className="po-link" onClick={() => viewOrder(order)}>{orderRef(order.id)}</button></td>
                        <td>
                          <div className="po-cell-who"><Avatar name={name} /><span>{name}</span></div>
                        </td>
                        <td title={itemsLine(order, t)}><span className="po-cell-items">{t("profile.orders.itemCount", { count: itemCount(order) })} · {order.items?.[0]?.name}</span></td>
                        <td>{formatOrderDate(order.createdAt)}</td>
                        <td><span className={`po-pay is-${chip.tone}`}>{chip.label}</span></td>
                        <td className="is-num"><strong>{formatUgx(order.total)}</strong></td>
                        <td><StatusBadge status={order.status} t={t} /></td>
                        <td className="po-col-actions">
                          <RowMenu order={order} t={t} busy={updatingId === order.id} onView={() => viewOrder(order)} onAction={(action) => runAction(order, action)} onQuote={() => setQuoteOrder(order)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {hasMore ? (
            <button type="button" className="secondary-button po-more-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t("profile.orders.loading") : t("profile.orders.loadMore", { shown: orders.length, total })}
            </button>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          <IconBox />
          <p>{filtering ? t("profile.orders.noMatch") : t("profile.orders.empty")}</p>
          {filtering ? <button type="button" className="secondary-button" onClick={() => { setSearch(""); setFilters(EMPTY_FILTERS); }}>{t("profile.orders.clearAll")}</button> : null}
        </div>
      )}

      {filterOpen ? <FilterDialog t={t} value={filters} onClose={() => setFilterOpen(false)} onApply={(next) => { setFilters(next); setFilterOpen(false); }} /> : null}
      {quoteOrder ? <QuotationModal order={quoteOrder} onClose={() => setQuoteOrder(null)} onIssued={() => load({ quiet: true })} /> : null}
    </section>
  );
}
