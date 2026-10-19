import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import BusLayout from "../../components/bus/BusLayout";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { CardGridSkeleton, EmptyState, ErrorBox, ParkCard } from "../../components/bus/parts";
import { Building, Close, Search } from "../../components/bus/icons";
import { busApi } from "../../lib/bus";

export default function BusParks() {
  const { t } = useTranslation();
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
          <nav className="bus-breadcrumb" aria-label={t("bus.breadcrumb")}><Link to="/bus">Gabla Bus</Link><span>/</span><span>{t("bus.layout.busParks")}</span></nav>
          <div className="bus-pagehead">
            <div>
              <span className="bus-kicker">{t("bus.home.whereBoard")}</span>
              <h1 className="bus-page-title">{t("bus.layout.busParks")}</h1>
              <p className="bus-section-sub">{t("bus.parks.sub")}</p>
            </div>
            <div className="bus-searchfield">
              <Search size={18} />
              <input type="search" placeholder={t("bus.parks.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("bus.parks.searchAria")} />
              {q ? <button type="button" onClick={() => setQ("")} aria-label={t("bus.parks.clearAria")}><Close size={14} /></button> : null}
            </div>
          </div>
          {districts.length > 1 ? (
            <div className="bus-chiprow" role="group" aria-label={t("bus.parks.districtAria")}>
              <button type="button" className={`bus-pillbtn ${!district ? "is-active" : ""}`} aria-pressed={!district} onClick={() => setDistrict("")}>{t("bus.parks.allDistricts")}</button>
              {districts.map(([d, n]) => (
                <button type="button" key={d} className={`bus-pillbtn ${district === d ? "is-active" : ""}`} aria-pressed={district === d} onClick={() => setDistrict(district === d ? "" : d)}>{d} <small>{n}</small></button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="bus-wrap bus-sec bus-sec-first" aria-label={t("bus.parks.companiesAria")}>
        {list.loading ? (
          <CardGridSkeleton count={6} />
        ) : list.error ? (
          <ErrorBox error={list.error} onRetry={list.reload} />
        ) : items.length ? (
          <>
            <p className="bus-count" aria-live="polite">{district ? <Trans i18nKey="bus.parks.countIn" count={items.length} values={{ district }} components={{ b: <b /> }} /> : <Trans i18nKey="bus.parks.count" count={items.length} components={{ b: <b /> }} />}</p>
            <div className="bus-grid">{items.map((p) => <ParkCard key={p.id} park={p} />)}</div>
          </>
        ) : (
          <EmptyState
            icon={Building}
            title={filtered ? t("bus.parks.noMatch") : t("bus.home.noCompanies")}
            action={filtered ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => { setQ(""); setDistrict(""); }}>{t("bus.parks.clearSearch")}</button> : null}
          >
            {filtered ? t("bus.parks.tryDifferent") : t("bus.home.checkBack")}
          </EmptyState>
        )}
      </section>
    </BusLayout>
  );
}
