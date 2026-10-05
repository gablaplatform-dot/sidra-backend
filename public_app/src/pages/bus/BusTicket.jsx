import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import BusLayout from "../../components/bus/BusLayout";
import TicketCard from "../../components/bus/TicketCard";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { ErrorBox, telHref, waHref } from "../../components/bus/parts";
import { IconPhone } from "../../components/icons";
import { Skel } from "../../components/Skeleton";
import { busApi } from "../../lib/bus";
import { loginPath } from "../../lib/authRedirect";
import { getSession } from "../../lib/session";

export default function BusTicket() {
  const { ticketNumber } = useParams();
  useScrollTop(ticketNumber);
  const location = useLocation();
  const signedIn = Boolean(getSession()?.accessToken);
  const q = useLoad(() => busApi.myTicket(ticketNumber), [ticketNumber], { enabled: signedIn });

  const crumbs = (
    <nav className="bus-breadcrumb bus-no-print" aria-label="Breadcrumb"><Link to="/bus">Gabla Bus</Link><span>/</span><Link to="/bus/tickets">My tickets</Link><span>/</span><span>{ticketNumber}</span></nav>
  );

  if (!signedIn || q.error?.status === 401) {
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-card bus-empty">
          <strong>Sign in to see this ticket</strong>
          <p>Tickets are private to the person who bought them.</p>
          <Link to={loginPath(location)} className="bus-btn bus-btn-primary" style={{ marginTop: 16 }}>Sign in</Link>
        </div>
      </BusLayout>
    );
  }

  if (q.loading) {
    return (
      <BusLayout>
        {crumbs}
        <div className="bus-narrow-wide" role="status" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading ticket…</span>
          <div className="bus-card" aria-hidden="true" style={{ padding: 24 }}>
            <Skel w="30%" h={16} /><Skel w="70%" h={30} style={{ marginTop: 14 }} /><Skel w="100%" h={90} r={12} style={{ marginTop: 20 }} /><Skel w={150} h={150} r={12} style={{ marginTop: 20 }} />
          </div>
        </div>
      </BusLayout>
    );
  }

  if (q.error) {
    const gone = q.error.status === 404;
    return (
      <BusLayout>
        {crumbs}
        {gone ? (
          <div className="bus-card bus-empty"><strong>We couldn't find that ticket</strong><p>Check the number, or make sure you're signed in with the account that bought it.</p><Link to="/bus/tickets" className="bus-btn bus-btn-navy" style={{ marginTop: 14 }}>My tickets</Link></div>
        ) : (
          <ErrorBox error={q.error} onRetry={q.reload} />
        )}
      </BusLayout>
    );
  }

  const { ticket, booking } = q.data;
  const operator = booking.operator || {};
  const others = booking.tickets || [];

  return (
    <BusLayout>
      {crumbs}
      <div className="bus-narrow-wide">
        {others.length > 1 ? (
          <div className="bus-ticket-switch bus-no-print" role="tablist" aria-label="Tickets in this booking">
            {others.map((t, i) => (
              <Link key={t.id} to={`/bus/tickets/${t.ticketNumber}`} replace role="tab" aria-selected={t.ticketNumber === ticket.ticketNumber} className={`bus-chip ${t.ticketNumber === ticket.ticketNumber ? "is-active" : ""}`}>
                Ticket {i + 1} · Seat {t.seatNumber ?? "-"}
              </Link>
            ))}
          </div>
        ) : null}

        <TicketCard ticket={ticket} booking={booking} />

        <div className="bus-ticket-actions bus-no-print">
          <button type="button" className="bus-btn bus-btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
          {operator.contactPhone ? <a className="bus-btn bus-btn-light" href={telHref(operator.contactPhone)}><IconPhone width={16} height={16} /> Call {operator.companyName}</a> : null}
          {operator.whatsapp ? <a className="bus-btn bus-btn-light" href={waHref(operator.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
        </div>
        <p className="bus-hint bus-no-print" style={{ marginTop: 14 }}>Add to your phone: take a screenshot of this ticket so you can show the QR code even without internet. Booking reference {booking.reference}.</p>
        <p className="bus-no-print" style={{ marginTop: 10 }}><Link to="/bus/tickets" className="bus-link">Back to all my tickets</Link></p>
      </div>
    </BusLayout>
  );
}
