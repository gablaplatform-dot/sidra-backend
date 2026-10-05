import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import TicketCard, { DelayChip } from "../../components/bus/TicketCard";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { ArrivalTime, BusLogo, ErrorBox, Rating, asList, telHref, waHref } from "../../components/bus/parts";
import { IconArrowRight, IconCheck, IconPhone, IconPin, IconUsers } from "../../components/icons";
import { Skel } from "../../components/Skeleton";
import { busApi, dayLabel, durationLabel, eatDate, eatTime, isUgPhone, normalizeUgPhone, phoneNetwork, ugx } from "../../lib/bus";
import { loginPath } from "../../lib/authRedirect";
import { getSession } from "../../lib/session";

const POLL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const store = {
  get(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: the selection just won't survive a sign-in round trip */
    }
  },
  del(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
};

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function TripSkeleton() {
  return (
    <div className="bus-book-grid" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading trip…</span>
      <div style={{ display: "grid", gap: 18 }} aria-hidden="true">
        <div className="bus-card bus-card-pad"><Skel w="60%" h={28} /><Skel w="40%" h={16} style={{ marginTop: 14 }} /><Skel w="100%" h={60} r={12} style={{ marginTop: 18 }} /></div>
        <div className="bus-card bus-card-pad"><Skel w="35%" h={20} /><Skel w="100%" h={56} r={12} style={{ marginTop: 14 }} /><Skel w="100%" h={56} r={12} style={{ marginTop: 10 }} /></div>
        <div className="bus-card bus-card-pad"><Skel w="35%" h={20} /><Skel w="100%" h={48} r={12} style={{ marginTop: 14 }} /><Skel w="100%" h={48} r={12} style={{ marginTop: 10 }} /></div>
      </div>
      <div className="bus-card bus-card-pad" aria-hidden="true"><Skel w="50%" h={20} /><Skel w="100%" h={16} style={{ marginTop: 16 }} /><Skel w="100%" h={50} r={12} style={{ marginTop: 20 }} /></div>
    </div>
  );
}

