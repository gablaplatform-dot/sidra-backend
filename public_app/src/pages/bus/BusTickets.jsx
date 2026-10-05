import React from "react";
import { Link, useLocation } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import { DelayChip } from "../../components/bus/TicketCard";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { ArrivalTime, BusLogo, ErrorBox } from "../../components/bus/parts";
import { IconArrowRight, IconQr, IconTicket } from "../../components/icons";
import { Skel } from "../../components/Skeleton";
import { BUS_STATUS_LABEL, busApi, dayLabel, eatDate, eatTime, qrSrc, ugx } from "../../lib/bus";
import { loginPath } from "../../lib/authRedirect";
import { getSession } from "../../lib/session";

const TICKET_CHIP = { valid: "bus-chip-green", used: "", cancelled: "bus-chip-red" };

function MyTripSkeletons() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ display: "grid", gap: 14 }}>
      <span className="sr-only">Loading your tickets…</span>
      {[0, 1].map((i) => (
        <div className="bus-card bus-card-pad" key={i} aria-hidden="true">
          <Skel w="55%" h={24} /><Skel w="35%" h={14} style={{ marginTop: 12 }} /><Skel w="100%" h={64} r={12} style={{ marginTop: 16 }} />
        </div>
      ))}
    </div>
  );
}

function BookingCard({ booking }) {
  const { trip, operator } = booking;
  const refund = booking.status === "refund_due";
  const cancelled = trip.status === "cancelled" || booking.status === "cancelled" || refund;
  return (
    <article className={`bus-card bus-mytrip ${cancelled ? "is-cancelled" : ""}`}>
      <div className="bus-mytrip-head">
        <span className="bus-trip-co">
          <BusLogo name={operator.companyName} src={operator.logoUrl} />
          <span><b>{operator.companyName}</b><small className="bus-hint" style={{ display: "block" }}>Ref {booking.reference}</small></span>
        </span>
        <span className={`bus-chip ${refund ? "bus-chip-red" : booking.status === "confirmed" ? "bus-chip-green" : ""}`}>{refund ? "Refund pending" : BUS_STATUS_LABEL[booking.status] || booking.status}</span>
      </div>
      <div className="bus-ticket-route" style={{ fontSize: 21 }}>
        <span>{trip.route.originName}</span><IconArrowRight className="bus-arrow" width={20} height={20} /><span>{trip.route.destinationName}</span>
      </div>
      <p className="bus-mytrip-when">
        {dayLabel(eatDate(trip.departureAt))} · <b>{eatTime(trip.departureAt)}</b> → <ArrivalTime departureAt={trip.departureAt} minutes={trip.route.durationMinutes} /> <DelayChip trip={trip} />
      </p>
      {cancelled ? (
        <div className="bus-notice is-danger" style={{ marginTop: 12 }}>
          <b>Trip cancelled{refund ? " — refund pending" : ""}.</b> {refund ? `${ugx(booking.total)} will be returned to you.` : "Your tickets can't be used for this trip."}
        </div>
      ) : null}
      {trip.route.boardingPoint ? <p className="bus-hint" style={{ marginTop: 8 }}>Board at {trip.route.boardingPoint}</p> : null}
      <ul className="bus-mytrip-tickets">
        {booking.tickets.map((t) => {
          const state = cancelled && t.status === "valid" ? "cancelled" : t.status || "valid";
          return (
          <li key={t.id}>
            <Link to={`/bus/tickets/${t.ticketNumber}`} className="bus-miniticket" aria-label={`Open ticket ${t.ticketNumber}`}>
              <img src={qrSrc(t.ticketNumber)} alt="" width={52} height={52} loading="lazy" />
              <span>
                <b className="bus-ticket-number">{t.ticketNumber}</b>
                <small>{t.passengerName} · Seat {t.seatNumber ?? "-"} · {t.ticketTypeName}</small>
              </span>
              <span className={`bus-chip ${TICKET_CHIP[state] || ""}`}>{state.toUpperCase()}</span>
            </Link>
          </li>
          );
        })}
      </ul>
      {!booking.tickets.length ? <p className="bus-hint">Tickets are being issued…</p> : null}
    </article>
  );
}

export default function BusTickets() {
  useScrollTop();
  const location = useLocation();
  const signedIn = Boolean(getSession()?.accessToken);
  const tickets = useLoad(() => busApi.myTickets(), [], { enabled: signedIn });
  const messages = useLoad(() => busApi.myMessages().catch(() => ({ items: [] })), [], { enabled: signedIn });

  if (!signedIn || tickets.error?.status === 401) {
    return (
      <BusLayout>
        <div className="bus-card bus-empty bus-signin">
          <span className="bus-success-icon" style={{ background: "var(--bus-orange-soft)", color: "var(--bus-orange-dark)" }}><IconQr width={30} height={30} /></span>
          <strong>Sign in to see your tickets</strong>
          <p>Your e-tickets and QR codes live here once you've booked a trip.</p>
          <Link to={loginPath(location)} className="bus-btn bus-btn-primary" style={{ marginTop: 16 }}>Sign in</Link>
        </div>
      </BusLayout>
    );
  }

  const upcoming = tickets.data?.upcoming || [];
  const past = tickets.data?.past || [];
  const notices = messages.data?.items || [];

  return (
    <BusLayout>
      <div className="bus-page-head">
        <h1 className="bus-page-title">My tickets</h1>
        <p className="bus-section-sub">Show the QR code to the conductor when you board.</p>
      </div>

      {notices.length ? (
        <div className="bus-notices" aria-label="Notices from bus companies">
          {notices.slice(0, 5).map((n) => (
            <div key={n.id} className={`bus-notice ${n.kind === "cancellation" ? "is-danger" : n.kind === "delay" ? "is-warn" : ""}`}>
              <b>{n.title}</b> <small className="bus-hint">· {n.companyName} · {dayLabel(eatDate(n.createdAt))}</small>
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tickets.loading ? (
        <MyTripSkeletons />
      ) : tickets.error ? (
        <ErrorBox error={tickets.error} onRetry={tickets.reload} />
      ) : !upcoming.length && !past.length ? (
        <div className="bus-card bus-empty">
          <span className="bus-empty-icon"><IconTicket width={34} height={34} /></span>
          <strong>No tickets yet</strong>
          <p>When you book a trip, your tickets will show up here.</p>
          <Link to="/bus" className="bus-btn bus-btn-primary" style={{ marginTop: 16 }}>Find a bus</Link>
        </div>
      ) : (
        <>
          <section className="bus-section" aria-label="Upcoming trips">
            <h2 className="bus-section-title">Upcoming</h2>
            {upcoming.length ? (
              <div className="bus-mytrips">{upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}</div>
            ) : (
              <div className="bus-card bus-empty" style={{ marginTop: 12 }}><strong>No upcoming trips</strong><p>Ready for the next one? <Link to="/bus" className="bus-link">Find a bus</Link></p></div>
            )}
          </section>
          {past.length ? (
            <section className="bus-section" aria-label="Past trips">
              <h2 className="bus-section-title">Past trips</h2>
              <div className="bus-mytrips">{past.map((b) => <BookingCard key={b.id} booking={b} />)}</div>
            </section>
          ) : null}
        </>
      )}
    </BusLayout>
  );
}
