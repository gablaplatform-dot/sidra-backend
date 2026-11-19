import { details, escapeHtml, renderEmail, siteUrl, ugx } from "./kit.js";

export function eventTicketsEmail(order) {
  const { event, quantity } = order;
  const date = new Intl.DateTimeFormat("en-UG", {
    dateStyle: "full", timeStyle: "short", timeZone: "Africa/Kampala"
  }).format(event.startsAt);
  const headline = quantity === 1 ? "Your ticket is ready" : "Your tickets are ready";
  return renderEmail({
    subject: `${headline} · ${event.title}`,
    preheader: `Open your admission passes for ${event.title}.`,
    badge: "Payment confirmed",
    badgeTone: "success",
    accent: "#DB1768",
    title: headline,
    intro: `Hi ${order.buyerName}, your Mobile Money payment went through. Open your tickets to show each QR code at the door.`,
    blocks: [{
      html: `<table role="presentation" width="100%" cellspacing="0" style="margin:4px 0 18px;background:#b81155;color:white;border-radius:12px">
        <tr><td align="center" style="padding:24px 16px">
          <strong style="font-size:11px;letter-spacing:2px">GABLA EVENTS · ADMISSION</strong>
          <h2 style="margin:10px 0 18px;font-size:26px;line-height:1.2">${escapeHtml(event.title)}</h2>
          <table role="presentation" cellspacing="0" style="background:#fff3f8;color:#611131;border:2px solid #fff;border-radius:10px">
            <tr><td style="padding:12px 14px;font-weight:800;letter-spacing:1px;font-size:11px">GENERAL ADMISSION</td>
                <td align="center" style="padding:10px 14px;border-left:2px dashed #bd6a8e;font-size:14px;font-weight:800">${quantity} ${quantity === 1 ? "PASS" : "PASSES"}</td></tr>
          </table>
        </td></tr>
      </table>`,
      text: `${event.title} · ${quantity} ${quantity === 1 ? "ticket" : "tickets"}`
    }, details([["When", `${date} EAT`], ["Venue", event.address], ["Paid", ugx(order.total)]])],
    cta: { label: quantity === 1 ? "Open my ticket" : "Open my tickets", url: siteUrl(`/events/tickets/${order.id}`) },
    ctaNote: "Sign in with the Gabla account used at checkout. Each ticket admits one person."
  });
}
