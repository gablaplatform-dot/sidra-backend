import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

import BusLayout from "../../components/bus/BusLayout";
import { DelayChip } from "../../components/bus/TicketCard";
import useLoad from "../../components/bus/useLoad";
import useScrollTop from "../../components/bus/useScrollTop";
import { ArrivalTime, BusLogo, EmptyState, ErrorBox, StatusPill } from "../../components/bus/parts";
import { ArrowRight, BusIcon, ChevronRight, Qr, Ticket } from "../../components/bus/icons";
import { Skel } from "../../components/Skeleton";
import { BUS_STATUS_LABEL, busApi, cityCode, dayLabel, durationLabel, eatDate, eatTime, ugx } from "../../lib/bus";
import { loginPath } from "../../lib/authRedirect";
import { getSession } from "../../lib/session";

function MyTripSkeletons() {
  const { t } = useTranslation();
  return (
    <div className="bus-mytrips" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("bus.tickets.loading")}</span>
      {[0, 1, 2].map((i) => (
        <div className="bus-mytrip" key={i} aria-hidden="true">
          <div className="bus-mytrip-main">
            <div className="bus-mytrip-top"><span className="bus-trip-co"><Skel w={44} h={44} r={13} /><span style={{ display: "grid", gap: 8 }}><Skel w={130} h={15} /><Skel w={90} h={11} /></span></span><Skel w={86} h={26} r={999} /></div>
            <Skel w="100%" h={46} r={12} style={{ marginTop: 18 }} />
            <Skel w="55%" h={14} style={{ marginTop: 16 }} />
          </div>
          <div className="bus-mytrip-foot"><Skel w={150} h={32} r={10} /></div>
        </div>
      ))}
    </div>
  );
}

// What the customer should see on the card for this booking.
function bookingTone(booking) {
  const { trip } = booking;
  const refund = booking.status === "refund_due";
  const cancelled = trip.status === "cancelled" || booking.status === "cancelled";
  if (refund) return { state: "cancelled", tone: "amber", label: i18n.t("bus.status.refund_due") };
  if (cancelled) return { state: "cancelled", tone: "red", label: i18n.t("bus.status.cancelled") };
  if (booking.status !== "confirmed") return { state: "other", tone: "muted", label: BUS_STATUS_LABEL[booking.status] || booking.status };
  const allUsed = booking.tickets.length > 0 && booking.tickets.every((t) => t.status === "used");
  const ended = new Date(trip.departureAt).getTime() + (Number(trip.route.durationMinutes) || 0) * 60000 < Date.now();
  if (allUsed) return { state: "past", tone: "muted", label: i18n.t("bus.tickets.completed") };
  if (ended) return { state: "past", tone: "muted", label: i18n.t("bus.tickets.past") };
  return { state: "valid", tone: "green", label: i18n.t("bus.status.confirmed") };
}

function BookingCard({ booking }) {
  const { t: tr } = useTranslation();
  const { trip, operator } = booking;
  const { state, tone, label } = bookingTone(booking);
  const first = booking.tickets[0];
  const href = first ? `/bus/tickets/${first.ticketNumber}` : "/bus/tickets";
  const seats = booking.tickets.map((t) => t.seatNumber).filter((s) => s !== null && s !== undefined);
  return (
    <article className={`bus-mytrip is-${state}`}>
      <Link to={href} className="bus-mytrip-main" aria-label={tr("bus.tickets.openAria", { from: trip.route.originName, to: trip.route.destinationName, date: dayLabel(eatDate(trip.departureAt)) })}>
        <div className="bus-mytrip-top">
          <span className="bus-trip-co">
            <BusLogo name={operator.companyName} src={operator.logoUrl} size={44} />
            <span className="bus-trip-co-text"><b>{operator.companyName}</b><small>{tr("bus.ticketCard.ref", { ref: booking.reference })}</small></span>
          </span>
          <StatusPill tone={tone}>{label}</StatusPill>
        </div>
        <div className="bus-mytrip-route">
          <div><b>{cityCode(trip.route.originName)}</b><span>{trip.route.originName}</span></div>
          <span className="bus-mytrip-line" aria-hidden="true"><i /><BusIcon size={15} /><i /><small>{durationLabel(trip.route.durationMinutes)}</small></span>
          <div className="is-right"><b>{cityCode(trip.route.destinationName)}</b><span>{trip.route.destinationName}</span></div>
        </div>
        <div className="bus-mytrip-when">
          <span><b>{dayLabel(eatDate(trip.departureAt))}</b> · {eatTime(trip.departureAt)} → <ArrivalTime departureAt={trip.departureAt} minutes={trip.route.durationMinutes} /></span>
          <DelayChip trip={trip} />
        </div>
        {state === "cancelled" ? (
          <p className="bus-mytrip-note">{tr("bus.tickets.tripCancelled")} {booking.status === "refund_due" ? tr("bus.ticketCard.refundNote", { amount: ugx(booking.total) }) : tr("bus.tickets.cantUseTickets")}</p>
        ) : null}
        <span className="bus-mytrip-open" aria-hidden="true">{tr("bus.tickets.openTicket")} <ChevronRight size={16} /></span>
      </Link>
      <div className="bus-mytrip-foot">
        <span className="bus-mytrip-seats"><Ticket size={16} /> {tr("bus.ticketsCount", { count: booking.seatCount || booking.tickets.length })}{seats.length ? ` · ${tr("bus.tickets.seats", { seats: seats.join(", ") })}` : ""}</span>
        {booking.tickets.length > 1 ? (
          <span className="bus-mytrip-pills">
            {booking.tickets.map((t) => <Link key={t.id} to={`/bus/tickets/${t.ticketNumber}`} className="bus-pillbtn" aria-label={tr("bus.tickets.openNumber", { number: t.ticketNumber })}><Qr size={14} /> {tr("bus.tickets.seat", { seat: t.seatNumber ?? "-" })}</Link>)}
          </span>
        ) : <b className="bus-mytrip-total">{ugx(booking.total)}</b>}
      </div>
      {!booking.tickets.length ? <p className="bus-hint bus-mytrip-wait">{tr("bus.tickets.issuing")}</p> : null}
    </article>
  );
}

