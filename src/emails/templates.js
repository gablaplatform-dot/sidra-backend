import { env } from "../config/env.js";
import { formatEatDate, formatEatTime } from "../utils/busTime.js";
import { BRAND, callout, custom, details, escapeHtml, lines, p, raw, renderEmail, siteUrl, steps, ugx } from "./kit.js";

// Every email Gabla sends, one function each. A function takes plain data and returns { subject, html, text };
// services pass that to sendMail(). Wording lives here, in one place, so tone and look stay consistent.

const strong = (value) => raw(`<strong style="color:${BRAND.ink};">${escapeHtml(value)}</strong>`);
const firstName = (name, fallback = "there") => String(name || fallback).trim().split(/\s+/)[0] || fallback;
const shortRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const itemsOf = (order) => (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity, amount: ugx(i.total) }));
const withStrong = (parts) => raw(parts.map((x) => (typeof x === "string" ? escapeHtml(x) : `<strong style="color:${BRAND.ink};">${escapeHtml(x.b)}</strong>`)).join(""));

// ======================================================================================= accounts & invitations

export const providerInvite = ({ businessName, link }) =>
  renderEmail({
    alias: "gabla-provider-invite",
    subject: `You're invited to bring ${businessName} to Gabla`,
    preheader: "Complete your Gabla provider profile and get ready to be discovered.",
    badge: "Provider invitation",
    title: "Your Gabla profile is waiting",
    hero: env.emailAssetBaseUrl ? { url: `${String(env.emailAssetBaseUrl).replace(/\/$/, "")}/gabla-provider-welcome.png`, alt: "Welcome to Gabla" } : undefined,
    intro: withStrong(["You have been invited to complete the service provider profile for ", { b: businessName }, ". Add your business details so customers can discover and contact you on Gabla."]),
    blocks: [
      steps([
        { title: "Create your password", body: "Secure your provider account and confirm your contact details." },
        { title: "Complete your business profile", body: "Add your location, services, photos and the details customers need." },
        { title: "Get reviewed and go live", body: "Gabla reviews your profile before it appears to customers." }
      ])
    ],
    cta: { label: "Complete registration", url: link },
    ctaNote: "This secure invitation expires in 7 days.",
    footer: "If you were not expecting this invitation, you can safely ignore this email."
  });

export const providerRelink = ({ businessName, link }) =>
  renderEmail({
    alias: "gabla-provider-relink",
    subject: `Reconnect Google sign-in for ${businessName}`,
    preheader: "One tap to get back into your Gabla provider dashboard.",
    badge: "Account access",
    title: "Reconnect your Gabla sign-in",
    intro: withStrong(["Sign in with Google to reconnect the Gabla provider profile for ", { b: businessName }, ". You will see your dashboard, wallet and orders again straight away."]),
    blocks: [callout("This link only reconnects sign-in. It cannot change your password, your approval or your business details.", "info")],
    cta: { label: "Reconnect with Google", url: link },
    ctaNote: "This secure link expires in 7 days.",
    footer: "If you did not ask for this, you can safely ignore this email."
  });

export const adminInvite = ({ name, roleName, link }) =>
  renderEmail({
    alias: "gabla-admin-invite",
    subject: "You're invited to the Gabla admin panel",
    preheader: `Set your password to join the Gabla team as ${roleName}.`,
    badge: "Team invitation",
    title: `You're invited as ${roleName}`,
    intro: withStrong(["Hi ", firstName(name), ", you have been added to the Gabla admin panel as ", { b: roleName }, ". Set your password to activate your account."]),
    blocks: [details([["Role", roleName]])],
    cta: { label: "Set your password", url: link },
    ctaNote: "This secure link expires in 7 days.",
    footer: "If you weren't expecting this, you can safely ignore this email."
  });

