import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import TicketCard, { TicketActions, ticketState } from "../../components/bus/TicketCard";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { EmptyState, ErrorBox } from "../../components/bus/parts";
import { ChevronLeft, ChevronRight, Ticket } from "../../components/bus/icons";
import { Skel } from "../../components/Skeleton";
import { busApi, ugx } from "../../lib/bus";
import { loginPath } from "../../lib/authRedirect";
import { getSession } from "../../lib/session";

function PassSkeleton() {
  return (
    <div className="bus-ticketpage is-valid" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading ticket…</span>
      <div className="bus-wrap" aria-hidden="true">
        <div className="bus-pass-slide" style={{ margin: "0 auto" }}>
          <div className="bus-pass is-skel">
            <div className="bus-pass-a"><Skel w={80} h={24} r={999} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}><Skel w={90} h={44} /><Skel w={44} h={44} r={14} /><Skel w={90} h={44} /></div></div>
            <div className="bus-pass-b"><Skel w="100%" h={120} r={12} /></div>
            <div className="bus-pass-c"><Skel w={168} h={168} r={12} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusTicket() {
  const { ticketNumber } = useParams();
  useScrollTop(ticketNumber);
  const location = useLocation();
  const signedIn = Boolean(getSession()?.accessToken);
  const q = useLoad(() => busApi.myTicket(ticketNumber), [ticketNumber], { enabled: signedIn });

  const scroller = useRef(null);
  const [index, setIndex] = useState(0);

  const tickets = q.data ? (q.data.booking.tickets.some((t) => t.ticketNumber === ticketNumber) ? q.data.booking.tickets : [q.data.ticket]) : [];
  const startIndex = Math.max(0, tickets.findIndex((t) => t.ticketNumber === ticketNumber));

  // Open on the ticket that was asked for.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !tickets.length) return;
    const slide = el.children[startIndex];
    if (slide) el.scrollTo({ left: slide.offsetLeft - (el.clientWidth - slide.clientWidth) / 2, behavior: "auto" });
    setIndex(startIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, startIndex]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center);
      if (d < dist) { dist = d; best = i; }
    });
    setIndex(best);
  }, []);

  const go = (i) => {
    const el = scroller.current;
    const slide = el?.children[i];
    if (!slide) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft - (el.clientWidth - slide.clientWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  };

  const crumbs = (light) => (
    <nav className={`bus-breadcrumb bus-no-print ${light ? "is-light" : ""}`} aria-label="Breadcrumb"><Link to="/bus">Gabla Bus</Link><span>/</span><Link to="/bus/tickets">My tickets</Link><span>/</span><span>{ticketNumber}</span></nav>
  );

  if (!signedIn || q.error?.status === 401) {
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs()}
          <EmptyState icon={Ticket} className="bus-signin" title="Sign in to see this ticket" action={<Link to={loginPath(location)} className="bus-btn bus-btn-primary">Sign in</Link>}>
            Tickets are private to the person who bought them.
          </EmptyState>
        </div>
      </BusLayout>
    );
  }

  if (q.loading) {
    return <BusLayout><PassSkeleton /></BusLayout>;
  }

  if (q.error) {
    const gone = q.error.status === 404;
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          {crumbs()}
          {gone ? (
            <EmptyState icon={Ticket} title="We couldn't find that ticket" action={<Link to="/bus/tickets" className="bus-btn bus-btn-navy">My tickets</Link>}>
              Check the number, or make sure you're signed in with the account that bought it.
            </EmptyState>
          ) : (
            <ErrorBox error={q.error} onRetry={q.reload} />
          )}
        </div>
      </BusLayout>
    );
  }

  const { booking } = q.data;
  const current = tickets[Math.min(index, tickets.length - 1)] || q.data.ticket;
  const state = ticketState(current, booking);
  const many = tickets.length > 1;

  return (
    <BusLayout>
      <div className={`bus-ticketpage is-${state}`}>
        <div className="bus-wrap">
          {crumbs(true)}
          {many ? (
            <div className="bus-pager bus-no-print">
              <button type="button" onClick={() => go(index - 1)} disabled={index <= 0} aria-label="Previous ticket"><ChevronLeft size={18} /></button>
              <div role="tablist" aria-label="Tickets in this booking" className="bus-pager-dots">
                {tickets.map((t, i) => <button type="button" key={t.id} role="tab" aria-selected={i === index} aria-label={`Ticket ${i + 1}, seat ${t.seatNumber ?? "-"}`} className={i === index ? "is-on" : ""} onClick={() => go(i)} />)}
              </div>
              <button type="button" onClick={() => go(index + 1)} disabled={index >= tickets.length - 1} aria-label="Next ticket"><ChevronRight size={18} /></button>
              <p aria-live="polite">Ticket {index + 1} of {tickets.length} · Seat {current.seatNumber ?? "-"}</p>
            </div>
          ) : null}

          <div className="bus-pass-scroller" ref={scroller} onScroll={onScroll}>
            {tickets.map((t, i) => (
              <div className={`bus-pass-slide ${i === index ? "is-active" : ""}`} key={t.id} aria-hidden={i !== index && many ? "true" : undefined}>
                <TicketCard ticket={t} booking={booking} />
              </div>
            ))}
          </div>

          <TicketActions ticket={current} booking={booking} />

          <p className="bus-pass-foot bus-no-print">
            Booking {booking.reference} · {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} · {ugx(booking.total)}
            <Link to="/bus/tickets">Back to all my tickets</Link>
          </p>
        </div>
      </div>
    </BusLayout>
  );
}
