import { env } from "../config/env.js";

// The only place that talks to Resend. Every service sends through here, so there is one set of rules:
//  - a missing key or sender never throws (an order or a booking must never fail because email is off);
//  - the result always has the same shape: { sent, deliveryStatus, providerResponse? }.
// `email` is what a template returns: { subject, html, text }.

// "Gabla <a@b.c>" -> "a@b.c"
export const addressOf = (from) => (String(from).match(/<([^>]+)>/)?.[1] ?? String(from)).trim();

export const sendMail = async ({ to, email, from, replyTo, attachments }) => {
  if (!env.resendApiKey || !env.resendFromEmail) return { sent: false, deliveryStatus: "not_configured" };
  if (!to) return { sent: false, deliveryStatus: "no_recipient" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from || env.resendFromEmail,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length ? { attachments } : {})
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { sent: false, deliveryStatus: response.status >= 500 ? "delivery_failed" : "rejected", status: response.status, providerResponse: body };
    return { sent: true, deliveryStatus: "sent", providerResponse: body };
  } catch {
    return { sent: false, deliveryStatus: "delivery_failed" };
  }
};