export const busOperatorInvite = ({ companyName, link }) =>
  renderEmail({
    alias: "gabla-bus-operator-invite",
    subject: `You're invited to sell bus tickets on Gabla — ${companyName}`,
    preheader: "Complete your bus company profile and start selling tickets online.",
    badge: "Bus partner invitation",
    title: "Sell your bus tickets online with Gabla",
    intro: withStrong(["You've been invited to set up ", { b: companyName }, " on Gabla Bus. Tell us about your bus park, add your routes and ticket prices, and passengers can start buying numbered tickets with mobile money."]),
    blocks: [
      steps([
        { title: "Sign in with this email", body: "Use the Google account for the address this invitation was sent to." },
        { title: "Add your park, routes and prices", body: "It takes about five minutes." },
        { title: "Start selling", body: "Passengers buy online and show a QR ticket when they board." }
      ])
    ],
    cta: { label: "Complete my registration", url: link },
    ctaNote: "This secure invitation expires in 7 days.",
    footer: "If you weren't expecting this invitation, you can ignore this email."
  });

// ======================================================================================= shop orders

const deliveryRows = (order) => {
  const f = order.fulfillment || {};
  const maps = f.method === "delivery" && Number.isFinite(f.lat) && Number.isFinite(f.lng) ? `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}` : null;
  return [
    ["Fulfilment", f.method === "delivery" ? "Delivery" : f.method === "pickup" ? "Customer will pick up" : null],
    ["Deliver to", f.method === "delivery" ? f.address : null],
    ["Directions", maps ? raw(`<a href="${escapeHtml(maps)}" style="color:${BRAND.blue};">Open in Google Maps</a>`) : null]
  ];
};

export const orderNewForSeller = ({ order }) => {
  const c = order.customer || {};
  const online = order.metadata?.paymentMethod === "online" && !order.transactionId;
  const cash = !order.transactionId && !online;
  return renderEmail({
    alias: "gabla-order-new-seller",
    subject: `New order on Gabla — ${ugx(order.total)}`,
    preheader: `${c.name || "A customer"} ordered ${(order.items || []).length} item(s). Accept it to get going.`,
    badge: "New order",
    badgeTone: "success",
    title: "You have a new order",
    intro: `${c.name || "A customer"} has just placed an order with you. Review it and accept to get started.`,
    blocks: [
      lines(itemsOf(order), { total: ugx(order.total) }),
      details(
        [
          ["Customer", c.name],
          ["Phone", c.phone],
          ["Email", c.email],
          ...deliveryRows(order),
          ["Payment", cash ? "Cash on delivery / pickup" : online ? "Pays online after you accept" : "Paid online (mobile money)"],
          ["Note", c.notes]
        ],
        { title: `Order ${shortRef(order.id)}` }
      ),
      cash ? callout("Nothing has been paid online. The customer will pay you in cash when they receive the order.", "warn") : null
    ],
    cta: { label: "Open the order", url: siteUrl(`/profile/orders/${order.id}`) },
    footer: "You get this email because you sell on Gabla."
  });
};

export const orderApprovedForBuyer = ({ order }) =>
  renderEmail({
    alias: "gabla-order-approved-buyer",
    subject: `${order.provider.businessName} accepted your order. Pay now`,
    preheader: "Good news: your order is available. You can pay by mobile money now.",
    badge: "Order accepted",
    badgeTone: "success",
    title: "Your order was accepted",
    intro: withStrong(["Good news: ", { b: order.provider.businessName }, " confirmed that your order is available. You can pay for it now by mobile money."]),
    blocks: [lines(itemsOf(order), { total: ugx(order.total) }), callout("Nothing is charged until you pay.", "info")],
    cta: { label: "Pay now", url: siteUrl("/orders") },
    footer: `Order ${shortRef(order.id)} · You can follow all your orders in the Gabla app under Orders.`
  });

export const orderPaidForSeller = ({ order }) =>
  renderEmail({
    alias: "gabla-order-paid-seller",
    subject: `Order paid on Gabla: ${ugx(order.total)}`,
    preheader: "The buyer has paid. You can go ahead and fulfil the order.",
    badge: "Payment received",
    badgeTone: "success",
    title: "The buyer has paid",
    intro: `The buyer paid for the order you accepted (${ugx(order.total)}, minus Gabla's fee, credited to your wallet). You can go ahead and fulfil it.`,
    blocks: [lines(itemsOf(order), { total: ugx(order.total) }), details(deliveryRows(order), { title: `Order ${shortRef(order.id)}` })],
    cta: { label: "Open the order", url: siteUrl(`/profile/orders/${order.id}`) },
    footer: "You get this email because you sell on Gabla."
  });