function TripSummary({ trip }) {
  const { route, operator, busType } = trip;
  const amenities = asList(busType?.amenities);
  const stops = Array.isArray(route.stops) ? route.stops.filter((s) => s?.name) : [];
  const dep = new Date(trip.departureAt).getTime();
  return (
    <section className="bus-card bus-tripsum" aria-label="Trip details">
      <div className="bus-tripsum-top">
        <span className="bus-trip-co">
          <BusLogo name={operator.companyName} src={operator.logoUrl} />
          <span>
            <Link to={`/bus/parks/${operator.slug}`} className="bus-trip-name">{operator.companyName}</Link>
            <Rating avg={operator.ratingAvg} count={operator.ratingCount} />
          </span>
        </span>
        <span className="bus-chip bus-chip-orange">{dayLabel(eatDate(trip.departureAt))}</span>
      </div>
      <div className="bus-ticket-route">
        <span>{route.originName}</span><IconArrowRight className="bus-arrow" width={22} height={22} /><span>{route.destinationName}</span>
      </div>
      <div className="bus-trip-times" style={{ marginTop: 14 }}>
        <div><strong>{eatTime(trip.departureAt)}</strong><small>Departs</small></div>
        <div className="bus-trip-track">{durationLabel(route.durationMinutes)}</div>
        <div><strong><ArrivalTime departureAt={trip.departureAt} minutes={route.durationMinutes} /></strong><small>Arrives (est.)</small></div>
      </div>
      <div className="bus-trip-meta">
        {busType ? <span className="bus-chip bus-chip-orange">{busType.name}</span> : null}
        <DelayChip trip={trip} />
        <span className="bus-chip"><IconUsers width={13} height={13} /> {trip.soldOut ? "No seats left" : `${trip.seatsLeft} seats left`}</span>
        {amenities.map((a) => <span key={a} className="bus-chip">{a}</span>)}
      </div>
      {trip.note ? <p className="bus-notice" style={{ marginTop: 14 }}>{trip.note}</p> : null}
      <dl className="bus-ticket-facts bus-tripsum-facts">
        <div><dt>Board at</dt><dd>{route.boardingPoint || operator.parkName || "-"}</dd></div>
        <div><dt>Drop-off</dt><dd>{route.dropoffPoint || route.destinationName}</dd></div>
        <div><dt>Bus park</dt><dd>{operator.parkName}{operator.parkDistrict ? `, ${operator.parkDistrict}` : ""}</dd></div>
        {operator.parkAddress && operator.parkAddress !== route.boardingPoint ? <div><dt>Park address</dt><dd>{operator.parkAddress}</dd></div> : null}
      </dl>
      {stops.length ? (
        <div className="bus-stops">
          <span className="bus-label">Stops on the way</span>
          <ol>
            <li><b>{route.originName}</b><small>{eatTime(trip.departureAt)}</small></li>
            {stops.map((s, i) => (
              <li key={`${s.name}-${i}`}><b>{s.name}</b>{Number.isFinite(Number(s.minutesFromStart)) ? <small>~{eatTime(new Date(dep + Number(s.minutesFromStart) * 60000))}</small> : null}</li>
            ))}
            <li><b>{route.destinationName}</b><small>~<ArrivalTime departureAt={trip.departureAt} minutes={route.durationMinutes} /></small></li>
          </ol>
        </div>
      ) : null}
      {operator.contactPhone || operator.whatsapp ? (
        <div className="bus-company-actions">
          {operator.contactPhone ? <a className="bus-btn bus-btn-light bus-btn-sm" href={telHref(operator.contactPhone)}><IconPhone width={16} height={16} /> Call {operator.contactPhone}</a> : null}
          {operator.whatsapp ? <a className="bus-btn bus-btn-light bus-btn-sm" href={waHref(operator.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
        </div>
      ) : null}
    </section>
  );
}

// Keyed by trip so moving between trips never carries one trip's selection into another.
export default function BusTrip() {
  const { tripId } = useParams();
  return <BusTripPage key={tripId} tripId={tripId} />;
}

function BusTripPage({ tripId }) {
  useScrollTop(tripId);
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const signedIn = Boolean(session?.accessToken);
  const selKey = `bus-selection:${tripId}`;
  const pendKey = `bus-pending:${tripId}`;

  const tripQ = useLoad(() => busApi.trip(tripId), [tripId]);
  const trip = tripQ.data;

  // What the buyer chose before being sent off to sign in (or before a reload). Read synchronously
  // so React StrictMode's double-mounted effects can't overwrite it before we use it.
  const savedRef = useRef(null);
  if (savedRef.current === null) savedRef.current = store.get(selKey) || {};
  const saved = savedRef.current;

  const [qty, setQty] = useState(() => saved.qty || {});
  const [name, setName] = useState(saved.name || session?.user?.name || "");
  const [phone, setPhone] = useState(saved.phone || session?.user?.phone || "");
  const [email, setEmail] = useState(saved.email || "");
  const [payPhone, setPayPhone] = useState(saved.payPhone || saved.phone || session?.user?.phone || "");
  const [payTouched, setPayTouched] = useState(Boolean(saved.payPhone));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [phase, setPhase] = useState("form"); // form | waiting | confirmed | failed
  const [pending, setPending] = useState(null); // {id, reference, expiresAt, total, payPhone}
  const [finalBooking, setFinalBooking] = useState(null);
  const [pollWarn, setPollWarn] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    store.set(selKey, { qty, name, phone, email, payPhone: payTouched ? payPhone : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, name, phone, email, payPhone, payTouched]);

  // If we were signed out when we started, fill the name/phone from the account once it's there.
  useEffect(() => {
    if (!signedIn) return;
    const u = getSession()?.user;
    setName((v) => v || u?.name || "");
    setPhone((v) => v || u?.phone || "");
    setPayPhone((v) => v || u?.phone || "");
  }, [signedIn]);

  // Pay number follows the passenger number until the buyer types a different one.
  useEffect(() => {
    if (!payTouched) setPayPhone(phone);
  }, [phone, payTouched]);

  // Resume a payment that was in flight when the page was refreshed.
  useEffect(() => {
    const p = store.get(pendKey);
    if (!p || !signedIn) return undefined;
    let alive = true;
    busApi.booking(p.id).then((b) => {
      if (!alive) return;
      if (b.status === "confirmed") { setFinalBooking(b); setPhase("confirmed"); store.del(pendKey); }
      else if (b.status === "pending_payment" && !b.expired) { setPending(p); setPhase("waiting"); }
      else { store.del(pendKey); }
    }).catch(() => store.del(pendKey));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, signedIn]);

  const types = trip?.ticketTypes || [];
  const total = useMemo(() => types.reduce((sum, t) => sum + (qty[t.id] || 0) * Number(t.price), 0), [types, qty]);
  const count = useMemo(() => types.reduce((sum, t) => sum + (qty[t.id] || 0), 0), [types, qty]);
  const cap = trip ? Math.max(0, Math.min(trip.maxPerBooking || 10, trip.seatsLeft)) : 0;

  // Drop restored quantities that no longer fit (ticket type removed, fewer seats left).
  useEffect(() => {
    if (!trip) return;
    setQty((q) => {
      let left = cap;
      const next = {};
      for (const t of trip.ticketTypes) {
        const n = Math.min(q[t.id] || 0, left);
        if (n > 0) { next[t.id] = n; left -= n; }
      }
      return JSON.stringify(next) === JSON.stringify(q) ? q : next;
    });
  }, [trip, cap]);

  const step = (id, delta) => setQty((q) => {
    const cur = q[id] || 0;
    const sum = Object.values(q).reduce((a, b) => a + b, 0);
    const next = Math.max(0, cur + delta);
    if (delta > 0 && sum >= cap) return q;
    return { ...q, [id]: next };
  });

  // Poll for the payment result.
  useEffect(() => {
    if (phase !== "waiting" || !pending) return undefined;
    let stopped = false;
    let fails = 0;
    const started = Date.now();
    const tick = async () => {
      try {
        const b = await busApi.booking(pending.id);
        if (stopped) return;
        fails = 0;
        setPollWarn(false);
        if (b.status === "confirmed") {
          store.del(pendKey); store.del(selKey);
          setFinalBooking(b); setPhase("confirmed");
        } else if (b.status !== "pending_payment" || b.expired) {
          store.del(pendKey);
          setFinalBooking(b); setPhase("failed"); tripQ.reload();
        } else if (Date.now() - started > POLL_MAX_MS) {
          setPhase("failed");
        }
      } catch (err) {
        if (stopped) return;
        fails += 1;
        if (err.status === 401) { navigate(loginPath(location), { replace: true }); return; }
        if (fails >= 2) setPollWarn(true);
      }
    };
    const id = setInterval(tick, POLL_MS);
    const clockId = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; clearInterval(id); clearInterval(clockId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pending]);

  const errors = useMemo(() => {
    const e = {};
    if (count < 1) e.tickets = "Choose at least one ticket.";
    if (name.trim().length < 2) e.name = "Enter the passenger's full name.";
    if (!isUgPhone(phone)) e.phone = "Enter a valid Ugandan number, e.g. 0772 123 456.";
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = "That email doesn't look right.";
    if (!isUgPhone(payPhone)) e.payPhone = "Enter the MTN or Airtel number you'll pay from.";
    return e;
  }, [count, name, phone, email, payPhone]);

  const pay = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSubmitted(true);
    if (!signedIn) {
      if (count < 1) return;
      navigate(loginPath(location));
      return;
    }
    if (Object.keys(errors).length) {
      setTimeout(() => {
        if (errors.tickets) document.getElementById("tickets-h")?.scrollIntoView({ block: "center", behavior: "smooth" });
        else document.querySelector('[aria-invalid="true"]')?.focus();
      }, 0);
      return;
    }
    setSubmitting(true);
    try {
      const res = await busApi.book({
        tripId,
        items: types.filter((t) => qty[t.id] > 0).map((t) => ({ ticketTypeId: t.id, quantity: qty[t.id] })),
        passenger: { name: name.trim(), phone: normalizeUgPhone(phone), ...(email.trim() ? { email: email.trim() } : {}) },
        payPhone: normalizeUgPhone(payPhone)
      });
      const p = { id: res.bookingId, reference: res.reference, expiresAt: res.expiresAt, total: res.total, message: res.message, payPhone: normalizeUgPhone(payPhone) };
      store.set(pendKey, p);
      setPending(p);
      setPollWarn(false);
      setNow(Date.now());
      setPhase("waiting");
    } catch (err) {
      if (err.status === 401) { navigate(loginPath(location)); return; }
      setFormError(err.code === "VALIDATION_ERROR" ? { message: "Some details look wrong. Check the passenger name, both phone numbers and the email, then try again." } : err);
      if (["BUS_NOT_ENOUGH_SEATS", "BUS_SALES_CLOSED", "BUS_TRIP_CANCELLED", "BUS_TRIP_NOT_FOUND"].includes(err.code)) tripQ.reload();
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = useCallback(() => {
    store.del(pendKey);
    setPending(null);
    setFinalBooking(null);
    setFormError(null);
    setPhase("form");
    tripQ.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ render
  const crumbs = (
    <nav className="bus-breadcrumb" aria-label="Breadcrumb">
      <Link to="/bus">Gabla Bus</Link><span>/</span>
      <Link to="/bus/search">Trips</Link><span>/</span>
      <span>{trip ? `${trip.route.originName} to ${trip.route.destinationName}` : "Trip"}</span>
    </nav>
  );

  if (tripQ.error) {
    const gone = tripQ.error.status === 404;
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-card bus-empty">
          <strong>{gone ? "This trip isn't available any more" : "Couldn't load this trip"}</strong>
          <p>{gone ? "It may have been removed. Pick another departure." : tripQ.error.status === 429 ? "Lots of people are booking right now. Wait a few seconds and try again." : tripQ.error.message}</p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
            {!gone ? <button type="button" className="bus-btn bus-btn-navy" onClick={tripQ.reload}>Try again</button> : null}
            <Link to="/bus/search" className="bus-btn bus-btn-light">Find another trip</Link>
          </div>
        </div>
      </BusLayout>
    );
  }

  if (!trip) return <BusLayout>{crumbs}<TripSkeleton /></BusLayout>;

  if (phase === "waiting" && pending) {
    const left = new Date(pending.expiresAt).getTime() - now;
    const network = phoneNetwork(pending.payPhone);
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-narrow">
          <div className="bus-card bus-pay-box" role="status" aria-live="polite">
            <div className="bus-spinner" aria-hidden="true" />
            <h1 className="bus-page-title" style={{ fontSize: 24 }}>Check your phone and approve the payment</h1>
            <p style={{ marginTop: 10 }}>We sent a request for <b>{ugx(pending.total)}</b> to <b>{pending.payPhone ? `+${pending.payPhone}` : "your phone"}</b>{network ? ` (${network})` : ""}. Enter your PIN to approve it.</p>
            <p className="bus-hint" style={{ marginTop: 10 }}>Reference <b>{pending.reference}</b>. Keep this page open - your tickets appear here the moment the payment goes through.</p>
            {left > 0 ? <p className="bus-hold-clock">Seats held for <b>{clock(left)}</b></p> : <p className="bus-hold-clock">Finishing up…</p>}
            {pollWarn ? <div className="bus-alert bus-alert-warn" style={{ marginTop: 14 }}>We're having trouble reaching the server. We'll keep trying - your payment is not affected.</div> : null}
            <p style={{ marginTop: 18 }}><Link to="/bus/tickets" className="bus-link">I'll check My tickets later</Link></p>
          </div>
        </div>
      </BusLayout>
    );
  }

  if (phase === "confirmed" && finalBooking) {
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-success">
          <span className="bus-success-icon"><IconCheck width={30} height={30} /></span>
          <h1 className="bus-page-title">You're booked!</h1>
          <p className="bus-section-sub">Payment received. Reference <b>{finalBooking.reference}</b> · {finalBooking.tickets.length} {finalBooking.tickets.length === 1 ? "ticket" : "tickets"} · {ugx(finalBooking.total)}</p>
          <div className="bus-success-actions">
            <Link to="/bus/tickets" className="bus-btn bus-btn-primary">View my tickets</Link>
            <Link to="/bus" className="bus-btn bus-btn-light">Book another trip</Link>
          </div>
        </div>
        <div className="bus-narrow-wide">
          {finalBooking.tickets.map((t) => <TicketCard key={t.id} ticket={t} booking={finalBooking} link />)}
        </div>
        <p className="bus-hint" style={{ textAlign: "center", marginTop: 16 }}>Tip: take a screenshot of your QR code so you have it even without signal.</p>
      </BusLayout>
    );
  }

  if (phase === "failed") {
    const expired = finalBooking?.status === "expired" || finalBooking?.expired || !finalBooking;
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-narrow">
          <div className="bus-card bus-pay-box" role="alert">
            <h1 className="bus-page-title" style={{ fontSize: 24 }}>{expired ? "We didn't get your payment in time" : "The payment didn't go through"}</h1>
            <p style={{ marginTop: 10 }}>{expired ? "The approval window ran out and your seats were released." : "The payment was declined or cancelled on your phone."} No tickets were issued.</p>
            <p className="bus-hint" style={{ marginTop: 10 }}>If money was taken from your account, contact the bus company or Gabla support and quote reference <b>{pending?.reference || finalBooking?.reference}</b>.</p>
            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="bus-btn bus-btn-primary" onClick={startOver}>Try again</button>
              <Link to="/bus/tickets" className="bus-btn bus-btn-light">My tickets</Link>
            </div>
          </div>
        </div>
      </BusLayout>
    );
  }

  // ---- the booking form
  const departed = new Date(trip.departureAt).getTime() <= Date.now();
  const cancelled = trip.status === "cancelled";
  const blocked = cancelled ? "This trip has been cancelled." : trip.soldOut ? "This trip is sold out." : departed ? "This trip has already left." : !trip.bookable ? "Ticket sales for this trip have closed." : "";
  const network = phoneNetwork(payPhone);
  const show = (key) => (submitted ? errors[key] : "");
  const payLabel = !signedIn ? "Sign in to buy" : count < 1 ? "Choose your tickets" : `Pay ${ugx(total)}`;

  return (
    <BusLayout>
      {crumbs}
      <form className={`bus-book-grid ${blocked ? "is-single" : ""}`} onSubmit={pay} noValidate>
        <div className="bus-book-main">
          <TripSummary trip={trip} />

          {blocked ? (
            <div className="bus-card bus-card-pad bus-blocked" role="alert">
              <strong>{blocked}</strong>
              <p className="bus-hint">Pick another departure on the same route.</p>
              <Link to={`/bus/search?${new URLSearchParams({ from: trip.route.originName, to: trip.route.destinationName, date: eatDate(trip.departureAt) })}`} className="bus-btn bus-btn-navy" style={{ marginTop: 12 }}>See other trips</Link>
            </div>
          ) : (
            <>
              <section className="bus-card bus-card-pad" aria-labelledby="tickets-h">
                <h2 className="bus-section-title" id="tickets-h">1. Choose tickets</h2>
                <p className="bus-section-sub">Up to {cap} {cap === 1 ? "ticket" : "tickets"} in one booking.</p>
                <div>
                  {types.map((t) => (
                    <div className="bus-ticket-row" key={t.id}>
                      <div>
                        <strong>{t.name}</strong>
                        {t.description ? <p className="bus-hint">{t.description}</p> : null}
                        <div className="bus-price">{ugx(t.price)}</div>
                      </div>
                      <div className="bus-qty" role="group" aria-label={`${t.name} quantity`}>
                        <button type="button" onClick={() => step(t.id, -1)} disabled={!qty[t.id]} aria-label={`Fewer ${t.name} tickets`}>−</button>
                        <output aria-live="polite">{qty[t.id] || 0}</output>
                        <button type="button" onClick={() => step(t.id, 1)} disabled={count >= cap} aria-label={`More ${t.name} tickets`}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {show("tickets") ? <p className="bus-field-error" role="alert">{errors.tickets}</p> : null}
                {count >= cap && cap > 0 ? <p className="bus-hint" style={{ marginTop: 8 }}>{cap === trip.seatsLeft && trip.seatsLeft < (trip.maxPerBooking || 10) ? `Only ${trip.seatsLeft} seats are left.` : `That's the most you can buy at once (${cap}).`}</p> : null}
              </section>

              <section className="bus-card bus-card-pad" aria-labelledby="pax-h">
                <h2 className="bus-section-title" id="pax-h">2. Passenger details</h2>
                <p className="bus-section-sub">The name printed on your tickets{count > 1 ? " (used for all seats)" : ""}.</p>
                <div className="bus-form-grid">
                  <label className="bus-field bus-span-2">
                    <span>Full name</span>
                    <input className="bus-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={Boolean(show("name"))} />
                    {show("name") ? <em className="bus-field-error">{errors.name}</em> : null}
                  </label>
                  <label className="bus-field">
                    <span>Phone</span>
                    <input className="bus-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0772 123 456" autoComplete="tel" aria-invalid={Boolean(show("phone"))} />
                    {show("phone") ? <em className="bus-field-error">{errors.phone}</em> : null}
                  </label>
                  <label className="bus-field">
                    <span>Email <small>(optional)</small></span>
                    <input className="bus-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={session?.user?.email ? "Defaults to your account email" : "Tickets are also emailed"} autoComplete="email" aria-invalid={Boolean(show("email"))} />
                    {show("email") ? <em className="bus-field-error">{errors.email}</em> : null}
                  </label>
                </div>
              </section>

              <section className="bus-card bus-card-pad" aria-labelledby="pay-h">
                <h2 className="bus-section-title" id="pay-h">3. Pay with mobile money</h2>
                <p className="bus-section-sub">We'll send an approval request to this number.</p>
                <label className="bus-field" style={{ marginTop: 12 }}>
                  <span>Mobile money number</span>
                  <input className="bus-input" type="tel" inputMode="tel" value={payPhone} onChange={(e) => { setPayPhone(e.target.value); setPayTouched(true); }} placeholder="0772 123 456 (MTN) or 0752 123 456 (Airtel)" aria-invalid={Boolean(show("payPhone"))} />
                  {isUgPhone(payPhone) ? <em className="bus-field-ok"><IconCheck width={14} height={14} /> {network || "Mobile money number"} · +{normalizeUgPhone(payPhone)}</em> : null}
                  {show("payPhone") ? <em className="bus-field-error">{errors.payPhone}</em> : null}
                </label>
              </section>
            </>
          )}
        </div>

        {blocked ? null : (
        <aside className="bus-summary bus-card bus-card-pad" aria-label="Order summary">
          <h2 className="bus-section-title">Your order</h2>
          <p className="bus-hint">{trip.route.originName} → {trip.route.destinationName} · {dayLabel(eatDate(trip.departureAt))}, {eatTime(trip.departureAt)}</p>
          <div style={{ marginTop: 12 }}>
            {count < 1 ? <p className="bus-hint">No tickets chosen yet.</p> : types.filter((t) => qty[t.id] > 0).map((t) => (
              <div className="bus-line" key={t.id}><span>{qty[t.id]} × {t.name}</span><b>{ugx(qty[t.id] * Number(t.price))}</b></div>
            ))}
            <div className="bus-line is-total"><span>Total</span><span>{ugx(total)}</span></div>
          </div>
          {!signedIn && !blocked ? <div className="bus-alert bus-alert-info" style={{ marginTop: 14 }}>Sign in to buy. We'll bring you straight back here with your choices saved.</div> : null}
          {formError ? <div className="bus-alert bus-alert-error" role="alert" style={{ marginTop: 14 }}>{formError.message || "Something went wrong. Please try again."}</div> : null}
          {submitted && signedIn && Object.keys(errors).length && !formError ? <div className="bus-alert bus-alert-warn" role="alert" style={{ marginTop: 14 }}>Please fix the highlighted details above.</div> : null}
          <button type="submit" className="bus-btn bus-btn-primary bus-btn-block bus-pay-btn" disabled={Boolean(blocked) || submitting || (signedIn && count < 1)} style={{ marginTop: 16 }}>
            {submitting ? "Sending payment request…" : payLabel}
          </button>
          <p className="bus-hint bus-hold-note">Seats are held for {trip.holdMinutes} minutes while you pay. Sales close 10 minutes before departure.</p>
        </aside>
        )}
      </form>
    </BusLayout>
  );
}
