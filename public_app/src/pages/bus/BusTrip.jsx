import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import BusLayout from "../../components/bus/BusLayout";
import TicketCard, { DelayChip } from "../../components/bus/TicketCard";
import { Clock as BigClock } from "../../components/bus/TripList";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { AmenityChips, BusLogo, EmptyState, Photo, Rating, StatusPill, asList, telHref, waHref } from "../../components/bus/parts";
import { ArrowRight, BusIcon, Calendar, Chat, ChevronLeft, Check, Clock, Phone, Pin, Users } from "../../components/bus/icons";
import { Skel } from "../../components/Skeleton";
import {
  arrivalAt, busApi, dayDiff, dayLabel, durationLabel, eatDate, eatTime, effectiveDeparture, isUgPhone, normalizeUgPhone,
  phoneNetwork, stopOffset, stopsLabel, stopsOf, tripStatus, ugx, weekdayLong
} from "../../lib/bus";
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
  const { t: tr } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{tr("bus.trip.loading")}</span>
      <div className="bus-triphero is-skel" aria-hidden="true" />
      <div className="bus-wrap bus-tripgrid" aria-hidden="true">
        <div className="bus-tripmain">
          <div className="bus-sheetcard">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Skel w={200} h={44} r={14} /><Skel w={90} h={28} r={999} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}><Skel w={110} h={56} /><Skel w="30%" h={10} r={999} style={{ alignSelf: "center" }} /><Skel w={110} h={56} /></div>
            <div className="bus-tiles4" style={{ marginTop: 26 }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={78} r={16} />)}</div>
            <Skel w="40%" h={18} style={{ marginTop: 28 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>{[0, 1, 2].map((i) => <Skel key={i} w={120} h={38} r={999} />)}</div>
          </div>
          <div className="bus-stepcard"><Skel w="35%" h={22} /><Skel w="100%" h={70} r={16} style={{ marginTop: 16 }} /><Skel w="100%" h={70} r={16} style={{ marginTop: 10 }} /></div>
        </div>
        <div className="bus-summary bus-stepcard"><Skel w="50%" h={22} /><Skel w="100%" h={16} style={{ marginTop: 16 }} /><Skel w="100%" h={54} r={14} style={{ marginTop: 22 }} /></div>
      </div>
    </div>
  );
}