const STATUS_COPY = {
  accepted: (o, pickup, online) => ({ subject: `${o.provider.businessName} accepted your order`, badge: "Order accepted", tone: "success", title: "Your order was accepted", intro: `${o.provider.businessName} accepted your order. ${online ? "You can pay for it now by mobile money." : pickup ? "They will let you know when it is ready for pickup." : "They will let you know when it is on its way."}` }),
  delivering: (o, pickup) => ({ subject: pickup ? `Your order from ${o.provider.businessName} is ready for pickup` : `Your order from ${o.provider.businessName} is on its way`, badge: pickup ? "Ready for pickup" : "On its way", tone: "info", title: pickup ? "Your order is ready for pickup" : "Your order is on its way", intro: pickup ? `${o.provider.businessName} has your order ready for pickup.` : `${o.provider.businessName} is delivering your order now.` }),
  fulfilled: (o) => ({ subject: `Your order from ${o.provider.businessName} was delivered`, badge: "Delivered", tone: "success", title: "Your order was delivered", intro: `${o.provider.businessName} marked your order as delivered. Thank you for shopping on Gabla.` }),
  rejected: (o) => ({ subject: `${o.provider.businessName} could not take your order`, badge: "Order declined", tone: "danger", title: "Your order was declined", intro: `Sorry, ${o.provider.businessName} could not take this order.` }),
  canceled: (o) => ({ subject: `Your order from ${o.provider.businessName} was cancelled`, badge: "Order cancelled", tone: "danger", title: "Your order was cancelled", intro: `${o.provider.businessName} cancelled your order.` })
};

const STATUS_ALIAS = { accepted: "accepted", delivering: "delivering", fulfilled: "delivered", rejected: "declined", canceled: "cancelled" };

export const orderStatusForBuyer = ({ order, status }) => {
  const pickup = order.fulfillment?.method === "pickup";
  const online = order.metadata?.paymentMethod === "online" && !order.transactionId;
  const copy = STATUS_COPY[status]?.(order, pickup, online);
  if (!copy) return null;
  const closed = status === "rejected" || status === "canceled";
  return renderEmail({
    alias: `gabla-order-${STATUS_ALIAS[status]}`,
    subject: copy.subject,
    preheader: copy.intro,
    badge: copy.badge,
    badgeTone: copy.tone,
    title: copy.title,
    intro: copy.intro,
    blocks: [
      lines(itemsOf(order), { total: ugx(order.total) }),
      status === "delivering" && !pickup && order.fulfillment?.address ? details([["Delivering to", order.fulfillment.address]]) : null,
      closed ? callout(order.transactionId ? "Your payment will be refunded." : "You were not charged anything.", "info") : null
    ],
    cta: { label: closed ? "Browse the shop" : "View my orders", url: siteUrl(closed ? "/shop" : "/orders") },
    footer: `Order ${shortRef(order.id)} · You can follow all your orders in the Gabla app under Orders.`
  });
};

// ======================================================================================= service bookings

