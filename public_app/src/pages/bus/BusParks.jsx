import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { CardGridSkeleton, EmptyState, ErrorBox, ParkCard } from "../../components/bus/parts";
import { Building, Close, Search } from "../../components/bus/icons";
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

  const districts = useMemo(() => {
    const counts = new Map();
    (all.data?.items || []).forEach((p) => p.parkDistrict && counts.set(p.parkDistrict, (counts.get(p.parkDistrict) || 0) + 1));
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all.data]);
  const items = list.data?.items || [];
  const filtered = Boolean(debounced || district);

  return (
    <BusLayout>
      <section className="bus-band bus-band-page">
        <div className="bus-wrap">
          <nav className="bus-breadcrumb" aria-label="Breadcrumb"><Link to="/bus">Gabla Bus</Link><span>/</span><span>Bus parks</span></nav>
          <div className="bus-pagehead">
            <div>
              <span className="bus-kicker">Where you board</span>
              <h1 className="bus-page-title">Bus parks</h1>
              <p className="bus-section-sub">Every company, and the park you board from.</p>
            </div>
            <div className="bus-searchfield">
              <Search size={18} />
              <input type="search" placeholder="Search company or park" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bus companies or parks" />
              {q ? <button type="button" onClick={() => setQ("")} aria-label="Clear search"><Close size={14} /></button> : null}
            </div>
          </div>
          {districts.length > 1 ? (
            <div className="bus-chiprow" role="group" aria-label="Filter by district">
              <button type="button" className={`bus-pillbtn ${!district ? "is-active" : ""}`} aria-pressed={!district} onClick={() => setDistrict("")}>All districts</button>
              {districts.map(([d, n]) => (
                <button type="button" key={d} className={`bus-pillbtn ${district === d ? "is-active" : ""}`} aria-pressed={district === d} onClick={() => setDistrict(district === d ? "" : d)}>{d} <small>{n}</small></button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="bus-wrap bus-sec bus-sec-first" aria-label="Bus companies">
        {list.loading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorBox error={list.error} onRetry={list.reload} />
        ) : items.length ? (
          <>
            <p className="bus-count" aria-live="polite"><b>{items.length}</b> {items.length === 1 ? "company" : "companies"}{district ? ` in ${district}` : ""}</p>
            <div className="bus-grid">{items.map((p) => <ParkCard key={p.id} park={p} />)}</div>
          </>
        ) : (
          <EmptyState
            icon={Building}
            title={filtered ? "No bus companies match your search" : "No bus companies yet"}
            action={filtered ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => { setQ(""); setDistrict(""); }}>Clear search</button> : null}
          >
            {filtered ? "Try a different name or district." : "Please check back soon."}
          </EmptyState>
        )}
      </section>
    </BusLayout>
  );
}
