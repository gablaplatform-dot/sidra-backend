import { env } from "../config/env.js";

// The only place that talks to Resend. Every service sends through here, so there is one set of rules:
//  - a missing key or sender never throws (an order or a booking must never fail because email is off);
//  - the result always has the same shape: { sent, deliveryStatus, providerResponse? }.
// `email` is what a template returns: { subject, html, text, alias, variables }. When the email has an alias and a
// template with that alias is published in Resend, it is sent through that template; if Resend does not know the
// template (not published yet, renamed) the same email is sent as plain html instead, so nothing is ever lost.

// "Gabla <a@b.c>" -> "a@b.c"
export const addressOf = (from) => (String(from).match(/<([^>]+)>/)?.[1] ?? String(from)).trim();

const post = async (payload) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

export const sendMail = async ({ to, email, from, replyTo, attachments }) => {
  if (!env.resendApiKey || !env.resendFromEmail) return { sent: false, deliveryStatus: "not_configured" };
  if (!to) return { sent: false, deliveryStatus: "no_recipient" };
  const common = {
    from: from || env.resendFromEmail,
    to,
    subject: email.subject,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(attachments?.length ? { attachments } : {})
  };
  try {
    let result;
    if (email.alias && email.variables && env.resendUseTemplates) {
      result = await post({ ...common, template: { id: email.alias, variables: email.variables } });
      // 404 = no such published template; 422 = the template and its variables disagree. Either way, send the in-code copy.
      if (result.response.ok || ![404, 422].includes(result.response.status)) return finish(result);
    }
    return finish(await post({ ...common, html: email.html, text: email.text }));
  } catch {
    return { sent: false, deliveryStatus: "delivery_failed" };
  }
};

const finish = ({ response, body }) =>
  response.ok
    ? { sent: true, deliveryStatus: "sent", providerResponse: body }
    : { sent: false, deliveryStatus: response.status >= 500 ? "delivery_failed" : "rejected", status: response.status, providerResponse: body };
