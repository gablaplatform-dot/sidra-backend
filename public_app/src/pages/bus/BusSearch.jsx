import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import TripExplorer from "../../components/bus/TripList";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { IconArrowRight, IconClose } from "../../components/icons";
import { busApi, dayLabel } from "../../lib/bus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function BusSearch() {
  useScrollTop();
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const operatorSlug = params.get("operatorSlug") || "";
  const busTypeId = params.get("busTypeId") || "";
  const rawDate = params.get("date") || "";
  const date = DATE_RE.test(rawDate) ? rawDate : "";

  const places = useLoad(() => busApi.places(), []);
  const types = useLoad(() => busApi.types(), []);
  const parks = useLoad(() => busApi.parks(), []);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const filters = useMemo(() => ({ from, to, operatorSlug, busTypeId }), [from, to, operatorSlug, busTypeId]);
  const typeName = (types.data?.items || []).find((t) => t.id === busTypeId)?.name;
  const parkName = (parks.data?.items || []).find((p) => p.slug === operatorSlug)?.companyName;
  const origins = places.data?.origins || [];
  const destinations = places.data?.destinations || [];
  const anyFilter = from || to || operatorSlug || busTypeId;

  const withValue = (list, v) => (v && !list.includes(v) ? [...list, v] : list);

  return (
    <BusLayout>
      <nav className="bus-breadcrumb" aria-label="Breadcrumb"><Link to="/bus">Gabla Bus</Link><span>/</span><span>Search trips</span></nav>
      <div className="bus-page-head">
        <h1 className="bus-page-title">
          {from || to ? (
            <span className="bus-route-line">
              <span>{from || "Anywhere"}</span><IconArrowRight className="bus-arrow" width={22} height={22} /><span>{to || "Anywhere"}</span>
            </span>
          ) : "All bus trips"}
        </h1>
        {parkName || typeName ? <p className="bus-section-sub">{[parkName, typeName].filter(Boolean).join(" · ")}</p> : null}
      </div>

      <div className="bus-card bus-card-pad bus-filterbar">
        <label className="bus-field">
          <span>From</span>
          <select className="bus-select" value={from} onChange={(e) => update({ from: e.target.value })}>
            <option value="">Anywhere</option>
            {withValue(origins, from).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <button type="button" className="bus-swap" onClick={() => update({ from: to, to: from })} aria-label="Swap origin and destination" title="Swap">⇄</button>
        <label className="bus-field">
          <span>To</span>
          <select className="bus-select" value={to} onChange={(e) => update({ to: e.target.value })}>
            <option value="">Anywhere</option>
            {withValue(destinations, to).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="bus-field">
          <span>Bus type</span>
          <select className="bus-select" value={busTypeId} onChange={(e) => update({ busTypeId: e.target.value })}>
            <option value="">Any bus type</option>
            {(types.data?.items || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="bus-field">
          <span>Bus company</span>
          <select className="bus-select" value={operatorSlug} onChange={(e) => update({ operatorSlug: e.target.value })}>
            <option value="">Any company</option>
            {(parks.data?.items || []).map((p) => <option key={p.slug} value={p.slug}>{p.companyName}</option>)}
          </select>
        </label>
      </div>

      {anyFilter || date ? (
        <div className="bus-filter-row" aria-label="Active filters">
          {from ? <button type="button" className="bus-chip is-active" onClick={() => update({ from: "" })}>From {from} <IconClose width={12} height={12} /></button> : null}
          {to ? <button type="button" className="bus-chip is-active" onClick={() => update({ to: "" })}>To {to} <IconClose width={12} height={12} /></button> : null}
          {busTypeId ? <button type="button" className="bus-chip is-active" onClick={() => update({ busTypeId: "" })}>{typeName || "Bus type"} <IconClose width={12} height={12} /></button> : null}
          {operatorSlug ? <button type="button" className="bus-chip is-active" onClick={() => update({ operatorSlug: "" })}>{parkName || operatorSlug} <IconClose width={12} height={12} /></button> : null}
          {date ? <button type="button" className="bus-chip is-active" onClick={() => update({ date: "" })}>{dayLabel(date)} <IconClose width={12} height={12} /></button> : null}
          {anyFilter ? <button type="button" className="bus-linkbtn" onClick={() => setParams({}, { replace: true })}>Clear all</button> : null}
        </div>
      ) : null}

      <TripExplorer
        filters={filters}
        date={date}
        onDate={(d) => update({ date: d })}
        emptyAction={anyFilter ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => setParams({}, { replace: true })}>Clear filters</button> : null}
      />
    </BusLayout>
  );
}
