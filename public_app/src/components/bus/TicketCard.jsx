import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  arrivalAt, buildTripIcs, cityCode, dayDiff, dayLabel, downloadText, durationLabel, eatDate, eatTime, effectiveDeparture, qrSrc, ugx
} from "../../lib/bus";
import { BusLogo, telHref, waHref } from "./parts";
import { ArrowRight, BusIcon, CalendarPlus, Chat, Check, Phone, Printer, Share } from "./icons";

export const TICKET_STATES = {
  valid: { label: "VALID", tone: "green" },
  used: { label: "USED", tone: "slate" },
  past: { label: "PAST", tone: "slate" },
  cancelled: { label: "CANCELLED", tone: "red" },
  refund: { label: "REFUND PENDING", tone: "amber" }
};

// One word for what this ticket is right now.
export function ticketState(ticket, booking) {
  const { trip } = booking;
  if (ticket.status === "used") return "used";
  if (booking.status === "refund_due") return "refund";
  if (trip.status === "cancelled" || booking.status === "cancelled" || ticket.status === "cancelled") return "cancelled";
  const ends = arrivalAt(effectiveDeparture(trip), trip.route.durationMinutes).getTime();
  if (ends < Date.now()) return "past";
  return "valid";
}

export function DelayChip({ trip }) {
  const delay = Number(trip?.delayMinutes) || 0;
  if (!delay) return null;
  return <span className="bus-chip bus-chip-amber">Delayed {delay} min</span>;
}

export function Badge({ state }) {
  const s = TICKET_STATES[state] || TICKET_STATES.valid;
  return <span className={`bus-badge is-${s.tone}`}>{s.label}</span>;
}

// The digital ticket: route codes with the company logo between them, a details grid, then the QR
// on the stub. Side notches and dashed perforations are pure CSS so it also prints cleanly.
export default function TicketCard({ ticket, booking, link = false, className = "" }) {
  const { trip, operator } = booking;
  const state = ticketState(ticket, booking);
  const departure = trip.departureAt;
  const arrive = arrivalAt(departure, trip.route.durationMinutes);
  const plus = dayDiff(departure, arrive);
  const dead = state === "used" || state === "cancelled" || state === "past" || state === "refund";
  const delay = Number(trip.delayMinutes) || 0;
  const booked = booking.confirmedAt || booking.createdAt;

  return (
    <article className={`bus-pass is-${state} ${className}`} aria-label={`Ticket ${ticket.ticketNumber}`}>
      <div className="bus-pass-a">
        <div className="bus-pass-bar">
          <Badge state={state} />
          <span className="bus-pass-ref">{booked ? `Reserved ${eatDate(booked).split("-").reverse().join("/")}` : `Ref ${booking.reference}`}</span>
        </div>
        <div className="bus-pass-route">
          <div className="bus-pass-code"><b>{cityCode(trip.route.originName)}</b><span>{trip.route.originName}</span></div>
          <div className="bus-pass-mid">
            <BusLogo name={operator?.companyName} src={operator?.logoUrl} size={44} />
            <span className="bus-pass-line" aria-hidden="true"><i /><BusIcon size={15} /><i /></span>
            <small>{durationLabel(trip.route.durationMinutes)}</small>
          </div>
          <div className="bus-pass-code is-right"><b>{cityCode(trip.route.destinationName)}</b><span>{trip.route.destinationName}</span></div>
        </div>
        <p className="bus-pass-co">{operator?.companyName}</p>
        {state === "cancelled" || state === "refund" ? (
          <div className="bus-alert bus-alert-error bus-pass-alert">This trip was cancelled. {state === "refund" ? `${ugx(booking.total)} will be returned to you.` : "This ticket can't be used."}</div>
        ) : delay > 0 && state === "valid" ? (
          <div className="bus-alert bus-alert-warn bus-pass-alert">Delayed {delay} min. The bus now leaves at about {eatTime(effectiveDeparture(trip))}.</div>
        ) : null}
      </div>

      <div className="bus-pass-b">
        <dl className="bus-pass-grid">
          <div><dt>Passenger</dt><dd>{ticket.passengerName}</dd></div>
          <div className="is-right"><dt>Mobile #</dt><dd>{booking.passengerPhone || "-"}</dd></div>
          <div><dt>Schedule</dt><dd>{dayLabel(eatDate(departure))}<br /><span className="bus-nowrap">{eatTime(departure)} - {eatTime(arrive)}{plus > 0 ? ` (+${plus})` : ""}</span></dd></div>
          <div className="is-right"><dt>Seat</dt><dd><span className="bus-seat">{ticket.seatNumber ?? "-"}</span><br />{ticket.ticketTypeName}</dd></div>
          <div><dt>Boarding</dt><dd>{trip.route.boardingPoint || operator?.parkName || trip.route.originName}{operator?.parkName && trip.route.boardingPoint && !trip.route.boardingPoint.toLowerCase().includes(operator.parkName.toLowerCase()) ? `, ${operator.parkName}` : ""}</dd></div>
          <div className="is-right"><dt>Arriving</dt><dd>{trip.route.destinationName}</dd></div>
        </dl>
      </div>

      <div className="bus-pass-c">
        <div className="bus-pass-qr">
          <img src={qrSrc(ticket.ticketNumber)} alt={`QR code for ticket ${ticket.ticketNumber}`} width={168} height={168} />
          {dead ? <span className="bus-pass-stamp">{TICKET_STATES[state].label}</span> : null}
        </div>
        <div className="bus-pass-qrmeta">
          <span className="bus-ticket-number">{ticket.ticketNumber}</span>
          <span className="bus-chip bus-chip-orange">{ticket.ticketTypeName}</span>
          <small>{dead ? "This ticket can no longer be used to board." : "Show this code to the conductor when you board."}</small>
        </div>
        {link ? <Link to={`/bus/tickets/${ticket.ticketNumber}`} className="bus-btn bus-btn-light bus-btn-sm bus-no-print">Open full ticket <ArrowRight size={15} /></Link> : null}
      </div>
    </article>
  );
}