const PAGE = 12;

export default function BusTickets() {
  const { t: tr } = useTranslation();
  useScrollTop();
  const location = useLocation();
  const signedIn = Boolean(getSession()?.accessToken);
  const tickets = useLoad(() => busApi.myTickets(), [], { enabled: signedIn });
  const messages = useLoad(() => busApi.myMessages().catch(() => ({ items: [] })), [], { enabled: signedIn });
  const [tab, setTab] = useState(null);
  const [allNotices, setAllNotices] = useState(false);
  const [shown, setShown] = useState(PAGE);

  if (!signedIn || tickets.error?.status === 401) {
    return (
      <BusLayout>
        <div className="bus-wrap bus-sec bus-sec-first">
          <EmptyState icon={Qr} className="bus-signin" title={tr("bus.tickets.signInTitle")} action={<Link to={loginPath(location)} className="bus-btn bus-btn-primary">{tr("nav.signIn")}</Link>}>
            {tr("bus.tickets.signInSub")}
          </EmptyState>
        </div>
      </BusLayout>
    );
  }

  const upcoming = tickets.data?.upcoming || [];
  const past = tickets.data?.past || [];
  const notices = messages.data?.items || [];
  const active = tab || (upcoming.length || !past.length ? "upcoming" : "past");
  const list = active === "upcoming" ? upcoming : past;
  const shownNotices = allNotices ? notices : notices.slice(0, 1);
  const ready = !tickets.loading && !tickets.error;

  return (
    <BusLayout>
      <section className="bus-band bus-band-page">
        <div className="bus-wrap">
          <nav className="bus-breadcrumb" aria-label={tr("bus.breadcrumb")}><Link to="/bus">Gabla Bus</Link><span>/</span><span>{tr("bus.layout.myTickets")}</span></nav>
          <div className="bus-pagehead">
            <div>
              <span className="bus-kicker">{tr("bus.tickets.yourTrips")}</span>
              <h1 className="bus-page-title">{tr("bus.layout.myTickets")}</h1>
              <p className="bus-section-sub">{tr("bus.tickets.sub")}</p>
            </div>
            <div className="bus-segment" role="tablist" aria-label={tr("bus.tickets.whichTrips")}>
              <button type="button" role="tab" aria-selected={active === "upcoming"} className={active === "upcoming" ? "is-active" : ""} onClick={() => { setTab("upcoming"); setShown(PAGE); }}>{tr("bus.tickets.upcoming")}{ready ? <b>{upcoming.length}</b> : null}</button>
              <button type="button" role="tab" aria-selected={active === "past"} className={active === "past" ? "is-active" : ""} onClick={() => { setTab("past"); setShown(PAGE); }}>{tr("bus.tickets.past")}{ready ? <b>{past.length}</b> : null}</button>
            </div>
          </div>
        </div>
      </section>

      <div className="bus-wrap bus-sec bus-sec-first">
        {notices.length ? (
          <div className="bus-notices" aria-label={tr("bus.tickets.noticesAria")}>
            {shownNotices.map((n) => (
              <div key={n.id} className={`bus-notice ${n.kind === "cancellation" ? "is-danger" : n.kind === "delay" ? "is-warn" : ""}`}>
                <b>{n.title}</b> <small>· {n.companyName} · {dayLabel(eatDate(n.createdAt))}</small>
                <p>{n.message}</p>
              </div>
            ))}
            {notices.length > 1 ? <button type="button" className="bus-linkbtn" onClick={() => setAllNotices((v) => !v)}>{allNotices ? tr("bus.tickets.fewerNotices") : tr("bus.tickets.moreNotices", { count: notices.length - 1 })}</button> : null}
          </div>
        ) : null}

        {tickets.loading ? (
          <MyTripSkeletons />
        ) : tickets.error ? (
          <ErrorBox error={tickets.error} onRetry={tickets.reload} />
        ) : !upcoming.length && !past.length ? (
          <EmptyState icon={Ticket} title={tr("bus.tickets.none")} action={<Link to="/bus" className="bus-btn bus-btn-primary">{tr("bus.tickets.findBus")} <ArrowRight size={16} /></Link>}>
            {tr("bus.tickets.noneSub")}
          </EmptyState>
        ) : list.length ? (
          <>
            <div className="bus-mytrips" role="tabpanel">{list.slice(0, shown).map((b) => <BookingCard key={b.id} booking={b} />)}</div>
            {list.length > shown ? (
              <div className="bus-loadmore">
                <button type="button" className="bus-btn bus-btn-light" onClick={() => setShown((n) => n + PAGE)}>{tr("bus.tickets.showMore", { count: Math.min(PAGE, list.length - shown) })} <small>({tr("bus.tickets.leftCount", { count: list.length - shown })})</small></button>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState icon={active === "upcoming" ? Ticket : BusIcon} title={active === "upcoming" ? tr("bus.tickets.noUpcoming") : tr("bus.tickets.noPast")} action={<Link to="/bus" className="bus-btn bus-btn-primary">{tr("bus.tickets.findBus")} <ArrowRight size={16} /></Link>}>
            {active === "upcoming" ? tr("bus.tickets.noUpcomingSub") : tr("bus.tickets.noPastSub")}
          </EmptyState>
        )}
      </div>
    </BusLayout>
  );
}