// Photo hero: the bus' own picture with the company and bus type pinned on it.
function TripHero({ trip, onBack }) {
  const { t: tr } = useTranslation();
  const { operator, busType, route } = trip;
  return (
    <section className="bus-triphero" aria-label={tr("bus.trip.photoAria")}>
      <Photo src={busType?.imageUrl} name={operator.companyName} width={1400} eager className="bus-triphero-photo" />
      <span className="bus-hero-shade is-trip" aria-hidden="true" />
      <div className="bus-wrap bus-triphero-in">
        <div className="bus-triphero-top">
          <button type="button" className="bus-glassbtn" onClick={onBack}><ChevronLeft size={18} /> {tr("bus.trip.back")}</button>
          <nav className="bus-breadcrumb is-light" aria-label={tr("bus.breadcrumb")}><Link to="/bus">Gabla Bus</Link><span>/</span><Link to="/bus/search">{tr("bus.trip.trips")}</Link><span>/</span><span>{tr("bus.trip.routeTo", { from: route.originName, to: route.destinationName })}</span></nav>
          {busType ? <span className="bus-typetag">{busType.name}</span> : null}
        </div>
        <div className="bus-triphero-chips">
          <Link to={`/bus/parks/${operator.slug}`} className="bus-cochip">
            <BusLogo name={operator.companyName} src={operator.logoUrl} size={34} />
            <span><b>{operator.companyName}</b><Rating avg={operator.ratingAvg} count={operator.ratingCount} /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// The rounded sheet that overlaps the photo: route, key facts, facilities and the stop-by-stop timeline.
function TripSheet({ trip }) {
  const { t: tr } = useTranslation();
  const { route, operator, busType } = trip;
  const arrive = arrivalAt(trip.departureAt, route.durationMinutes);
  const plus = dayDiff(trip.departureAt, arrive);
  const stops = stopsOf(route);
  const depMs = new Date(trip.departureAt).getTime();
  const status = tripStatus(trip);
  const pct = trip.seats ? Math.max(4, Math.min(100, Math.round((trip.seatsLeft / trip.seats) * 100))) : 0;
  const amenities = asList(busType?.amenities);
  const boardAt = route.boardingPoint || operator.parkName || "-";

  return (
    <section className="bus-sheetcard" aria-label={tr("bus.trip.detailsAria")}>
      <div className="bus-sheet-top">
        <div className="bus-sheet-title">
          <span className="bus-kicker">{dayLabel(eatDate(trip.departureAt))} · {trip.soldOut ? tr("bus.tripStatus.soldOut") : tr("bus.trip.openForBooking")}</span>
          <h1>{route.originName} <ArrowRight size={22} /> {route.destinationName}</h1>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      <div className="bus-journey">
        <div className="bus-journey-leg">
          <small className="bus-lbl">{tr("bus.trips.departs")}</small>
          <BigClock value={trip.departureAt} />
          <span className="bus-journey-town">{route.originName}</span>
        </div>
        <div className="bus-journey-track" title={stops.length ? stops.map((s) => s.name).join(" · ") : tr("bus.trip.direct")}>
          <span className="bus-journey-dur">{durationLabel(route.durationMinutes)}</span>
          <span className="bus-trip-track" aria-hidden="true"><i className="end" />{stops.slice(0, 6).map((s, i) => <i key={i} className="mid" />)}<i className="end" /></span>
          <span className="bus-journey-stops">{stopsLabel(route)}</span>
        </div>
        <div className="bus-journey-leg is-right">
          <small className="bus-lbl">{tr("bus.trip.arrivesEst")}</small>
          <BigClock value={arrive} plus={plus} />
          <span className="bus-journey-town">{route.destinationName}</span>
        </div>
      </div>

      {trip.note ? <p className="bus-notice">{trip.note}</p> : null}
      {Number(trip.delayMinutes) > 0 ? <div className="bus-alert bus-alert-warn" style={{ marginTop: 14 }}><DelayChip trip={trip} /> {tr("bus.trip.nowLeaves", { time: eatTime(effectiveDeparture(trip)) })}</div> : null}

      <div className="bus-tiles4">
        <div className="bus-infotile"><span className="bus-lbl"><Calendar size={14} /> {tr("bus.trip.date")}</span><b>{dayLabel(eatDate(trip.departureAt))}</b><small>{weekdayLong(eatDate(trip.departureAt))}</small></div>
        <div className="bus-infotile">
          <span className="bus-lbl"><Users size={14} /> {tr("bus.trip.remaining")}</span>
          <b>{trip.soldOut ? tr("bus.trip.noSeats") : tr("bus.parts.seats", { count: trip.seatsLeft })}</b>
          <span className={`bus-meter ${trip.seatsLeft <= 5 ? "is-low" : ""}`} aria-hidden="true"><i style={{ width: `${trip.soldOut ? 0 : pct}%` }} /></span>
        </div>
        <div className="bus-infotile"><span className="bus-lbl"><Pin size={14} /> {tr("bus.trip.boarding")}</span><b>{boardAt}</b><small>{operator.parkName}{operator.parkDistrict ? `, ${operator.parkDistrict}` : ""}</small></div>
        <div className="bus-infotile"><span className="bus-lbl"><Clock size={14} /> {tr("bus.trip.dropoff")}</span><b>{route.dropoffPoint || route.destinationName}</b><small>{dayLabel(eatDate(arrive))}</small></div>
      </div>

      {amenities.length ? (
        <div className="bus-block">
          <h2 className="bus-block-title">{tr("bus.trip.facilities")}</h2>
          <AmenityChips list={amenities} max={12} tone="is-big" />
        </div>
      ) : null}

      <div className="bus-block">
        <h2 className="bus-block-title">{tr("bus.trip.routeStops")}</h2>
        <ol className="bus-timeline">
          <li className="is-first">
            <time>{eatTime(trip.departureAt)}</time>
            <span className="bus-tl-dot" aria-hidden="true" />
            <div><b>{route.originName}</b><small>{tr("bus.trips.boardAt", { place: boardAt })}</small></div>
          </li>
          {stops.map((s, i) => {
            const off = stopOffset(s);
            return (
              <li key={`${s.name}-${i}`}>
                <time>{off === null ? "" : `~${eatTime(new Date(depMs + off * 60000))}`}</time>
                <span className="bus-tl-dot" aria-hidden="true" />
                <div><b>{s.name}</b><small>{off === null ? tr("bus.trip.stopOnWay") : tr("bus.trip.stopIn", { time: durationLabel(off) })}</small></div>
              </li>
            );
          })}
          <li className="is-last">
            <time>~{eatTime(arrive)}{plus > 0 ? <sup className="bus-plusday">+{plus}</sup> : null}</time>
            <span className="bus-tl-dot" aria-hidden="true" />
            <div><b>{route.destinationName}</b><small>{route.dropoffPoint ? tr("bus.trip.dropoffAt", { place: route.dropoffPoint }) : tr("bus.trip.finalStop")}</small></div>
          </li>
        </ol>
      </div>

      {operator.contactPhone || operator.whatsapp ? (
        <div className="bus-company-actions">
          {operator.contactPhone ? <a className="bus-btn bus-btn-light bus-btn-sm" href={telHref(operator.contactPhone)}><Phone size={16} /> {tr("bus.trip.callCompany", { company: operator.companyName })}</a> : null}
          {operator.whatsapp ? <a className="bus-btn bus-btn-light bus-btn-sm" href={waHref(operator.whatsapp)} target="_blank" rel="noopener noreferrer"><Chat size={16} /> WhatsApp</a> : null}
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
  const { t: tr } = useTranslation();
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
    if (count < 1) e.tickets = tr("bus.trip.errTickets");
    if (name.trim().length < 2) e.name = tr("bus.trip.errName");
    if (!isUgPhone(phone)) e.phone = tr("bus.trip.errPhone");
    if (email.trim() && !EMAIL_RE.test(email.trim())) e.email = tr("bus.trip.errEmail");
    if (!isUgPhone(payPhone)) e.payPhone = tr("bus.trip.errPayPhone");
    return e;
  }, [count, name, phone, email, payPhone, tr]);

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
      setFormError(err.code === "VALIDATION_ERROR" ? { message: tr("bus.trip.errValidation") } : err);
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
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/bus/search");
  };

  const crumbs = (
    <nav className="bus-breadcrumb" aria-label={tr("bus.breadcrumb")}>
      <Link to="/bus">Gabla Bus</Link><span>/</span>
      <Link to="/bus/search">{tr("bus.trip.trips")}</Link><span>/</span>
      <span>{trip ? tr("bus.trip.routeTo", { from: trip.route.originName, to: trip.route.destinationName }) : tr("bus.trip.trip")}</span>
    </nav>
  );

  if (tripQ.error) {
    const gone = tripQ.error.status === 404;
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs}
          <EmptyState
            title={gone ? tr("bus.trip.gone") : tr("bus.trip.loadFailed")}
            action={<>
              {!gone ? <button type="button" className="bus-btn bus-btn-navy" onClick={tripQ.reload}>{tr("bus.parts.tryAgain")}</button> : null}
              <Link to="/bus/search" className="bus-btn bus-btn-light">{tr("bus.trip.findAnother")}</Link>
            </>}
          >
            {gone ? tr("bus.trip.goneSub") : tripQ.error.status === 429 ? tr("bus.parts.busy") : tripQ.error.message}
          </EmptyState>
        </div>
      </BusLayout>
    );
  }

  if (!trip) return <BusLayout tabbar={false}><TripSkeleton /></BusLayout>;

  if (phase === "waiting" && pending) {
    const left = new Date(pending.expiresAt).getTime() - now;
    const network = phoneNetwork(pending.payPhone);
    const total = Math.max(1, (trip.holdMinutes || 10) * 60000);
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs}
          <div className="bus-narrow">
            <div className="bus-card bus-pay-box" role="status" aria-live="polite">
              <div className="bus-pay-anim" aria-hidden="true"><span /><span /><span /><Phone size={30} /></div>
              <h1 className="bus-page-title">{tr("bus.trip.waitTitle")}</h1>
              <p><Trans i18nKey="bus.trip.waitBody" values={{ amount: ugx(pending.total), phone: pending.payPhone ? `+${pending.payPhone}` : tr("bus.trip.yourPhone"), network: network ? ` (${network})` : "" }} components={{ b: <b /> }} /></p>
              <ol className="bus-pay-steps" aria-label={tr("bus.trip.progress")}>
                <li className="is-done"><Check size={14} /> {tr("bus.trip.stepSent")}</li>
                <li className="is-now">{tr("bus.trip.stepWaiting")}</li>
                <li>{tr("bus.trip.stepIssued")}</li>
              </ol>
              {left > 0 ? (
                <>
                  <p className="bus-hold-clock"><Trans i18nKey="bus.trip.heldFor" values={{ time: clock(left) }} components={{ b: <b /> }} /></p>
                  <span className="bus-meter bus-hold-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (left / total) * 100)}%` }} /></span>
                </>
              ) : <p className="bus-hold-clock">{tr("bus.trip.finishing")}</p>}
              <p className="bus-hint" style={{ marginTop: 14 }}><Trans i18nKey="bus.trip.keepOpen" values={{ ref: pending.reference }} components={{ b: <b /> }} /></p>
              {pollWarn ? <div className="bus-alert bus-alert-warn" style={{ marginTop: 14 }}>{tr("bus.trip.pollWarn")}</div> : null}
              <p style={{ marginTop: 18 }}><Link to="/bus/tickets" className="bus-link">{tr("bus.trip.checkLater")}</Link></p>
            </div>
          </div>
        </div>
      </BusLayout>
    );
  }

  if (phase === "confirmed" && finalBooking) {
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs}
          <div className="bus-success">
            <span className="bus-success-icon"><Check size={30} /></span>
            <h1 className="bus-page-title">{tr("bus.trip.booked")}</h1>
            <p className="bus-section-sub"><Trans i18nKey="bus.trip.paidSummary" values={{ ref: finalBooking.reference, tickets: tr("bus.ticketsCount", { count: finalBooking.tickets.length }), total: ugx(finalBooking.total) }} components={{ b: <b /> }} /></p>
            <div className="bus-success-actions">
              <Link to="/bus/tickets" className="bus-btn bus-btn-primary">{tr("bus.trip.viewMyTickets")}</Link>
              <Link to="/bus" className="bus-btn bus-btn-light">{tr("bus.trip.bookAnother")}</Link>
            </div>
          </div>
        </div>
        <div className="bus-ticketpage is-valid is-stack">
          <div className="bus-wrap">
            {finalBooking.tickets.map((t) => <div className="bus-pass-slide" key={t.id}><TicketCard ticket={t} booking={finalBooking} link /></div>)}
            <p className="bus-pass-foot">{tr("bus.trip.screenshotTip")}</p>
          </div>
        </div>
      </BusLayout>
    );
  }

  if (phase === "failed") {
    const expired = finalBooking?.status === "expired" || finalBooking?.expired || !finalBooking;
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs}
          <div className="bus-narrow">
            <div className="bus-card bus-pay-box" role="alert">
              <span className="bus-success-icon is-bad" aria-hidden="true"><BusIcon size={28} /></span>
              <h1 className="bus-page-title">{expired ? tr("bus.trip.failedExpired") : tr("bus.trip.failedDeclined")}</h1>
              <p style={{ marginTop: 10 }}>{expired ? tr("bus.trip.failedExpiredSub") : tr("bus.trip.failedDeclinedSub")} {tr("bus.trip.noTickets")}</p>
              <p className="bus-hint" style={{ marginTop: 10 }}><Trans i18nKey="bus.trip.moneyTaken" values={{ ref: pending?.reference || finalBooking?.reference }} components={{ b: <b /> }} /></p>
              <div className="bus-success-actions">
                <button type="button" className="bus-btn bus-btn-primary" onClick={startOver}>{tr("bus.parts.tryAgain")}</button>
                <Link to="/bus/tickets" className="bus-btn bus-btn-light">{tr("bus.layout.myTickets")}</Link>
              </div>
            </div>
          </div>
        </div>
      </BusLayout>
    );
  }

  // ---- the booking form
  const departed = new Date(trip.departureAt).getTime() <= Date.now();
  const cancelled = trip.status === "cancelled";
  const blocked = cancelled ? tr("bus.trip.blockedCancelled") : trip.soldOut ? tr("bus.trip.blockedSoldOut") : departed ? tr("bus.trip.blockedDeparted") : !trip.bookable ? tr("bus.trip.blockedClosed") : "";
  const network = phoneNetwork(payPhone);
  const show = (key) => (submitted ? errors[key] : "");
  const payLabel = !signedIn ? tr("bus.trip.signInToBuy") : count < 1 ? tr("bus.trip.chooseYourTickets") : tr("bus.trip.pay", { amount: ugx(total) });
  const payDisabled = Boolean(blocked) || submitting || (signedIn && count < 1);
  const lowestFare = types.length ? Math.min(...types.map((t) => Number(t.price))) : Number(trip.priceFrom || 0);

  return (
    <BusLayout tabbar={false}>
      <TripHero trip={trip} onBack={goBack} />
      <form id="bus-book-form" className={`bus-wrap bus-tripgrid ${blocked ? "is-single" : ""}`} onSubmit={pay} noValidate>
        <div className="bus-tripmain">
          <TripSheet trip={trip} />

          {blocked ? (
            <div className="bus-stepcard bus-blocked" role="alert">
              <strong>{blocked}</strong>
              <p className="bus-hint">{tr("bus.trip.pickAnother")}</p>
              <Link to={`/bus/search?${new URLSearchParams({ from: trip.route.originName, to: trip.route.destinationName, date: eatDate(trip.departureAt) })}`} className="bus-btn bus-btn-navy" style={{ marginTop: 12 }}>{tr("bus.trip.seeOther")}</Link>
            </div>
          ) : (
            <>
              <section className="bus-stepcard" aria-labelledby="tickets-h">
                <div className="bus-stephead"><span className="bus-stepnum">1</span><div><h2 className="bus-section-title" id="tickets-h">{tr("bus.trip.chooseTickets")}</h2><p className="bus-section-sub">{tr("bus.trip.upTo", { count: cap })}</p></div></div>
                <div className="bus-ticketrows">
                  {types.map((t) => (
                    <div className={`bus-ticket-row ${qty[t.id] ? "is-on" : ""}`} key={t.id}>
                      <div className="bus-ticket-row-info">
                        <strong>{t.name}</strong>
                        {t.description ? <p className="bus-hint">{t.description}</p> : null}
                        <div className="bus-price">{ugx(t.price)}</div>
                      </div>
                      <div className="bus-qty" role="group" aria-label={tr("bus.trip.qtyAria", { name: t.name })}>
                        <button type="button" onClick={() => step(t.id, -1)} disabled={!qty[t.id]} aria-label={tr("bus.trip.fewer", { name: t.name })}>−</button>
                        <output aria-live="polite">{qty[t.id] || 0}</output>
                        <button type="button" onClick={() => step(t.id, 1)} disabled={count >= cap} aria-label={tr("bus.trip.more", { name: t.name })}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {show("tickets") ? <p className="bus-field-error" role="alert">{errors.tickets}</p> : null}
                {count >= cap && cap > 0 ? <p className="bus-hint" style={{ marginTop: 10 }}>{cap === trip.seatsLeft && trip.seatsLeft < (trip.maxPerBooking || 10) ? tr("bus.trip.onlySeats", { count: trip.seatsLeft }) : tr("bus.trip.mostAtOnce", { count: cap })}</p> : null}
              </section>

              <section className="bus-stepcard" aria-labelledby="pax-h">
                <div className="bus-stephead"><span className="bus-stepnum">2</span><div><h2 className="bus-section-title" id="pax-h">{tr("bus.trip.passengerDetails")}</h2><p className="bus-section-sub">{count > 1 ? tr("bus.trip.nameOnTicketsMany") : tr("bus.trip.nameOnTickets")}</p></div></div>
                <div className="bus-form-grid">
                  <label className="bus-field bus-span-2">
                    <span>{tr("bus.trip.fullName")}</span>
                    <input className="bus-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={Boolean(show("name"))} />
                    {show("name") ? <em className="bus-field-error">{errors.name}</em> : null}
                  </label>
                  <label className="bus-field">
                    <span>{tr("bus.trip.phone")}</span>
                    <input className="bus-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0772 123 456" autoComplete="tel" aria-invalid={Boolean(show("phone"))} />
                    {show("phone") ? <em className="bus-field-error">{errors.phone}</em> : null}
                  </label>
                  <label className="bus-field">
                    <span>{tr("bus.trip.email")} <small>({tr("bus.trip.optional")})</small></span>
                    <input className="bus-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={session?.user?.email ? tr("bus.trip.emailDefault") : tr("bus.trip.emailAlso")} autoComplete="email" aria-invalid={Boolean(show("email"))} />
                    {show("email") ? <em className="bus-field-error">{errors.email}</em> : null}
                  </label>
                </div>
              </section>

              <section className="bus-stepcard" aria-labelledby="pay-h">
                <div className="bus-stephead"><span className="bus-stepnum">3</span><div><h2 className="bus-section-title" id="pay-h">{tr("bus.trip.payMomo")}</h2><p className="bus-section-sub">{tr("bus.trip.payMomoSub")}</p></div></div>
                <label className="bus-field" style={{ marginTop: 14 }}>
                  <span>{tr("bus.trip.momoNumber")}</span>
                  <input className="bus-input" type="tel" inputMode="tel" value={payPhone} onChange={(e) => { setPayPhone(e.target.value); setPayTouched(true); }} placeholder={tr("bus.trip.momoPlaceholder")} aria-invalid={Boolean(show("payPhone"))} />
                  {isUgPhone(payPhone) ? <em className="bus-field-ok"><Check size={14} /> {network || tr("bus.trip.momoNumber")} · +{normalizeUgPhone(payPhone)}</em> : null}
                  {show("payPhone") ? <em className="bus-field-error">{errors.payPhone}</em> : null}
                </label>
              </section>
            </>
          )}
        </div>

        {blocked ? null : (
        <aside className="bus-summary bus-stepcard" aria-label={tr("bus.trip.summaryAria")}>
          <h2 className="bus-section-title">{tr("bus.trip.yourOrder")}</h2>
          <p className="bus-hint">{trip.route.originName} → {trip.route.destinationName} · {dayLabel(eatDate(trip.departureAt))}, {eatTime(trip.departureAt)}</p>
          <div style={{ marginTop: 14 }}>
            {count < 1 ? <p className="bus-hint">{tr("bus.trip.noneChosen")}</p> : types.filter((t) => qty[t.id] > 0).map((t) => (
              <div className="bus-line" key={t.id}><span>{qty[t.id]} × {t.name}</span><b>{ugx(qty[t.id] * Number(t.price))}</b></div>
            ))}
            <div className="bus-line is-total"><span>{tr("bus.trip.total")}</span><span>{ugx(total)}</span></div>
          </div>
          {!signedIn && !blocked ? <div className="bus-alert bus-alert-info" style={{ marginTop: 14 }}>{tr("bus.trip.signInNote")}</div> : null}
          {formError ? <div className="bus-alert bus-alert-error" role="alert" style={{ marginTop: 14 }}>{formError.message || tr("bus.trip.genericError")}</div> : null}
          {submitted && signedIn && Object.keys(errors).length && !formError ? <div className="bus-alert bus-alert-warn" role="alert" style={{ marginTop: 14 }}>{tr("bus.trip.fixDetails")}</div> : null}
          <button type="submit" className="bus-btn bus-btn-primary bus-btn-block bus-pay-btn" disabled={payDisabled} style={{ marginTop: 16 }}>
            {submitting ? tr("bus.trip.sendingRequest") : payLabel}
          </button>
          <p className="bus-hint bus-hold-note">{tr("bus.trip.holdNote", { minutes: trip.holdMinutes })}</p>
        </aside>
        )}
      </form>

      {blocked ? null : (
        <div className="bus-buybar" role="region" aria-label={tr("bus.trip.buyAria")}>
          <div className="bus-buybar-price">
            {count > 0 ? (<><small>{tr("bus.ticketsCount", { count })}</small><b>{ugx(total)}</b></>) : (<><small>{tr("bus.trip.fromCap")}</small><b>{ugx(lowestFare)} <em>{tr("bus.trip.perPerson")}</em></b></>)}
          </div>
          <button type="submit" form="bus-book-form" className="bus-btn bus-btn-primary" disabled={payDisabled}>{submitting ? tr("bus.trip.sending") : !signedIn ? tr("bus.trip.signInToBuy") : count < 1 ? tr("bus.trip.chooseTicketsShort") : tr("bus.trip.payNow")}</button>
        </div>
      )}
    </BusLayout>
  );
}
