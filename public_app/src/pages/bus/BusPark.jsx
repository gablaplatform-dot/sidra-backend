import React, { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import TripExplorer from "../../components/bus/TripList";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { BusLogo, Rating, coverStyle, telHref, waHref } from "../../components/bus/parts";
import { IconArrowRight, IconPhone, IconPin } from "../../components/icons";
import { Skel } from "../../components/Skeleton";
import { busApi, durationLabel, ugx } from "../../lib/bus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ParkSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading company…</span>
      <div className="bus-card bus-company" aria-hidden="true">
        <Skel h={150} w="100%" r={0} />
        <div className="bus-company-body"><Skel w="45%" h={26} /><Skel w="70%" h={14} style={{ marginTop: 12 }} /><Skel w="100%" h={14} style={{ marginTop: 8 }} /></div>
      </div>
    </div>
  );
}

export default function BusPark() {
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
        <div className="bus-card bus-empty">
          <strong>{park.error.status === 404 ? "We couldn't find that bus company" : "Couldn't load this company"}</strong>
          <p>{park.error.status === 404 ? "It may have been removed or is not taking bookings." : park.error.message}</p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
            {park.error.status !== 404 ? <button type="button" className="bus-btn bus-btn-navy" onClick={park.reload}>Try again</button> : null}
            <Link to="/bus/parks" className="bus-btn bus-btn-light">All bus parks</Link>
          </div>
        </div>
      </BusLayout>
    );
  }

  return (
    <BusLayout>
      <nav className="bus-breadcrumb" aria-label="Breadcrumb"><Link to="/bus">Gabla Bus</Link><span>/</span><Link to="/bus/parks">Bus parks</Link><span>/</span><span>{p?.companyName || "…"}</span></nav>

      {park.loading || !p ? (
        <ParkSkeleton />
      ) : (
        <>
          <section className="bus-card bus-company">
            <div className="bus-company-cover" style={coverStyle(p.companyName, p.coverUrl)}>
              <BusLogo name={p.companyName} src={p.logoUrl} className="bus-park-logo bus-company-logo" />
            </div>
            <div className="bus-company-body">
              <div className="bus-company-title">
                <h1>{p.companyName}</h1>
                <Rating avg={p.ratingAvg} count={p.ratingCount} />
              </div>
              <p className="bus-hint bus-park-where"><IconPin width={14} height={14} /> {p.parkName}{p.parkDistrict ? `, ${p.parkDistrict}` : ""}{p.parkAddress ? ` · ${p.parkAddress}` : ""}</p>
              {p.description ? <p className="bus-company-desc">{p.description}</p> : null}
              <div className="bus-chips" style={{ marginTop: 10 }}>
                {p.fleetSize ? <span className="bus-chip">{p.fleetSize} buses</span> : null}
                <span className="bus-chip">{p.routes.length} {p.routes.length === 1 ? "route" : "routes"}</span>
              </div>
              <div className="bus-company-actions">
                {p.contactPhone ? <a className="bus-btn bus-btn-navy" href={telHref(p.contactPhone)}><IconPhone width={18} height={18} /> Call {p.contactPhone}</a> : null}
                {p.whatsapp ? <a className="bus-btn bus-btn-light" href={waHref(p.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
              </div>
            </div>
          </section>

          <section className="bus-section" aria-label="Routes and prices">
            <div className="bus-section-head">
              <div>
                <h2 className="bus-section-title">Routes &amp; prices</h2>
                <p className="bus-section-sub">Tap a route to filter its trips below.</p>
              </div>
              {from || to ? <button type="button" className="bus-linkbtn" onClick={() => update({ from: "", to: "" })}>Show all routes</button> : null}
            </div>
            {p.routes.length ? (
              <div className="bus-card bus-routes">
                {p.routes.map((r) => {
                  const active = from === r.originName && to === r.destinationName;
                  return (
                    <button type="button" key={r.id} className={`bus-routerow ${active ? "is-active" : ""}`} aria-pressed={active} onClick={() => update(active ? { from: "", to: "" } : { from: r.originName, to: r.destinationName })}>
                      <div className="bus-routerow-main">
                        <span className="bus-route-line"><span>{r.originName}</span><IconArrowRight className="bus-arrow" width={16} height={16} /><span>{r.destinationName}</span></span>
                        <span className="bus-hint">{durationLabel(r.durationMinutes)}{r.busType ? ` · ${r.busType.name}` : ""}{r.boardingPoint ? ` · Board at ${r.boardingPoint}` : ""}</span>
                      </div>
                      <div className="bus-routerow-prices">
                        {r.ticketTypes.map((t) => <span key={t.id} className="bus-chip">{t.name} {ugx(t.price)}</span>)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bus-card bus-empty"><strong>No routes yet</strong><p>This company hasn't published any routes.</p></div>
            )}
          </section>

          <section className="bus-section" aria-label="Upcoming trips">
            <TripExplorer filters={filters} date={date} onDate={(d) => update({ date: d })} emptyAction={from || to ? <button type="button" className="bus-btn bus-btn-navy" onClick={() => update({ from: "", to: "" })}>Show all routes</button> : null} />
          </section>
        </>
      )}
    </BusLayout>
  );
}
