import React, { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import BusLayout from "../../components/bus/BusLayout";
import TripExplorer from "../../components/bus/TripList";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { BusLogo, EmptyState, Photo, Rating, SectionHead, telHref, waHref } from "../../components/bus/parts";
import { ArrowRight, Building, BusIcon, Chat, Clock, Phone, Pin } from "../../components/bus/icons";
import { Skel } from "../../components/Skeleton";
import { busApi, durationLabel, ugx } from "../../lib/bus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ParkSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("bus.park.loading")}</span>
      <div className="bus-parkhero is-skel" aria-hidden="true">
        <div className="bus-wrap" style={{ paddingTop: 110 }}>
          <div className="bus-parkhero-main">
            <Skel w={96} h={96} r={26} className="on-dark" />
            <div style={{ display: "grid", gap: 12, flex: 1 }}><Skel w="40%" h={32} className="on-dark" /><Skel w="60%" h={16} className="on-dark" /></div>
          </div>
        </div>
      </div>
      <div className="bus-wrap bus-sec"><Skel w="100%" h={120} r={20} /></div>
    </div>
  );
}

export default function BusPark() {
  const { t } = useTranslation();
  const { slug } = useParams();
  useScrollTop(slug);
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const rawDate = params.get("date") || "";
  const date = DATE_RE.test(rawDate) ? rawDate : "";

  const park = useLoad(() => busApi.park(slug), [slug]);
  const p = park.data;

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const filters = useMemo(() => ({ from, to, operatorSlug: slug }), [from, to, slug]);

  if (park.error) {
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          <EmptyState
            icon={Building}
            title={park.error.status === 404 ? t("bus.park.notFound") : t("bus.park.loadFailed")}
            action={<>
              {park.error.status !== 404 ? <button type="button" className="bus-btn bus-btn-navy" onClick={park.reload}>{t("bus.parts.tryAgain")}</button> : null}
              <Link to="/bus/parks" className="bus-btn bus-btn-light">{t("bus.park.allParks")}</Link>
            </>}
          >
            {park.error.status === 404 ? t("bus.park.notFoundSub") : park.error.message}
          </EmptyState>
        </div>
      </BusLayout>
    );
  }

  if (park.loading || !p) {
    return <BusLayout><ParkSkeleton /></BusLayout>;
  }

  const routeFilter = from || to;
  const fares = p.routes.flatMap((r) => r.ticketTypes.map((t) => Number(t.price))).filter((n) => n > 0);
  const minFare = fares.length ? Math.min(...fares) : null;

  return (
    <BusLayout>
      <section className="bus-parkhero">
        <Photo src={p.coverUrl} name={p.companyName} width={1800} eager className="bus-parkhero-photo" />
        <span className="bus-hero-shade is-park" aria-hidden="true" />
        <div className="bus-wrap">
          <nav className="bus-breadcrumb is-light" aria-label={t("bus.breadcrumb")}><Link to="/bus">Gabla Bus</Link><span>/</span><Link to="/bus/parks">{t("bus.layout.busParks")}</Link><span>/</span><span>{p.companyName}</span></nav>
          <div className="bus-parkhero-main">
            <BusLogo name={p.companyName} src={p.logoUrl} className="bus-parkhero-logo" size={96} />
            <div className="bus-parkhero-title">
              <h1>{p.companyName}</h1>
              <div className="bus-parkhero-meta">
                <Rating avg={p.ratingAvg} count={p.ratingCount} />
                <span><Pin size={15} /> {p.parkName}{p.parkDistrict ? `, ${p.parkDistrict}` : ""}</span>
              </div>
            </div>
            <div className="bus-parkhero-actions">
              {p.contactPhone ? <a className="bus-btn bus-btn-primary" href={telHref(p.contactPhone)}><Phone size={18} /> {t("bus.actions.call")}</a> : null}
              {p.whatsapp ? <a className="bus-btn bus-btn-glass" href={waHref(p.whatsapp)} target="_blank" rel="noopener noreferrer"><Chat size={18} /> WhatsApp</a> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="bus-wrap bus-aboutrow" aria-label={t("bus.park.aboutAria")}>
        {p.description ? <p className="bus-company-desc">{p.description}</p> : null}
        <dl className="bus-facts">
          <div><dt><Building size={16} /> {t("bus.park.busPark")}</dt><dd>{p.parkName}<small>{[p.parkAddress, p.parkDistrict].filter(Boolean).join(", ")}</small></dd></div>
          {p.fleetSize ? <div><dt><BusIcon size={16} /> {t("bus.park.fleet")}</dt><dd>{t("bus.park.buses", { count: p.fleetSize })}<small>{t("bus.park.onRoad")}</small></dd></div> : null}
          <div><dt><Clock size={16} /> {t("bus.park.routesLabel")}</dt><dd>{t("bus.parts.routes", { count: p.routes.length })}<small>{minFare ? t("bus.fromPrice", { price: ugx(minFare) }) : t("bus.park.noneYet")}</small></dd></div>
        </dl>
      </section>

      <section className="bus-wrap bus-sec" aria-labelledby="park-routes-h">
        <SectionHead
          kicker={t("bus.park.fares")}
          title={<span id="park-routes-h">{t("bus.park.routesPrices")}</span>}
          sub={t("bus.park.routesSub")}
          action={routeFilter ? <button type="button" className="bus-linkbtn" onClick={() => update({ from: "", to: "" })}>{t("bus.park.showAll")}</button> : null}
        />
        {p.routes.length ? (
          <div className="bus-routecards">
            {p.routes.map((r) => {
              const active = from === r.originName && to === r.destinationName;
              return (
                <button type="button" key={r.id} className={`bus-routecard ${active ? "is-active" : ""}`} aria-pressed={active} onClick={() => update(active ? { from: "", to: "" } : { from: r.originName, to: r.destinationName })}>
                  <span className="bus-routecard-line"><b>{r.originName}</b><ArrowRight size={16} /><b>{r.destinationName}</b></span>
                  <span className="bus-routecard-sub">
                    <span><Clock size={14} /> {durationLabel(r.durationMinutes)}</span>
                    {r.busType ? <span className="bus-trip-type">{r.busType.name}</span> : null}
                  </span>
                  {r.boardingPoint ? <span className="bus-routecard-sub"><span><Pin size={14} /> {r.boardingPoint}</span></span> : null}
                  <span className="bus-routecard-prices">
                    {r.ticketTypes.map((t) => <span key={t.id}><small>{t.name}</small><b>{ugx(t.price)}</b></span>)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("bus.park.noRoutes")}>{t("bus.park.noRoutesSub")}</EmptyState>
        )}
      </section>

      <TripExplorer
        filters={filters}
        date={date}
        onDate={(d) => update({ date: d })}
        showCompanyFilter={false}
        kicker={t("bus.park.companyTrips", { company: p.companyName })}
        emptyAction={routeFilter ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => update({ from: "", to: "" })}>{t("bus.park.showAll")}</button> : null}
      />
    </BusLayout>
  );
}