// Save / Share / Calendar / Call / WhatsApp for the ticket on screen.
export function TicketActions({ ticket, booking }) {
  const { trip, operator } = booking;
  const [note, setNote] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const say = (text) => {
    setNote(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 2400);
  };

  const url = `${window.location.origin}/bus/tickets/${ticket.ticketNumber}`;
  const message = `Bus ticket ${ticket.ticketNumber}: ${trip.route.originName} to ${trip.route.destinationName}, ${dayLabel(eatDate(trip.departureAt))} at ${eatTime(trip.departureAt)} with ${operator?.companyName}. Seat ${ticket.seatNumber ?? "-"}.`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Gabla Bus ticket", text: message, url });
        return;
      }
      await navigator.clipboard.writeText(`${message} ${url}`);
      say("Ticket details copied");
    } catch (err) {
      if (err?.name !== "AbortError") say("Couldn't share from this browser");
    }
  };

  const calendar = () => {
    downloadText(`gabla-bus-${ticket.ticketNumber}.ics`, buildTripIcs({ ticket, booking }), "text/calendar;charset=utf-8");
    say("Added - open the downloaded file");
  };

  return (
    <div className="bus-actions bus-no-print">
      <div className="bus-actions-grid" role="group" aria-label="Ticket actions">
        <button type="button" onClick={() => window.print()} aria-label="Print or save as PDF"><span><Printer size={20} /></span>Print</button>
        <button type="button" onClick={share}><span><Share size={20} /></span>Share</button>
        <button type="button" onClick={calendar}><span><CalendarPlus size={20} /></span>Calendar</button>
        {operator?.contactPhone ? <a href={telHref(operator.contactPhone)}><span><Phone size={20} /></span>Call</a> : null}
        {operator?.whatsapp ? <a href={waHref(operator.whatsapp)} target="_blank" rel="noopener noreferrer"><span><Chat size={20} /></span>WhatsApp</a> : null}
      </div>
      <p className="bus-actions-note" role="status" aria-live="polite">{note ? <><Check size={14} /> {note}</> : "Tip: save a screenshot of this ticket so you can board even without signal."}</p>
    </div>
  );
}
