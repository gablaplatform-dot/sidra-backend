import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
        <span className="bus-kicker">Your next trip</span>
        <strong>{next.trip.route.originName} <ArrowRight size={18} /> {next.trip.route.destinationName}</strong>
        <span className="bus-next-meta">{dayLabel(eatDate(next.trip.departureAt))} · {eatTime(next.trip.departureAt)} · {next.operator.companyName} · {next.seatCount} {next.seatCount === 1 ? "ticket" : "tickets"} <DelayChip trip={next.trip} /></span>
      </div>
      <span className="bus-btn bus-btn-navy bus-btn-sm">View ticket <ArrowRight size={16} /></span>
    </Link>
  );
}

// Airport-style "leaving soon" board: the next departures across every company, today and tomorrow.
function DepartureBoard() {
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
        kicker={<span className="bus-live"><i aria-hidden="true" />Live departures</span>}
        title={<span id="board-h">Leaving soon</span>}
        sub="The next buses out of every park, updated as companies post delays."
        action={<Link to="/bus/search" className="bus-link">All trips <ChevronRight size={16} /></Link>}
      />
      <div className="bus-board" role="table" aria-label="Next departures">
        <div className="bus-board-top">
          <span><BusIcon size={16} /> Departures</span>
          <span className="bus-board-clock" aria-label="Current time in Kampala">{clock.t} {clock.ap} · EAT</span>
        </div>
        <div className="bus-board-cols" role="row" aria-hidden="true">
          <span>Time</span><span>Destination</span><span>Company</span><span>Boarding point</span><span>Seats</span><span>Status</span><span />
        </div>
        {q.loading ? (
          <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading departures…</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="bus-board-row is-skel" key={i} aria-hidden="true">
                <Skel w={80} h={26} className="on-dark" /><Skel w="70%" h={20} className="on-dark" /><Skel w="60%" h={18} className="on-dark" /><Skel w="70%" h={16} className="on-dark" /><Skel w={50} h={16} className="on-dark" /><Skel w={110} h={26} r={999} className="on-dark" /><span />
              </div>
            ))}
          </div>
        ) : q.error ? (
          <div className="bus-board-msg"><ErrorBox error={q.error} onRetry={q.reload} title="Couldn't load departures" /></div>
        ) : rows.length ? (
          rows.map((t) => {
            const status = tripStatus(t, now);
            const time = timeParts(t.departureAt);
            const isTomorrow = eatDate(t.departureAt) !== today;
            return (
              <Link to={`/bus/trip/${t.id}`} className="bus-board-row" role="row" key={t.id} aria-label={`${t.route.destinationName} at ${eatTime(t.departureAt)} with ${t.operator.companyName}, ${status.label}`}>
                <span className="bus-board-time" role="cell"><b>{time.t}</b><i>{time.ap}</i>{isTomorrow ? <small>Tomorrow</small> : null}</span>
                <span className="bus-board-dest" role="cell"><b>{t.route.destinationName}</b><small>from {t.route.originName}</small></span>
                <span className="bus-board-meta">
                <span className="bus-board-co" role="cell"><BusLogo name={t.operator.companyName} src={t.operator.logoUrl} size={32} /><span>{t.operator.companyName}</span></span>
                <span className="bus-board-bay" role="cell"><Pin size={14} />{t.route.boardingPoint || t.operator.parkName}</span>
                <span className={`bus-board-seats ${t.soldOut ? "is-out" : t.seatsLeft <= 5 ? "is-low" : ""}`} role="cell">{t.soldOut ? "Full" : t.seatsLeft}<small>{t.soldOut ? "" : " left"}</small></span>
                <span className="bus-board-status" role="cell"><StatusPill tone={status.tone}>{status.label}</StatusPill></span>
                </span>
                <span className="bus-board-go" aria-hidden="true"><ChevronRight size={18} /></span>
              </Link>
            );
          })
        ) : (
          <div className="bus-board-msg is-empty">
            <strong>No more departures right now</strong>
            <p>Buses for tomorrow open for booking soon. <Link to="/bus/search" className="bus-link">Browse every trip</Link></p>
          </div>
        )}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Search, title: "Search", text: "Pick where you're going and the day you want to travel." },
  { icon: Wallet, title: "Pay with MoMo", text: "Choose your seats and approve the prompt on your phone." },
  { icon: Qr, title: "Board with QR", text: "Your e-ticket arrives instantly. Show the code and hop on." }
];

const TRUST = [
  { icon: Wallet, title: "MTN MoMo and Airtel Money", text: "No cash, no queue at the park." },
  { icon: Ticket, title: "Instant e-ticket", text: "On screen and by email the moment you pay." },
  { icon: Qr, title: "QR boarding", text: "Nothing to print. Just show your phone." },
  { icon: Refund, title: "Refund if cancelled", text: "If a company cancels, you get your money back." }
];

