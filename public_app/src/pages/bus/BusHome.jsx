import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import BusLayout from "../../components/bus/BusLayout";
import SearchBox from "../../components/bus/SearchBox";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { Photo, BusLogo, CardGridSkeleton, EmptyState, ErrorBox, ParkCard, RouteTile, SectionHead, StatusPill, TileSkeletons, TypeCard } from "../../components/bus/parts";
import { DelayChip } from "../../components/bus/TicketCard";
import { ArrowRight, BusIcon, ChevronRight, Pin, Qr, Refund, Search, Shield, Ticket, Wallet } from "../../components/bus/icons";
import { Skel } from "../../components/Skeleton";
import { addDays, busApi, dayLabel, eatDate, eatTime, effectiveDeparture, timeParts, todayEat, tripStatus, ugx } from "../../lib/bus";
import { getSession } from "../../lib/session";

function NextTrip() {
  const { t } = useTranslation();
  const session = getSession();
  const { data, loading } = useLoad(() => busApi.myTickets().catch(() => null), [], { enabled: Boolean(session?.accessToken) });
  if (!session?.accessToken) return null;
  if (loading) {
    return (
      <div className="bus-next bus-card" aria-hidden="true">
        <Skel w={52} h={52} r={16} /><div style={{ flex: 1, display: "grid", gap: 8 }}><Skel w="30%" h={12} /><Skel w="60%" h={20} /></div>
      </div>
    );
  }
  const next = (data?.upcoming || []).find((b) => b.status === "confirmed" && b.trip.status === "scheduled" && new Date(b.trip.departureAt).getTime() > Date.now());
  if (!next) return null;
  const firstTicket = next.tickets?.[0];
  return (
    <Link to={firstTicket ? `/bus/tickets/${firstTicket.ticketNumber}` : "/bus/tickets"} className="bus-next bus-card">
      <span className="bus-next-icon"><Ticket size={24} /></span>
      <div className="bus-next-body">
        <span className="bus-kicker">{t("bus.home.nextTrip")}</span>
        <strong>{next.trip.route.originName} <ArrowRight size={18} /> {next.trip.route.destinationName}</strong>
        <span className="bus-next-meta">{dayLabel(eatDate(next.trip.departureAt))} · {eatTime(next.trip.departureAt)} · {next.operator.companyName} · {t("bus.ticketsCount", { count: next.seatCount })} <DelayChip trip={next.trip} /></span>
      </div>
      <span className="bus-btn bus-btn-navy bus-btn-sm">{t("bus.home.viewTicket")} <ArrowRight size={16} /></span>
    </Link>
  );
}

