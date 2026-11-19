import { renderEmail, details, callout, siteUrl, ugx } from "./kit.js";
import { busTicket } from "./templates.js";
import { departureTime, cancellationDeadline } from "../domain/busPolicy.js";
import { formatEatDate, formatEatTime } from "../utils/busTime.js";
export const busBookingUpdate = ({ booking: b, kind }) => {
  const trip = { ...b.trip, departureAt: departureTime(b.trip) };
  const when = (d) => `${formatEatDate(d)} · ${formatEatTime(d)} EAT`;
  if (kind === "ticket") {
    const ticket = busTicket({
      booking: b,
      trip,
      route: b.trip.route,
      operator: b.operator,
      tickets: b.tickets,
    });
    // Keep the complete QR ticket, with the cancellation policy visible in both alternatives.
    const policy = `Cancellation deadline: ${when(cancellationDeadline(b))}. After this deadline the booking is confirmed and non-refundable, except if the trip is cancelled by Gabla or the bus company. Gabla coordinates your booking with the bus contact.`;
    return {
      ...ticket,
      alias: undefined,
      variables: undefined,
      html: ticket.html.replace(
        "</body>",
        `<p style="max-width:600px;margin:20px auto;padding:16px;font:14px Arial;color:#334155">${policy}</p></body>`,
      ),
      text: `${ticket.text}\n\n${policy}`,
    };
  }
  const cancelled = kind === "cancelled" || kind === "refund_due";
  return renderEmail({
    subject: cancelled
      ? `Cancellation received · ${b.reference}`
      : `Your bus booking is now non-refundable · ${b.reference}`,
    badge: cancelled ? "Refund pending" : "Cancellation period closed",
    badgeTone: cancelled ? "warn" : "info",
    title: cancelled
      ? "Your booking has been cancelled"
      : "Your journey is confirmed",
    intro: cancelled
      ? "Your seats have been released. Gabla will arrange your refund to the mobile money number used for payment."
      : "The cancellation period has ended. Your booking is confirmed on the bus and the payment is now non-refundable, except if Gabla or the company cancels the trip.",
    blocks: [
      details([
        ["Booking", b.reference],
        ["Company", b.operator.companyName],
        [
          "Route",
          `${b.trip.route.originName} → ${b.trip.route.destinationName}`,
        ],
        ["Departure", when(trip.departureAt)],
        ["Passengers", b.seatCount],
        ["Paid", ugx(b.total)],
        ["Cancellation deadline", when(cancellationDeadline(b))],
      ]),
      callout(
        cancelled
          ? `Refund destination: ${b.payPhone}. A refund is only complete when Gabla records the return payment.`
          : `Board at ${b.trip.route.boardingPoint || b.operator.parkName}. Arrive at least 30 minutes before departure.`,
      ),
    ],
    cta: { label: "View my bookings", url: siteUrl("/bus/tickets") },
  });
};