// ctx: { listingName, when, size, total, reference, guest, hoursToAnswer, hoursToPay, amountDue, amountPaid, policy,
//        providerNote, address, phone, depositNote, instructions }
export const bookingEmail = ({ event, to, ctx }) => {
  const c = ctx;
  const summary = details(
    [
      ["Booking", c.listingName],
      ["When", c.when],
      ["Size", c.size],
      ["Total", ugx(c.total)],
      ["Reference", c.reference]
    ],
    { title: "Booking details" }
  );
  const policy = c.policy ? callout(c.policy, "info") : null;
  const openBookings = { label: "Open my bookings", url: siteUrl("/orders") };
  const openSeller = { label: "Open bookings", url: siteUrl("/profile?tab=bookings") };
  const guest = details([["Guest", c.guest?.name], ["Phone", c.guest?.phone], ["Note", c.guest?.notes]], { title: "Guest" });

  const copies = {
    "created:provider": c.status === "confirmed"
      ? { subject: `New booking on Gabla — ${c.listingName}`, badge: "New booking", tone: "success", title: "A guest just booked", intro: "A guest booked and it was confirmed automatically.", blocks: [summary, guest], cta: openSeller }
      : { subject: `Booking request on Gabla — ${c.listingName}`, badge: "Action needed", tone: "warn", title: "You have a booking request", intro: `Please accept or decline within ${c.hoursToAnswer} hours or the request will expire.`, blocks: [summary, guest], cta: openSeller },
    "created:customer": c.status === "confirmed"
      ? { subject: `Your booking is confirmed — ${c.listingName}`, badge: "Confirmed", tone: "success", title: "Your booking is confirmed", intro: "Everything is set. Here are your details.", blocks: [summary, c.paymentStatus === "payable" ? callout(`Pay ${ugx(c.amountDue)} within ${c.hoursToPay} hours to keep your booking: open Orders, then Bookings.`, "warn") : null, policy], cta: openBookings }
      : { subject: `We've sent your request — ${c.listingName}`, badge: "Request sent", tone: "info", title: "Your request was sent", intro: "The provider will answer shortly and we'll email you.", blocks: [summary, c.paymentStatus === "awaiting_approval" ? callout(`Once the provider accepts you can pay ${ugx(c.amountDue)} online. Nothing is charged before that.`, "info") : null, policy], cta: openBookings },
    "confirmed:customer": { subject: `Booking confirmed — ${c.listingName}`, badge: "Confirmed", tone: "success", title: "The provider accepted your booking", intro: "Good news, your booking is on.", blocks: [summary, details([["Where", c.address], ["Phone", c.phone], ["Note from the provider", c.providerNote]], { title: "Contact" }), c.paymentStatus === "payable" ? callout(`Pay ${ugx(c.amountDue)} within ${c.hoursToPay} hours to keep your booking: open Orders, then Bookings.`, "warn") : null, c.depositNote ? callout(c.depositNote, "info") : null, policy], cta: openBookings },
    "paid:provider": { subject: `Booking paid: ${c.listingName}`, badge: "Payment received", tone: "success", title: "The guest paid", intro: `The guest paid ${ugx(c.amountPaid)} for this booking (minus Gabla's fee, credited to your wallet).`, blocks: [summary], cta: openSeller },
    "paid:customer": { subject: `Payment received: ${c.listingName}`, badge: "Paid", tone: "success", title: "We received your payment", intro: `Thank you. We received your payment of ${ugx(c.amountPaid)}. See you there!`, blocks: [summary], cta: openBookings },
    "declined:customer": { subject: `Booking request declined — ${c.listingName}`, badge: "Declined", tone: "danger", title: "Your request was declined", intro: "Sorry, the provider couldn't take this booking. You can try other dates or another provider on Gabla.", blocks: [summary, c.providerNote ? callout(`Note from the provider: ${c.providerNote}`, "info") : null], cta: { label: "Find another provider", url: siteUrl("/services") } },
    "cancelled_by_provider:customer": { subject: `Booking cancelled — ${c.listingName}`, badge: "Cancelled", tone: "danger", title: "The provider cancelled your booking", intro: "We're sorry, the provider had to cancel this booking.", blocks: [summary, c.providerNote ? callout(`Note from the provider: ${c.providerNote}`, "info") : null], cta: { label: "Find another provider", url: siteUrl("/services") } },
    "cancelled_by_customer:provider": { subject: `Booking cancelled by the guest — ${c.listingName}`, badge: "Cancelled", tone: "warn", title: "The guest cancelled", intro: "The guest cancelled this booking. The dates are free again.", blocks: [summary], cta: openSeller }
  };
  const copy = copies[`${event}:${to}`];
  if (!copy) return null;
  const alias = `gabla-booking-${event.replace(/_/g, "-")}-${to}${event === "created" ? (c.status === "confirmed" ? "-instant" : "-request") : ""}`;
  return renderEmail({ alias, subject: copy.subject, preheader: copy.intro, badge: copy.badge, badgeTone: copy.tone, title: copy.title, intro: copy.intro, blocks: copy.blocks, cta: copy.cta, footer: "You can see this booking any time under Orders, then Bookings, on Gabla." });
};

