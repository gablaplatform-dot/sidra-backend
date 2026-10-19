import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  arrivalAt, buildTripIcs, cityCode, dayDiff, dayLabel, downloadText, durationLabel, eatDate, eatTime, effectiveDeparture, qrSrc, ugx
} from "../../lib/bus";
import { BusLogo, telHref, waHref } from "./parts";
import { ArrowRight, BusIcon, CalendarPlus, Chat, Check, Phone, Printer, Share } from "./icons";

// Labels are looked up with t(`bus.ticketStates.${state}`) where they are shown.
export const TICKET_STATES = {
  valid: { tone: "green" },
  used: { tone: "slate" },
  past: { tone: "slate" },
  cancelled: { tone: "red" },
  refund: { tone: "amber" }
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
  const { t } = useTranslation();
  const delay = Number(trip?.delayMinutes) || 0;
  if (!delay) return null;
  return <span className="bus-chip bus-chip-amber">{t("bus.tripStatus.delayed", { min: delay })}</span>;
}

export function Badge({ state }) {
  const { t } = useTranslation();
  const key = TICKET_STATES[state] ? state : "valid";
  return <span className={`bus-badge is-${TICKET_STATES[key].tone}`}>{t(`bus.ticketStates.${key}`)}</span>;
}

// The digital ticket: route codes with the company logo between them, a details grid, then the QR
// on the stub. Side notches and dashed perforations are pure CSS so it also prints cleanly.
export default function TicketCard({ ticket, booking, link = false, className = "" }) {
  const { t } = useTranslation();
  const { trip, operator } = booking;
  const state = ticketState(ticket, booking);
  const departure = trip.departureAt;
  const arrive = arrivalAt(departure, trip.route.durationMinutes);
  const plus = dayDiff(departure, arrive);
  const dead = state === "used" || state === "cancelled" || state === "past" || state === "refund";
  const delay = Number(trip.delayMinutes) || 0;
  const booked = booking.confirmedAt || booking.createdAt;

  return (
    <article className={`bus-pass is-${state} ${className}`} aria-label={t("bus.ticketCard.aria", { number: ticket.ticketNumber })}>
      <div className="bus-pass-a">
        <div className="bus-pass-bar">
          <Badge state={state} />
          <span className="bus-pass-ref">{booked ? t("bus.ticketCard.reserved", { date: eatDate(booked).split("-").reverse().join("/") }) : t("bus.ticketCard.ref", { ref: booking.reference })}</span>
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
          <div className="bus-alert bus-alert-error bus-pass-alert">{t("bus.ticketCard.cancelled")} {state === "refund" ? t("bus.ticketCard.refundNote", { amount: ugx(booking.total) }) : t("bus.ticketCard.cantUse")}</div>
        ) : delay > 0 && state === "valid" ? (
          <div className="bus-alert bus-alert-warn bus-pass-alert">{t("bus.ticketCard.delayedNote", { min: delay, time: eatTime(effectiveDeparture(trip)) })}</div>
        ) : null}
      </div>

      <div className="bus-pass-b">
        <dl className="bus-pass-grid">
          <div><dt>{t("bus.ticketCard.passenger")}</dt><dd>{ticket.passengerName}</dd></div>
          <div className="is-right"><dt>{t("bus.ticketCard.mobile")}</dt><dd>{booking.passengerPhone || "-"}</dd></div>
          <div><dt>{t("bus.ticketCard.schedule")}</dt><dd>{dayLabel(eatDate(departure))}<br /><span className="bus-nowrap">{eatTime(departure)} - {eatTime(arrive)}{plus > 0 ? ` (+${plus})` : ""}</span></dd></div>
          <div className="is-right"><dt>{t("bus.ticketCard.seat")}</dt><dd><span className="bus-seat">{ticket.seatNumber ?? "-"}</span><br />{ticket.ticketTypeName}</dd></div>
          <div><dt>{t("bus.ticketCard.boarding")}</dt><dd>{trip.route.boardingPoint || operator?.parkName || trip.route.originName}{operator?.parkName && trip.route.boardingPoint && !trip.route.boardingPoint.toLowerCase().includes(operator.parkName.toLowerCase()) ? `, ${operator.parkName}` : ""}</dd></div>
          <div className="is-right"><dt>{t("bus.ticketCard.arriving")}</dt><dd>{trip.route.destinationName}</dd></div>
        </dl>
      </div>

      <div className="bus-pass-c">
        <div className="bus-pass-qr">
          <img src={qrSrc(ticket.ticketNumber)} alt={t("bus.ticketCard.qrAlt", { number: ticket.ticketNumber })} width={168} height={168} />
          {dead ? <span className="bus-pass-stamp">{t(`bus.ticketStates.${state}`)}</span> : null}
        </div>
        <div className="bus-pass-qrmeta">
          <span className="bus-ticket-number">{ticket.ticketNumber}</span>
          <span className="bus-chip bus-chip-orange">{ticket.ticketTypeName}</span>
          <small>{dead ? t("bus.ticketCard.deadNote") : t("bus.ticketCard.showCode")}</small>
        </div>
        {link ? <Link to={`/bus/tickets/${ticket.ticketNumber}`} className="bus-btn bus-btn-light bus-btn-sm bus-no-print">{t("bus.ticketCard.openFull")} <ArrowRight size={15} /></Link> : null}
      </div>
    </article>
  );
}

// Save / Share / Calendar / Call / WhatsApp for the ticket on screen.
export function TicketActions({ ticket, booking }) {
  const { t } = useTranslation();
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
  const message = t("bus.actions.shareMessage", { number: ticket.ticketNumber, from: trip.route.originName, to: trip.route.destinationName, date: dayLabel(eatDate(trip.departureAt)), time: eatTime(trip.departureAt), company: operator?.companyName, seat: ticket.seatNumber ?? "-" });

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: t("bus.actions.shareTitle"), text: message, url });
        return;
      }
      await navigator.clipboard.writeText(`${message} ${url}`);
      say(t("bus.actions.copied"));
    } catch (err) {
      if (err?.name !== "AbortError") say(t("bus.actions.shareFailed"));
    }
  };

  const calendar = () => {
    downloadText(`gabla-bus-${ticket.ticketNumber}.ics`, buildTripIcs({ ticket, booking }), "text/calendar;charset=utf-8");
    say(t("bus.actions.calendarAdded"));
  };

  return (
    <div className="bus-actions bus-no-print">
      <div className="bus-actions-grid" role="group" aria-label={t("bus.actions.groupAria")}>
        <button type="button" onClick={() => window.print()} aria-label={t("bus.actions.printAria")}><span><Printer size={20} /></span>{t("bus.actions.print")}</button>
        <button type="button" onClick={share}><span><Share size={20} /></span>{t("bus.actions.share")}</button>
        <button type="button" onClick={calendar}><span><CalendarPlus size={20} /></span>{t("bus.actions.calendar")}</button>
        {operator?.contactPhone ? <a href={telHref(operator.contactPhone)}><span><Phone size={20} /></span>{t("bus.actions.call")}</a> : null}
        {operator?.whatsapp ? <a href={waHref(operator.whatsapp)} target="_blank" rel="noopener noreferrer"><span><Chat size={20} /></span>WhatsApp</a> : null}
      </div>
      <p className="bus-actions-note" role="status" aria-live="polite">{note ? <><Check size={14} /> {note}</> : t("bus.actions.tip")}</p>
    </div>
  );
}
