import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import BusLayout from "../../components/bus/BusLayout";
import SearchBox from "../../components/bus/SearchBox";
import TripExplorer from "../../components/bus/TripList";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { Close } from "../../components/bus/icons";
import { busApi } from "../../lib/bus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function BusSearch() {
  const { t } = useTranslation();
  useScrollTop();
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const operatorSlug = params.get("operatorSlug") || "";
  const busTypeId = params.get("busTypeId") || "";
  const rawDate = params.get("date") || "";
  const date = DATE_RE.test(rawDate) ? rawDate : "";

  const places = useLoad(() => busApi.places(), []);
  const types = useLoad(() => busApi.types(), [], { enabled: Boolean(busTypeId) });
  const parks = useLoad(() => busApi.parks(), [], { enabled: Boolean(operatorSlug) });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const filters = useMemo(() => ({ from, to, operatorSlug, busTypeId }), [from, to, operatorSlug, busTypeId]);
  const typeName = (types.data?.items || []).find((t) => t.id === busTypeId)?.name;
  const parkName = (parks.data?.items || []).find((p) => p.slug === operatorSlug)?.companyName;
  const anyFilter = from || to || operatorSlug || busTypeId;

  const header = (selected) => (
    <div className="bus-searchhead">
      <nav className="bus-breadcrumb" aria-label={t("bus.breadcrumb")}><Link to="/bus">Gabla Bus</Link><span>/</span><span>{t("bus.searchPage.searchTrips")}</span></nav>
      <SearchBox
        collapsible
        places={places.data}
        loading={places.loading}
        initial={{ from, to, date: date || selected }}
        onSubmit={(v) => update({ from: v.from, to: v.to, date: v.date })}
      />
      {operatorSlug || busTypeId ? (
        <div className="bus-filter-row" aria-label={t("bus.searchPage.activeFilters")}>
          {busTypeId ? <button type="button" className="bus-pillbtn is-active" onClick={() => update({ busTypeId: "" })}>{typeName || t("bus.searchPage.busType")} <Close size={12} /><span className="sr-only">{t("bus.searchPage.removeFilter")}</span></button> : null}
          {operatorSlug ? <button type="button" className="bus-pillbtn is-active" onClick={() => update({ operatorSlug: "" })}>{parkName || operatorSlug} <Close size={12} /><span className="sr-only">{t("bus.searchPage.removeFilter")}</span></button> : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <BusLayout>
      <TripExplorer
        filters={filters}
        date={date}
        onDate={(d) => update({ date: d })}
        header={header}
        kicker={from || to ? undefined : operatorSlug ? parkName : busTypeId ? typeName : t("bus.trips.allRoutes")}
        emptyAction={anyFilter ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => setParams({}, { replace: true })}>{t("bus.searchPage.clearFilters")}</button> : null}
      />
    </BusLayout>
  );
}
