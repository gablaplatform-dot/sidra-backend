import React, { useEffect, useMemo, useState } from "react";

import BusLayout from "../../components/bus/BusLayout";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { CardGridSkeleton, ErrorBox, ParkCard } from "../../components/bus/parts";
import { IconSearch } from "../../components/icons";
import { busApi } from "../../lib/bus";

export default function BusParks() {
  useScrollTop();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Load all parks once for the district list, and the filtered list on every change.
  const all = useLoad(() => busApi.parks(), []);
  const list = useLoad(() => busApi.parks({ q: debounced, district }), [debounced, district]);

  const districts = useMemo(() => [...new Set((all.data?.items || []).map((p) => p.parkDistrict).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [all.data]);
  const items = list.data?.items || [];
  const filtered = Boolean(debounced || district);

  return (
    <BusLayout>
      <div className="bus-page-head">
        <h1 className="bus-page-title">Bus parks</h1>
        <p className="bus-section-sub">Every company, and the park you board from.</p>
      </div>

      <div className="bus-card bus-card-pad bus-filters">
        <label className="bus-field bus-grow">
          <span>Search</span>
          <div className="bus-input-icon">
            <IconSearch width={18} height={18} />
            <input className="bus-input" type="search" placeholder="Company or park name" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </label>
        <label className="bus-field">
          <span>District</span>
          <select className="bus-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">All districts</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            {district && !districts.includes(district) ? <option value={district}>{district}</option> : null}
          </select>
        </label>
        {filtered ? <button type="button" className="bus-btn bus-btn-light" onClick={() => { setQ(""); setDistrict(""); }}>Clear</button> : null}
      </div>

      <div className="bus-section" style={{ marginTop: 20 }}>
        {list.loading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorBox error={list.error} onRetry={list.reload} />
        ) : items.length ? (
          <>
            <p className="bus-hint" style={{ marginBottom: 12 }} aria-live="polite">{items.length} {items.length === 1 ? "company" : "companies"}</p>
            <div className="bus-grid">{items.map((p) => <ParkCard key={p.id} park={p} />)}</div>
          </>
        ) : (
          <div className="bus-card bus-empty">
            <strong>{filtered ? "No bus companies match your search" : "No bus companies yet"}</strong>
            <p>{filtered ? "Try a different name or district." : "Please check back soon."}</p>
          </div>
        )}
      </div>
    </BusLayout>
  );
}
