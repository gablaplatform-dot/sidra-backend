import { env } from "../config/env.js";
import { formatEatDate, formatEatTime } from "../utils/busTime.js";

// Every email the bus module sends: operator invitation, the ticket itself, and operator
// announcements. Sent through Resend like the rest of the app; when it isn't configured the
// methods report { sent: false } instead of throwing, so a missing key never breaks a booking.

const NAVY = "#0b2046";
const ORANGE = "#ea580c";
const INK = "#0f172a";
const MUTED = "#64748b";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const ugx = (value) => `UGX ${Number(value ?? 0).toLocaleString("en-US")}`;

const appUrl = (path) => `${env.publicSiteUrl}${path}`;
export const qrUrl = (ticketNumber) => `${env.apiBaseUrl.replace(/\/$/, "")}/api/v1/bus/tickets/${encodeURIComponent(ticketNumber)}/qr.png`;

const shell = ({ title, preheader, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:${INK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
    <tr><td style="padding:0 4px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td style="background:${ORANGE};color:#fff;font-weight:800;font-size:18px;width:36px;height:36px;text-align:center;border-radius:10px;">G</td>
        <td style="padding-left:10px;font-size:20px;font-weight:800;color:${NAVY};">Gabla <span style="color:${ORANGE};">Bus</span></td>
      </tr></table>
    </td></tr>
    ${body}
    <tr><td style="padding:22px 8px 6px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6;">
      Safe travels from the Gabla team.<br>Questions about your trip? Contact the bus company shown on your ticket.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

const card = (inner) =>
  `<tr><td style="background:#ffffff;border-radius:18px;padding:28px 26px;box-shadow:0 1px 3px rgba(15,23,42,0.08);">${inner}</td></tr>`;

const button = (href, label, color = ORANGE) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:999px;">${escapeHtml(label)}</a>`;

export class BusEmailService {
  async send({ to, subject, text, html }) {
    if (!env.resendApiKey || !env.resendFromEmail) return { sent: false, deliveryStatus: "not_configured" };
    if (!to) return { sent: false, deliveryStatus: "no_recipient" };
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.resendFromEmail, to, subject, text, html })
      });
      if (!response.ok) return { sent: false, deliveryStatus: "rejected", status: response.status };
      return { sent: true, deliveryStatus: "sent" };
    } catch {
      return { sent: false, deliveryStatus: "delivery_failed" };
    }
  }

  async sendOperatorInvitation({ to, companyName, link }) {
    const subject = `You're invited to sell bus tickets on Gabla — ${companyName}`;
    const html = shell({
      title: subject,
      preheader: "Complete your bus company profile and start selling tickets online.",
      body: card(`
        <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:#fff7ed;color:${ORANGE};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Bus partner invitation</div>
        <h1 style="margin:16px 0 10px;font-size:26px;line-height:1.25;color:${NAVY};">Sell your bus tickets online with Gabla</h1>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:${MUTED};">
          You've been invited to set up <strong style="color:${INK};">${escapeHtml(companyName)}</strong> on Gabla Bus. Tell us about your bus park, add your routes and
          ticket prices, and passengers can start buying numbered tickets with mobile money.
        </p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${MUTED};">It takes about five minutes. You'll sign in with the Google account for <strong>this email address</strong>.</p>
        ${button(link, "Complete my registration")}
        <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">This secure invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
      `)
    });
    const text = `You've been invited to sell bus tickets on Gabla as ${companyName}. Complete your registration within 7 days: ${link}`;
    return this.send({ to, subject, text, html });
  }

  ticketCard(ticket, trip, route, operator) {
    const departure = new Date(trip.departureAt);
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px dashed #cbd5e1;border-radius:16px;margin:0 0 18px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:14px 18px;">
          <table role="presentation" width="100%"><tr>
            <td style="color:#fed7aa;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${escapeHtml(operator.companyName)}</td>
            <td align="right" style="color:#ffffff;font-size:12px;font-weight:700;">${escapeHtml(ticket.ticketTypeName)}</td>
          </tr></table>
          <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:6px;">${escapeHtml(route.originName)} <span style="color:${ORANGE};">&rarr;</span> ${escapeHtml(route.destinationName)}</div>
        </td></tr>
        <tr><td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td valign="top" style="font-size:13px;line-height:1.7;color:${MUTED};">
              <div><span style="color:#94a3b8;">Date</span><br><strong style="color:${INK};font-size:15px;">${escapeHtml(formatEatDate(departure))}</strong></div>
              <div style="margin-top:8px;"><span style="color:#94a3b8;">Departs</span><br><strong style="color:${INK};font-size:15px;">${escapeHtml(formatEatTime(departure))}</strong></div>
              <div style="margin-top:8px;"><span style="color:#94a3b8;">Boarding at</span><br><strong style="color:${INK};font-size:14px;">${escapeHtml(route.boardingPoint || operator.parkName || route.originName)}</strong></div>
              <div style="margin-top:8px;"><span style="color:#94a3b8;">Passenger</span><br><strong style="color:${INK};font-size:14px;">${escapeHtml(ticket.passengerName)}</strong>${ticket.seatNumber ? ` &nbsp;·&nbsp; Seat <strong style="color:${INK};">${ticket.seatNumber}</strong>` : ""}</div>
            </td>
            <td valign="top" align="center" width="150" style="padding-left:12px;">
              <img src="${escapeHtml(qrUrl(ticket.ticketNumber))}" width="130" height="130" alt="Ticket QR code" style="display:block;border-radius:8px;border:1px solid #e2e8f0;">
            </td>
          </tr></table>
          <div style="margin-top:14px;padding:10px 12px;background:#f8fafc;border-radius:10px;text-align:center;">
            <div style="font-size:11px;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;">Ticket number</div>
            <div style="font-family:'Courier New',monospace;font-size:22px;font-weight:800;color:${NAVY};letter-spacing:.08em;">${escapeHtml(ticket.ticketNumber)}</div>
          </div>
        </td></tr>
      </table>`;
  }

  async sendTicketEmail({ to, booking, trip, route, operator, tickets }) {
    const departure = new Date(trip.departureAt);
    const subject = `Your bus ticket: ${route.originName} to ${route.destinationName}, ${formatEatDate(departure)}`;
    const html = shell({
      title: subject,
      preheader: `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} confirmed for ${route.originName} to ${route.destinationName}.`,
      body: `
        ${card(`
          <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700;">Payment confirmed</div>
          <h1 style="margin:14px 0 8px;font-size:25px;line-height:1.25;color:${NAVY};">You're booked, ${escapeHtml(booking.passengerName.split(" ")[0])}!</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${MUTED};">
            Here ${tickets.length === 1 ? "is your ticket" : `are your ${tickets.length} tickets`} for <strong style="color:${INK};">${escapeHtml(route.originName)} to ${escapeHtml(route.destinationName)}</strong>.
            Show the QR code or read out the ticket number when you board.
          </p>
          ${tickets.map((t) => this.ticketCard(t, trip, route, operator)).join("")}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:12px;margin-top:4px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.7;color:${MUTED};">
            <strong style="color:${INK};">Booking</strong> ${escapeHtml(booking.reference)} &nbsp;·&nbsp; <strong style="color:${INK};">Total paid</strong> ${ugx(booking.total)}<br>
            <strong style="color:${INK};">Before you travel</strong><br>
            &bull; Be at the ${escapeHtml(operator.parkName || "bus park")} at least 30 minutes before departure.<br>
            &bull; Keep this email or open <em>My tickets</em> on Gabla; no printing needed.<br>
            &bull; Each ticket works once, for the trip shown.
          </td></tr></table>
          <div style="margin-top:22px;text-align:center;">${button(appUrl("/bus/tickets"), "Open my tickets", NAVY)}</div>
        `)}`
    });
    const text = [
      `Your Gabla Bus ${tickets.length === 1 ? "ticket" : "tickets"}: ${route.originName} to ${route.destinationName}`,
      `${operator.companyName} - ${formatEatDate(departure)} at ${formatEatTime(departure)}`,
      `Boarding: ${route.boardingPoint || operator.parkName || route.originName}`,
      ...tickets.map((t) => `${t.ticketNumber} - ${t.passengerName} (${t.ticketTypeName}${t.seatNumber ? `, seat ${t.seatNumber}` : ""})`),
      `Booking ${booking.reference}, total ${ugx(booking.total)}`,
      `My tickets: ${appUrl("/bus/tickets")}`
    ].join("\n");
    return this.send({ to, subject, text, html });
  }

  async sendAnnouncement({ to, operator, title, message, kind, trip, route }) {
    const subject = `${operator.companyName}: ${title}`;
    const tone = kind === "cancellation" ? "#b91c1c" : kind === "delay" ? "#b45309" : NAVY;
    const html = shell({
      title: subject,
      preheader: message.slice(0, 90),
      body: card(`
        <div style="color:${tone};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(kind === "notice" ? "Message from your bus company" : kind)}</div>
        <h1 style="margin:10px 0 6px;font-size:23px;color:${NAVY};">${escapeHtml(title)}</h1>
        <p style="margin:0 0 6px;color:${MUTED};font-size:13px;">${escapeHtml(operator.companyName)}</p>
        ${trip && route ? `<p style="margin:10px 0;padding:10px 12px;background:#f8fafc;border-radius:10px;font-size:14px;color:${INK};"><strong>${escapeHtml(route.originName)} &rarr; ${escapeHtml(route.destinationName)}</strong><br>${escapeHtml(formatEatDate(trip.departureAt))} at ${escapeHtml(formatEatTime(trip.departureAt))}</p>` : ""}
        <p style="margin:14px 0 22px;font-size:16px;line-height:1.7;color:${INK};white-space:pre-line;">${escapeHtml(message)}</p>
        <div style="text-align:center;">${button(appUrl("/bus/tickets"), "View my tickets", NAVY)}</div>
      `)
    });
    return this.send({ to, subject, text: `${operator.companyName}: ${title}\n\n${message}`, html });
  }
}
