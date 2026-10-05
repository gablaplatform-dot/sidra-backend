import React from "react";
import { Link } from "react-router-dom";

import { IconArrowRight } from "../icons";
import { ArrivalTime } from "./parts";
import { dayLabel, durationLabel, eatDate, eatTime, qrSrc, ugx } from "../../lib/bus";

const TICKET_STATUS = {
  valid: { label: "VALID", cls: "bus-chip-green" },
  used: { label: "USED", cls: "" },
  cancelled: { label: "CANCELLED", cls: "bus-chip-red" }
};

export function DelayChip({ trip }) {
  const delay = Number(trip?.delayMinutes) || 0;
  if (!delay) return null;
  return <span className="bus-chip bus-chip-amber">Delayed {delay} min</span>;
}

// The full ticket: trip details on the left, QR + number on the stub.
export default function TicketCard({ ticket, booking, link = false }) {
  const { trip, operator } = booking;
  const tripCancelled = trip.status === "cancelled" || booking.status === "refund_due";
  const state = tripCancelled && ticket.status === "valid" ? "cancelled" : ticket.status;
  const status = TICKET_STATUS[state] || TICKET_STATUS.valid;
  const departure = trip.departureAt;

  return (
    <article className={`bus-ticket is-${state}`} aria-label={`Ticket ${ticket.ticketNumber}`}>
      <div className="bus-ticket-main">
        <div className="bus-ticket-top">
          <span className="bus-ticket-co">{operator?.companyName}</span>
          <span className={`bus-chip ${status.cls}`}>{status.label}</span>
        </div>
        <div className="bus-ticket-route">
          <span>{trip.route.originName}</span>
          <IconArrowRight className="bus-arrow" width={22} height={22} />
          <span>{trip.route.destinationName}</span>
        </div>
        {tripCancelled ? <div className="bus-alert bus-alert-error" style={{ marginTop: 12 }}>This trip was cancelled. {booking.status === "refund_due" ? "Your refund is pending." : ""}</div> : null}
        <dl className="bus-ticket-facts">
          <div><dt>Date</dt><dd>{dayLabel(eatDate(departure))}</dd></div>
          <div><dt>Departs</dt><dd>{eatTime(departure)} <DelayChip trip={trip} /></dd></div>
          <div><dt>Arrives (est.)</dt><dd><ArrivalTime departureAt={departure} minutes={trip.route.durationMinutes} /></dd></div>
          <div><dt>Seat</dt><dd>{ticket.seatNumber ?? "-"}</dd></div>
          <div><dt>Passenger</dt><dd>{ticket.passengerName}</dd></div>
          <div><dt>Ticket type</dt><dd>{ticket.ticketTypeName}</dd></div>
          <div><dt>Fare</dt><dd>{ugx(ticket.price)}</dd></div>
          <div><dt>Journey</dt><dd>{durationLabel(trip.route.durationMinutes)}</dd></div>
        </dl>
        {trip.route.boardingPoint ? <p className="bus-ticket-board"><b>Board at:</b> {trip.route.boardingPoint}{operator?.parkName && !trip.route.boardingPoint.toLowerCase().includes(operator.parkName.toLowerCase()) ? ` · ${operator.parkName}` : ""}</p> : null}
        {link ? <p style={{ marginTop: 12 }}><Link to={`/bus/tickets/${ticket.ticketNumber}`} className="bus-link">Open full ticket</Link></p> : null}
      </div>
      <div className="bus-ticket-stub">
        <img src={qrSrc(ticket.ticketNumber)} alt={`QR code for ticket ${ticket.ticketNumber}`} width={150} height={150} />
        <div className="bus-ticket-number">{ticket.ticketNumber}</div>
        <small className="bus-hint">Show this at boarding</small>
      </div>
    </article>
  );
}