export default function BusHome() {
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
          <section className="bus-hero" aria-label="Book a bus">
            <Photo src={heroImg} name="Gabla" width={1800} eager className="bus-hero-photo" />
            <span className="bus-hero-shade" aria-hidden="true" />
            <div className="bus-hero-copy">
              <span className="bus-eyebrow"><i aria-hidden="true" />Gabla Bus · e-tickets in minutes</span>
              <h1>Book your bus across Uganda, <em>in minutes</em></h1>
              <p>Choose a route, pick a day, pay with MoMo or Airtel Money and get your e-ticket straight on your phone.</p>
              <ul className="bus-hero-stats" aria-label="Gabla Bus at a glance">
                {parkItems.length ? <li><b>{parkItems.length}</b> bus companies</li> : null}
                {towns ? <li><b>{towns}</b> towns</li> : null}
                {Number.isFinite(cheapest) ? <li>from <b>{ugx(cheapest)}</b></li> : null}
              </ul>
              {routeItems.length ? (
                <div className="bus-hero-routes" aria-label="Popular routes">
                  {routeItems.slice(0, 4).map((r) => (
                    <Link key={`${r.from}-${r.to}`} to={`/bus/search?${new URLSearchParams({ from: r.from, to: r.to })}`}>{r.from} <ArrowRight size={13} /> {r.to}</Link>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          <SearchBox places={places.data} loading={places.loading} className="bus-hero-pill" />
          {places.error ? <div style={{ marginTop: 12 }}><ErrorBox error={places.error} onRetry={places.reload} title="Couldn't load destinations" /></div> : null}
          <NextTrip />
        </div>
      </div>

      <div className="bus-wrap bus-home">
        <DepartureBoard />

        <section className="bus-sec" aria-labelledby="routes-h">
          <SectionHead
            kicker="Most booked"
            title={<span id="routes-h">Popular routes</span>}
            sub="Tap a route to see every departure and price."
            action={<Link to="/bus/search" className="bus-link">All routes <ChevronRight size={16} /></Link>}
          />
          {routes.loading ? (
            <TileSkeletons />
          ) : routes.error ? (
            <ErrorBox error={routes.error} onRetry={routes.reload} />
          ) : !routeItems.length ? (
            <EmptyState title="No routes are on sale yet">Please check back soon - new trips are added every day.</EmptyState>
          ) : (
            <div className="bus-tiles">{routeItems.map((r) => <RouteTile key={`${r.from}-${r.to}`} {...r} />)}</div>
          )}
        </section>

        <section className="bus-sec" aria-labelledby="parks-h">
          <SectionHead
            kicker="Where you board"
            title={<span id="parks-h">Browse by bus park</span>}
            sub="Find the company at the park you travel from."
            action={<Link to="/bus/parks" className="bus-link">All bus parks <ChevronRight size={16} /></Link>}
          />
          {parks.loading ? (
            <CardGridSkeleton count={3} />
          ) : parks.error ? (
            <ErrorBox error={parks.error} onRetry={parks.reload} />
          ) : !parkItems.length ? (
            <EmptyState title="No bus companies yet">Please check back soon.</EmptyState>
          ) : (
            <div className="bus-grid bus-snap">{parkItems.slice(0, 6).map((p) => <ParkCard key={p.id} park={p} />)}</div>
          )}
        </section>

        <section className="bus-sec" aria-labelledby="types-h">
          <SectionHead kicker="Pick your ride" title={<span id="types-h">Browse by bus type</span>} sub="Compare seats and comforts, then see trips." />
          {types.loading ? (
            <CardGridSkeleton count={4} />
          ) : types.error ? (
            <ErrorBox error={types.error} onRetry={types.reload} />
          ) : !typeItems.length ? (
            <EmptyState title="No bus types yet">Please check back soon.</EmptyState>
          ) : (
            <div className="bus-grid bus-grid-4 bus-snap">{typeItems.map((t) => <TypeCard key={t.id} type={t} />)}</div>
          )}
        </section>
      </div>

      <section className="bus-band bus-band-how" aria-labelledby="how-h">
        <div className="bus-wrap">
          <SectionHead kicker="Simple as 1-2-3" title={<span id="how-h">How it works</span>} />
          <ol className="bus-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="bus-step-num">{i + 1}</span>
                <span className="bus-step-icon"><s.icon size={24} /></span>
                <div><strong>{s.title}</strong><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="bus-wrap bus-home">
        <section className="bus-trust" aria-label="Why Gabla Bus">
          {TRUST.map((t) => (
            <div key={t.title} className="bus-trust-item">
              <span><t.icon size={22} /></span>
              <div><strong>{t.title}</strong><p>{t.text}</p></div>
            </div>
          ))}
        </section>
        <aside className="bus-operator-cta">
          <span className="bus-operator-cta-icon"><Shield size={24} /></span>
          <div><strong>Run a bus company?</strong><p>Manage your routes, trips and ticket sales from your company portal.</p></div>
          <Link to="/bus/operator/login" className="bus-btn bus-btn-navy">Company portal <ArrowRight size={16} /></Link>
        </aside>
      </div>
    </BusLayout>
  );
}