// Airport-style "leaving soon" board: the next departures across every company, today and tomorrow.
function DepartureBoard() {
  const { t: tr } = useTranslation();
  const today = todayEat();
  const tomorrow = addDays(today, 1);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const q = useLoad(async () => {
    const [a, b] = await Promise.all([busApi.trips({ date: today }), busApi.trips({ date: tomorrow }).catch(() => ({ items: [] }))]);
    return [...(a.items || []), ...(b.items || [])];
  }, [today]);

  const rows = useMemo(
    () => (q.data || []).filter((t) => effectiveDeparture(t).getTime() > now - 60000).sort((a, b) => new Date(a.departureAt) - new Date(b.departureAt)).slice(0, 6),
    [q.data, now]
  );
  const clock = timeParts(now);

  return (
    <section className="bus-board-wrap" aria-labelledby="board-h">
      <SectionHead
        kicker={<span className="bus-live"><i aria-hidden="true" />{tr("bus.home.liveDepartures")}</span>}
        title={<span id="board-h">{tr("bus.home.leavingSoon")}</span>}
        sub={tr("bus.home.leavingSub")}
        action={<Link to="/bus/search" className="bus-link">{tr("bus.home.allTrips")} <ChevronRight size={16} /></Link>}
      />
      <div className="bus-board" role="table" aria-label={tr("bus.home.nextDepartures")}>
        <div className="bus-board-top">
          <span><BusIcon size={16} /> {tr("bus.home.departures")}</span>
          <span className="bus-board-clock" aria-label={tr("bus.home.clockAria")}>{clock.t} {clock.ap} · EAT</span>
        </div>
        <div className="bus-board-cols" role="row" aria-hidden="true">
          <span>{tr("bus.home.colTime")}</span><span>{tr("bus.home.colDestination")}</span><span>{tr("bus.home.colCompany")}</span><span>{tr("bus.home.colBoarding")}</span><span>{tr("bus.home.colSeats")}</span><span>{tr("bus.home.colStatus")}</span><span />
        </div>
        {q.loading ? (
          <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">{tr("bus.home.loadingDepartures")}</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="bus-board-row is-skel" key={i} aria-hidden="true">
                <Skel w={80} h={26} className="on-dark" /><Skel w="70%" h={20} className="on-dark" /><Skel w="60%" h={18} className="on-dark" /><Skel w="70%" h={16} className="on-dark" /><Skel w={50} h={16} className="on-dark" /><Skel w={110} h={26} r={999} className="on-dark" /><span />
              </div>
            ))}
          </div>
        ) : q.error ? (
          <div className="bus-board-msg"><ErrorBox error={q.error} onRetry={q.reload} title={tr("bus.home.departuresFailed")} /></div>
        ) : rows.length ? (
          rows.map((t) => {
            const status = tripStatus(t, now);
            const time = timeParts(t.departureAt);
            const isTomorrow = eatDate(t.departureAt) !== today;
            return (
              <Link to={`/bus/trip/${t.id}`} className="bus-board-row" role="row" key={t.id} aria-label={tr("bus.home.rowAria", { to: t.route.destinationName, time: eatTime(t.departureAt), company: t.operator.companyName, status: status.label })}>
                <span className="bus-board-time" role="cell"><b>{time.t}</b><i>{time.ap}</i>{isTomorrow ? <small>{tr("bus.home.tomorrow")}</small> : null}</span>
                <span className="bus-board-dest" role="cell"><b>{t.route.destinationName}</b><small>{tr("bus.home.fromPlace", { place: t.route.originName })}</small></span>
                <span className="bus-board-meta">
                <span className="bus-board-co" role="cell"><BusLogo name={t.operator.companyName} src={t.operator.logoUrl} size={32} /><span>{t.operator.companyName}</span></span>
                <span className="bus-board-bay" role="cell"><Pin size={14} />{t.route.boardingPoint || t.operator.parkName}</span>
                <span className={`bus-board-seats ${t.soldOut ? "is-out" : t.seatsLeft <= 5 ? "is-low" : ""}`} role="cell">{t.soldOut ? tr("bus.home.full") : t.seatsLeft}<small>{t.soldOut ? "" : ` ${tr("bus.home.left")}`}</small></span>
                <span className="bus-board-status" role="cell"><StatusPill tone={status.tone}>{status.label}</StatusPill></span>
                </span>
                <span className="bus-board-go" aria-hidden="true"><ChevronRight size={18} /></span>
              </Link>
            );
          })
        ) : (
          <div className="bus-board-msg is-empty">
            <strong>{tr("bus.home.noDepartures")}</strong>
            <p>{tr("bus.home.noDeparturesSub")} <Link to="/bus/search" className="bus-link">{tr("bus.home.browseEvery")}</Link></p>
          </div>
        )}
      </div>
    </section>
  );
}

const STEPS = [
  { key: "search", icon: Search },
  { key: "pay", icon: Wallet },
  { key: "board", icon: Qr }
];

const TRUST = [
  { key: "momo", icon: Wallet },
  { key: "eticket", icon: Ticket },
  { key: "qr", icon: Qr },
  { key: "refund", icon: Refund }
];

