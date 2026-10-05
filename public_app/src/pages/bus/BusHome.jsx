import React, { useState } from "react";
import { Link } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import SearchBox from "../../components/bus/SearchBox";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { CardGridSkeleton, ErrorBox, ParkCard, RouteTile, TypeCard } from "../../components/bus/parts";
import { DelayChip } from "../../components/bus/TicketCard";
import { IconArrowRight, IconQr, IconTicket, IconWallet } from "../../components/icons";
import { Skel } from "../../components/Skeleton";
import { busApi, dayLabel, eatDate, eatTime } from "../../lib/bus";
import { getSession } from "../../lib/session";

const TABS = [
  { id: "route", label: "By route" },
  { id: "park", label: "By bus park" },
  { id: "type", label: "By bus type" }
];

function NextTrip() {
  const session = getSession();
  const { data, loading } = useLoad(() => busApi.myTickets().catch(() => null), [], { enabled: Boolean(session?.accessToken) });
  if (!session?.accessToken) return null;
  if (loading) return <div className="bus-card bus-next" aria-hidden="true"><Skel w="40%" h={14} /><Skel w="70%" h={22} style={{ marginTop: 10 }} /></div>;
  const next = (data?.upcoming || []).find((b) => b.status === "confirmed" && b.trip.status === "scheduled" && new Date(b.trip.departureAt).getTime() > Date.now());
  if (!next) return null;
  const firstTicket = next.tickets?.[0];
  return (
    <Link to={firstTicket ? `/bus/tickets/${firstTicket.ticketNumber}` : "/bus/tickets"} className="bus-card bus-next">
      <span className="bus-next-icon"><IconTicket width={24} height={24} /></span>
      <div className="bus-next-body">
        <span className="bus-label">Your next trip</span>
        <strong>{next.trip.route.originName} → {next.trip.route.destinationName}</strong>
        <span className="bus-hint">{dayLabel(eatDate(next.trip.departureAt))} · {eatTime(next.trip.departureAt)} · {next.operator.companyName} · {next.seatCount} {next.seatCount === 1 ? "ticket" : "tickets"} <DelayChip trip={next.trip} /></span>
      </div>
      <span className="bus-btn bus-btn-navy bus-btn-sm">View ticket <IconArrowRight width={16} height={16} /></span>
    </Link>
  );
}

export default function BusHome() {
  useScrollTop();
  const [tab, setTab] = useState("route");
  const places = useLoad(() => busApi.places(), []);
  const routes = useLoad(() => busApi.popularRoutes(9), [], { enabled: tab === "route" });
  const parks = useLoad(() => busApi.parks(), [], { enabled: tab === "park" });
  const types = useLoad(() => busApi.types(), [], { enabled: tab === "type" });

  const panel = { route: routes, park: parks, type: types }[tab];
  const items = panel.data?.items || [];

  return (
    <BusLayout>
      <section className="bus-hero">
        <h1>Book your bus across Uganda, <em>in minutes</em></h1>
        <p>Choose a route, pick a day, pay with MoMo or Airtel Money and get your e-ticket straight on your phone.</p>
        <SearchBox places={places.data} loading={places.loading} />
        {places.error ? <div style={{ marginTop: 12 }}><ErrorBox error={places.error} onRetry={places.reload} title="Couldn't load destinations" /></div> : null}
      </section>

      <NextTrip />

      <section className="bus-section" aria-label="Browse trips">
        <div className="bus-tabs" role="tablist" aria-label="Browse by">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`bus-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="bus-section-head" style={{ marginTop: 14 }}>
          <div>
            <h2 className="bus-section-title">{tab === "route" ? "Popular routes" : tab === "park" ? "Bus companies and their parks" : "Pick the ride you like"}</h2>
            <p className="bus-section-sub">
              {tab === "route" ? "Tap a route to see every departure." : tab === "park" ? "Find the company at the park you board from." : "Compare seats and comforts, then see trips."}
            </p>
          </div>
          {tab === "park" ? <Link to="/bus/parks" className="bus-link">See all parks</Link> : null}
        </div>

        <div role="tabpanel">
          {panel.loading ? (
            <CardGridSkeleton count={6} />
          ) : panel.error ? (
            <ErrorBox error={panel.error} onRetry={panel.reload} />
          ) : !items.length ? (
            <div className="bus-card bus-empty">
              <strong>{tab === "route" ? "No routes are on sale yet" : tab === "park" ? "No bus companies yet" : "No bus types yet"}</strong>
              <p>Please check back soon - new trips are added every day.</p>
            </div>
          ) : (
            <div className="bus-grid">
              {tab === "route" && items.map((r) => <RouteTile key={`${r.from}-${r.to}`} {...r} />)}
              {tab === "park" && items.map((p) => <ParkCard key={p.id} park={p} />)}
              {tab === "type" && items.map((t) => <TypeCard key={t.id} type={t} />)}
            </div>
          )}
        </div>
      </section>

      <section className="bus-section bus-why" aria-label="Why Gabla Bus">
        <div className="bus-why-item">
          <span><IconWallet width={24} height={24} /></span>
          <div><strong>Pay with MTN MoMo or Airtel Money</strong><p>Approve a prompt on your phone. No cash, no queues at the park.</p></div>
        </div>
        <div className="bus-why-item">
          <span><IconTicket width={24} height={24} /></span>
          <div><strong>Instant e-ticket</strong><p>Your ticket arrives the moment payment goes through - on screen and by email.</p></div>
        </div>
        <div className="bus-why-item">
          <span><IconQr width={24} height={24} /></span>
          <div><strong>QR boarding</strong><p>Show the QR code to the conductor and hop on. Nothing to print.</p></div>
        </div>
      </section>
    </BusLayout>
  );
}