// ======================================================================================= bus

export const qrUrl = (ticketNumber) => `${env.apiBaseUrl.replace(/\/$/, "")}/api/v1/bus/tickets/${encodeURIComponent(ticketNumber)}/qr.png`;

const ticketCard = (ticket, trip, route, operator) => {
  const departure = new Date(trip.departureAt);
  const label = (text) => `<span style="color:${BRAND.faint};font-size:12px;">${escapeHtml(text)}</span>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BRAND.line};border-radius:16px;margin:0 0 16px;overflow:hidden;">
<tr><td style="background:${BRAND.navy};padding:14px 18px;">
  <table role="presentation" width="100%"><tr>
    <td style="color:#FDE68A;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${escapeHtml(operator.companyName)}</td>
    <td align="right" style="color:#FFFFFF;font-size:12px;font-weight:700;">${escapeHtml(ticket.ticketTypeName)}</td>
  </tr></table>
  <div style="color:#FFFFFF;font-size:21px;font-weight:800;margin-top:6px;">${escapeHtml(route.originName)} <span style="color:${BRAND.yellow};">&rarr;</span> ${escapeHtml(route.destinationName)}</div>
</td></tr>
<tr><td style="padding:16px 18px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td valign="top" style="font-size:13px;line-height:1.6;color:${BRAND.muted};">
      <div>${label("Date")}<br><strong style="color:${BRAND.ink};font-size:15px;">${escapeHtml(formatEatDate(departure))}</strong></div>
      <div style="margin-top:8px;">${label("Departs")}<br><strong style="color:${BRAND.ink};font-size:15px;">${escapeHtml(formatEatTime(departure))}</strong></div>
      <div style="margin-top:8px;">${label("Boarding at")}<br><strong style="color:${BRAND.ink};font-size:14px;">${escapeHtml(route.boardingPoint || operator.parkName || route.originName)}</strong></div>
      <div style="margin-top:8px;">${label("Passenger")}<br><strong style="color:${BRAND.ink};font-size:14px;">${escapeHtml(ticket.passengerName)}</strong>${ticket.seatNumber ? ` &nbsp;&middot;&nbsp; Seat <strong style="color:${BRAND.ink};">${escapeHtml(ticket.seatNumber)}</strong>` : ""}</div>
    </td>
    <td valign="top" align="center" width="150" style="padding-left:12px;"><img src="${escapeHtml(qrUrl(ticket.ticketNumber))}" width="130" height="130" alt="Ticket QR code" style="display:block;border-radius:8px;border:1px solid ${BRAND.line};"></td>
  </tr></table>
  <div style="margin-top:14px;padding:10px 12px;background:#F8FAFC;border-radius:10px;text-align:center;">
    <div style="font-size:11px;color:${BRAND.faint};letter-spacing:.1em;text-transform:uppercase;">Ticket number</div>
    <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:800;color:${BRAND.navy};letter-spacing:.08em;">${escapeHtml(ticket.ticketNumber)}</div>
  </div>
</td></tr>
</table>`;
};

export const busTicket = ({ booking, trip, route, operator, tickets }) => {
  const departure = new Date(trip.departureAt);
  return renderEmail({
    alias: "gabla-bus-ticket",
    subject: `Your bus ticket: ${route.originName} to ${route.destinationName}, ${formatEatDate(departure)}`,
    preheader: `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} confirmed for ${route.originName} to ${route.destinationName}.`,
    badge: "Payment confirmed",
    badgeTone: "success",
    title: `You're booked, ${firstName(booking.passengerName, "traveller")}!`,
    intro: withStrong([tickets.length === 1 ? "Here is your ticket for " : `Here are your ${tickets.length} tickets for `, { b: `${route.originName} to ${route.destinationName}` }, ". Show the QR code or read out the ticket number when you board."]),
    blocks: [
      custom(
        tickets.map((t) => ticketCard(t, trip, route, operator)).join(""),
        [`${operator.companyName} - ${formatEatDate(departure)} at ${formatEatTime(departure)}`, `Boarding: ${route.boardingPoint || operator.parkName || route.originName}`, ...tickets.map((t) => `${t.ticketNumber} - ${t.passengerName} (${t.ticketTypeName}${t.seatNumber ? `, seat ${t.seatNumber}` : ""})`)].join("\n")
      ),
      details([["Booking", booking.reference], ["Total paid", ugx(booking.total)]]),
      callout(raw(`<strong>Before you travel</strong><br>&bull; Be at the ${escapeHtml(operator.parkName || "bus park")} at least 30 minutes before departure.<br>&bull; Keep this email or open <em>My tickets</em> on Gabla; no printing needed.<br>&bull; Each ticket works once, for the trip shown.`), "info")
    ],
    cta: { label: "Open my tickets", url: siteUrl("/bus/tickets") },
    footer: "Safe travels from the Gabla team. Questions about your trip? Contact the bus company shown on your ticket."
  });
};