export default function BusHome() {
  const { t } = useTranslation();
  useScrollTop();
  const places = useLoad(() => busApi.places(), []);
  const routes = useLoad(() => busApi.popularRoutes(8), []);
  const parks = useLoad(() => busApi.parks(), []);
  const types = useLoad(() => busApi.types(), []);

  const routeItems = routes.data?.items || [];
  const parkItems = parks.data?.items || [];
  const typeItems = types.data?.items || [];

  // Big coach photo for the hero: the biggest bus type's picture, else any company cover.
  const heroImg = useMemo(() => {
    const t = [...typeItems].filter((x) => x.imageUrl).sort((a, b) => (b.seats || 0) - (a.seats || 0))[0];
    return t?.imageUrl || parkItems.find((p) => p.coverUrl)?.coverUrl || "";
  }, [typeItems, parkItems]);

  const cheapest = routeItems.reduce((m, r) => (r.minPrice ? Math.min(m, Number(r.minPrice)) : m), Infinity);
  const towns = new Set([...(places.data?.origins || []), ...(places.data?.destinations || [])]).size;

  return (
    <BusLayout>
      <div className="bus-band bus-band-hero">
        <div className="bus-wrap">
          <section className="bus-hero" aria-label={t("bus.home.heroAria")}>
            <Photo src={heroImg} name="Gabla" width={1800} eager className="bus-hero-photo" />
            <span className="bus-hero-shade" aria-hidden="true" />
            <div className="bus-hero-copy">
              <span className="bus-eyebrow"><i aria-hidden="true" />{t("bus.home.eyebrow")}</span>
              <h1>{t("bus.home.heroTitle")} <em>{t("bus.home.heroEm")}</em></h1>
              <p>{t("bus.home.heroSub")}</p>
              <ul className="bus-hero-stats" aria-label={t("bus.home.statsAria")}>
                {parkItems.length ? <li><Trans i18nKey="bus.home.statCompanies" count={parkItems.length} components={{ b: <b /> }} /></li> : null}
                {towns ? <li><Trans i18nKey="bus.home.statTowns" count={towns} components={{ b: <b /> }} /></li> : null}
                {Number.isFinite(cheapest) ? <li><Trans i18nKey="bus.home.statFrom" values={{ price: ugx(cheapest) }} components={{ b: <b /> }} /></li> : null}
              </ul>
              {routeItems.length ? (
                <div className="bus-hero-routes" aria-label={t("bus.home.popularAria")}>
                  {routeItems.slice(0, 4).map((r) => (
                    <Link key={`${r.from}-${r.to}`} to={`/bus/search?${new URLSearchParams({ from: r.from, to: r.to })}`}>{r.from} <ArrowRight size={13} /> {r.to}</Link>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          <SearchBox places={places.data} loading={places.loading} className="bus-hero-pill" />
          {places.error ? <div style={{ marginTop: 12 }}><ErrorBox error={places.error} onRetry={places.reload} title={t("bus.home.placesFailed")} /></div> : null}
          <NextTrip />
        </div>
      </div>

      <div className="bus-wrap bus-home">
        <DepartureBoard />

        <section className="bus-sec" aria-labelledby="routes-h">
          <SectionHead
            kicker={t("bus.home.mostBooked")}
            title={<span id="routes-h">{t("bus.home.popularRoutes")}</span>}
            sub={t("bus.home.popularSub")}
            action={<Link to="/bus/search" className="bus-link">{t("bus.home.allRoutes")} <ChevronRight size={16} /></Link>}
          />
          {routes.loading ? (
            <TileSkeletons />
          ) : routes.error ? (
            <ErrorBox error={routes.error} onRetry={routes.reload} />
          ) : !routeItems.length ? (
            <EmptyState title={t("bus.home.noRoutes")}>{t("bus.home.noRoutesSub")}</EmptyState>
          ) : (
            <div className="bus-tiles">{routeItems.map((r) => <RouteTile key={`${r.from}-${r.to}`} {...r} />)}</div>
          )}
        </section>

        <section className="bus-sec" aria-labelledby="parks-h">
          <SectionHead
            kicker={t("bus.home.whereBoard")}
            title={<span id="parks-h">{t("bus.home.browseParks")}</span>}
            sub={t("bus.home.browseParksSub")}
            action={<Link to="/bus/parks" className="bus-link">{t("bus.home.allParks")} <ChevronRight size={16} /></Link>}
          />
          {parks.loading ? (
            <CardGridSkeleton count={3} />
          ) : parks.error ? (
            <ErrorBox error={parks.error} onRetry={parks.reload} />
          ) : !parkItems.length ? (
            <EmptyState title={t("bus.home.noCompanies")}>{t("bus.home.checkBack")}</EmptyState>
          ) : (
            <div className="bus-grid bus-snap">{parkItems.slice(0, 6).map((p) => <ParkCard key={p.id} park={p} />)}</div>
          )}
        </section>

        <section className="bus-sec" aria-labelledby="types-h">
          <SectionHead kicker={t("bus.home.pickRide")} title={<span id="types-h">{t("bus.home.browseTypes")}</span>} sub={t("bus.home.browseTypesSub")} />
          {types.loading ? (
            <CardGridSkeleton count={4} />
          ) : types.error ? (
            <ErrorBox error={types.error} onRetry={types.reload} />
          ) : !typeItems.length ? (
            <EmptyState title={t("bus.home.noTypes")}>{t("bus.home.checkBack")}</EmptyState>
          ) : (
            <div className="bus-grid bus-grid-4 bus-snap">{typeItems.map((t) => <TypeCard key={t.id} type={t} />)}</div>
          )}
        </section>
      </div>

      <section className="bus-band bus-band-how" aria-labelledby="how-h">
        <div className="bus-wrap">
          <SectionHead kicker={t("bus.home.simple")} title={<span id="how-h">{t("bus.home.howItWorks")}</span>} />
          <ol className="bus-steps">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <span className="bus-step-num">{i + 1}</span>
                <span className="bus-step-icon"><s.icon size={24} /></span>
                <div><strong>{t(`bus.home.steps.${s.key}.title`)}</strong><p>{t(`bus.home.steps.${s.key}.text`)}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="bus-wrap bus-home">
        <section className="bus-trust" aria-label={t("bus.home.whyAria")}>
          {TRUST.map((item) => (
            <div key={item.key} className="bus-trust-item">
              <span><item.icon size={22} /></span>
              <div><strong>{t(`bus.home.trust.${item.key}.title`)}</strong><p>{t(`bus.home.trust.${item.key}.text`)}</p></div>
            </div>
          ))}
        </section>
        <aside className="bus-operator-cta">
          <span className="bus-operator-cta-icon"><Shield size={24} /></span>
          <div><strong>{t("bus.home.runCompany")}</strong><p>{t("bus.home.runCompanySub")}</p></div>
          <Link to="/bus/operator/login" className="bus-btn bus-btn-navy">{t("bus.home.companyPortal")} <ArrowRight size={16} /></Link>
        </aside>
      </div>
    </BusLayout>
  );
}
