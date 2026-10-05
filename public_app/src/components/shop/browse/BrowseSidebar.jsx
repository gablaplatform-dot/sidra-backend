import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { activeFilterCount, bucketLabel, prettyKey } from "../../../lib/browseFilters";

const FILTERABLE = new Set(["select", "multi_select", "boolean"]);
const INITIAL_OPTIONS = 6;
const OPEN_BY_DEFAULT = 5;

function subtreeCount(node, counts) {
  return (counts[node.id] || 0) + (node.children || []).reduce((sum, child) => sum + subtreeCount(child, counts), 0);
}

function CategoryBlock({ node, ancestors, siblings, categoryCounts }) {
  const [showAll, setShowAll] = useState(false);
  const hasCounts = Boolean(categoryCounts);
  const children = (node?.children || [])
    .map((child) => ({ child, count: hasCounts ? subtreeCount(child, categoryCounts) : null }))
    .filter(({ count }) => count === null || count > 0);
  // A leaf has nothing below it, so offer its siblings instead - same as moving sideways on Jiji.
  const rows = children.length ? children : siblings.filter((s) => s.id !== node?.id).map((child) => ({ child, count: null }));
  const visible = showAll ? rows : rows.slice(0, 6);

  return (
    <section className="sb-block sb-block-categories">
      <h2 className="sb-block-head">Categories</h2>
      <div className="sb-block-body">
        <Link to="/shop/categories" className="sb-cat-link sb-cat-root">All categories</Link>
        {ancestors.map((a) => (
          <Link key={a.id} to={`/shop/${a.id}`} className="sb-cat-link sb-cat-anc">
            &lsaquo; {a.name}
          </Link>
        ))}
        {node ? <strong className="sb-cat-current">{node.name}</strong> : null}
        <ul className="sb-cat-list">
          {visible.map(({ child, count }) => (
            <li key={child.id}>
              <Link to={`/shop/${child.id}`} className="sb-cat-link">
                <span>{child.name}</span>
                {count !== null ? <em>{count.toLocaleString()}</em> : null}
              </Link>
            </li>
          ))}
        </ul>
        {rows.length > 6 ? (
          <button type="button" className="sb-link-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all ${rows.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function PriceBlock({ filters, facets, onChange }) {
  const [min, setMin] = useState(filters.min ?? "");
  const [max, setMax] = useState(filters.max ?? "");
  useEffect(() => {
    setMin(filters.min ?? "");
    setMax(filters.max ?? "");
  }, [filters.min, filters.max]);

  const apply = () => {
    const lo = min === "" ? null : Math.max(0, Number(min));
    const hi = max === "" ? null : Math.max(0, Number(max));
    onChange({ min: lo, max: hi });
  };
  const buckets = facets?.price?.buckets || [];
  const hasRange = filters.min !== null || filters.max !== null;

  return (
    <section className="sb-block">
      <h2 className="sb-block-head sb-block-head-plain">Price, UGX</h2>
      <div className="sb-block-body">
        <div className="sb-price-inputs">
          <input type="number" inputMode="numeric" min="0" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
          <input type="number" inputMode="numeric" min="0" placeholder="max" value={max} onChange={(e) => setMax(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
        </div>
        <ul className="sb-options">
          {buckets.map((b) => {
            const lo = b.min;
            const hi = b.max === null ? null : b.max - 1;
            const checked = filters.min === lo && filters.max === hi;
            return (
              <li key={`${b.min}-${b.max}`}>
                <label className="sb-check">
                  <input type="checkbox" checked={checked} onChange={() => onChange(checked ? { min: null, max: null } : { min: lo, max: hi })} />
                  <span>{bucketLabel(b)}</span>
                  <em>{b.count.toLocaleString()}</em>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="sb-price-actions">
          <button type="button" className="sb-link-btn" onClick={() => onChange({ min: null, max: null })} disabled={!hasRange && min === "" && max === ""}>
            Clear
          </button>
          <button type="button" className="sb-apply" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </section>
  );
}

function AttributeGroup({ group, selected, open, onToggleOpen, onToggleValue }) {
  const [expanded, setExpanded] = useState(false);
  const isBoolean = group.type === "boolean";
  // A chosen value that now matches nothing (because of another filter) must stay visible so it can be unticked.
  const known = new Set(group.options.map((o) => o.value));
  const options = [...group.options, ...selected.filter((v) => !known.has(v)).map((value) => ({ value, count: 0 }))];
  const visible = expanded ? options : options.filter((o, i) => i < INITIAL_OPTIONS || selected.includes(o.value));

  return (
    <section className="sb-block">
      <button type="button" className="sb-block-head sb-block-head-plain sb-collapsible" onClick={onToggleOpen} aria-expanded={open}>
        <span>{group.label}</span>
        {selected.length ? <b>{selected.length}</b> : null}
        <i className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
      {open ? (
        <div className="sb-block-body">
          <ul className="sb-options">
            {visible.map((o) => (
              <li key={o.value}>
                <label className="sb-check">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggleValue(o.value)} />
                  <span>{isBoolean ? "Yes" : o.value}</span>
                  <em>{o.count.toLocaleString()}</em>
                </label>
              </li>
            ))}
          </ul>
          {options.length > INITIAL_OPTIONS ? (
            <button type="button" className="sb-link-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `Show all ${options.length}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function BrowseSidebar({ node, ancestors, siblings, fieldDefs, facets, filters, onChange, onOpenLocation, locationLabel, onClearAll }) {
  const [closed, setClosed] = useState({});

  const defs = fieldDefs.filter((f) => FILTERABLE.has(f.type));
  const attrFacets = facets?.attributes || {};
  let groups = defs
    .map((f) => ({ key: f.key, label: f.label || prettyKey(f.key), type: f.type, options: attrFacets[f.key] || [] }))
    .filter((g) => g.options.length > 0 || (filters.attrs[g.key] || []).length > 0);
  // Top-level categories declare no fields of their own, so offer the two filters that make sense across everything.
  if (!defs.length) {
    groups = ["condition", "brand"]
      .filter((key) => (attrFacets[key] || []).length > 0 || (filters.attrs[key] || []).length > 0)
      .map((key) => ({ key, label: prettyKey(key), type: "multi_select", options: attrFacets[key] || [] }));
  }

  const toggleValue = (key, value) => {
    const current = filters.attrs[key] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const attrs = { ...filters.attrs, [key]: next };
    if (!next.length) delete attrs[key];
    onChange({ attrs });
  };

  return (
    <aside className="sb-sidebar">
      <CategoryBlock node={node} ancestors={ancestors} siblings={siblings} categoryCounts={facets?.categoryCounts} />

      <section className="sb-block">
        <button type="button" className="sb-location" onClick={onOpenLocation}>
          <span>
            <b>Location</b>
            <small>{locationLabel}</small>
          </span>
          <i aria-hidden="true" />
        </button>
      </section>

      <PriceBlock filters={filters} facets={facets} onChange={onChange} />

      {groups.map((group, index) => (
        <AttributeGroup
          key={group.key}
          group={group}
          selected={filters.attrs[group.key] || []}
          open={closed[group.key] === undefined ? index < OPEN_BY_DEFAULT : !closed[group.key]}
          onToggleOpen={() =>
            setClosed((c) => ({ ...c, [group.key]: closed[group.key] === undefined ? index < OPEN_BY_DEFAULT : !closed[group.key] }))
          }
          onToggleValue={(value) => toggleValue(group.key, value)}
        />
      ))}

      {facets?.discountCount > 0 || filters.discount ? (
        <section className="sb-block">
          <div className="sb-block-body">
            <label className="sb-check sb-check-strong">
              <input type="checkbox" checked={filters.discount} onChange={() => onChange({ discount: !filters.discount })} />
              <span>With discount</span>
              <em>{(facets?.discountCount ?? 0).toLocaleString()}</em>
            </label>
          </div>
        </section>
      ) : null}

      {activeFilterCount(filters) > 0 ? (
        <button type="button" className="sb-clear-all" onClick={onClearAll}>
          Clear all filters
        </button>
      ) : null}
    </aside>
  );
}