export const busAnnouncement = ({ operator, title, message, kind, trip, route }) => {
  const tone = kind === "cancellation" ? "danger" : kind === "delay" ? "warn" : "info";
  const badge = kind === "notice" || !kind ? "Message from your bus company" : kind === "cancellation" ? "Trip cancelled" : kind === "delay" ? "Trip delayed" : kind;
  return renderEmail({
    alias: "gabla-bus-announcement",
    subject: `${operator.companyName}: ${title}`,
    preheader: String(message).slice(0, 110),
    badge,
    badgeTone: tone,
    title,
    intro: operator.companyName,
    blocks: [
      trip && route ? details([["Trip", `${route.originName} to ${route.destinationName}`], ["Departure", `${formatEatDate(trip.departureAt)} at ${formatEatTime(trip.departureAt)}`]]) : null,
      callout(raw(escapeHtml(message).replace(/\n/g, "<br>")), tone)
    ],
    cta: { label: "View my tickets", url: siteUrl("/bus/tickets") },
    footer: "Questions? Contact the bus company shown on your ticket."
  });
};

// ======================================================================================= quotations & receipts

export const documentEmail = ({ doc, business, accent, ordersUrl }) => {
  const snap = doc.snapshot;
  const isReceipt = doc.type === "receipt";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (value) => {
    const d = new Date(new Date(value).getTime() + 3 * 3600 * 1000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const shown = (snap.items || []).slice(0, 6);
  const more = (snap.items || []).length - shown.length;
  return renderEmail({
    alias: isReceipt ? "gabla-receipt" : "gabla-quotation",
    subject: isReceipt ? `Receipt ${doc.number} from ${business}` : `Your quotation ${doc.number} from ${business}`,
    preheader: isReceipt ? `Receipt for ${ugx(doc.total)}` : `Quotation for ${ugx(doc.total)}`,
    badge: isReceipt ? "Payment received" : "Quotation",
    badgeTone: isReceipt ? "success" : "info",
    accent,
    sender: `Sent on behalf of ${business} through Gabla.`,
    title: isReceipt ? "Thank you for your payment" : "Here is your quotation",
    intro: withStrong([`Hi ${firstName(snap.customer?.name)}, `, isReceipt ? "your receipt is attached to this email as a PDF." : `${business} has prepared a quotation for your order. It is attached as a PDF and nothing has been charged.`]),
    blocks: [
      lines([...shown.map((i) => ({ name: i.name, quantity: i.quantity, amount: ugx(i.total) })), ...(more > 0 ? [{ name: `+ ${more} more item${more > 1 ? "s" : ""}` }] : [])], { totalLabel: isReceipt ? "Amount paid" : "Total", total: ugx(doc.total), totalColor: isReceipt ? "#15803D" : accent }),
      details([[isReceipt ? "Receipt" : "Quotation", doc.number], [isReceipt ? "Paid on" : "Valid until", day(isReceipt ? snap.payment?.paidAt || snap.issuedAt : snap.validUntil)]]),
      isReceipt ? null : callout(`Happy with it? Just let ${business} know${snap.brand?.phone ? ` on ${snap.brand.phone}` : ""}, or keep your order as it is. You pay when you receive your items.`, "info")
    ],
    cta: { label: "View my orders", url: ordersUrl },
    footer: "You can reply to this email to reach the seller directly."
  });
};
