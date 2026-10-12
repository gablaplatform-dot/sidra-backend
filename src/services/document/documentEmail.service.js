import { env } from "../../config/env.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const ugx = (value) => `UGX ${Number(value ?? 0).toLocaleString("en-US")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (value) => {
  const d = new Date(new Date(value).getTime() + 3 * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// "Gabla <a@b.c>" -> "a@b.c"
const addressOf = (from) => (String(from).match(/<([^>]+)>/)?.[1] ?? String(from)).trim();

// Emails the buyer their quotation or receipt as a PDF attachment, in the seller's name ("Pearl Mobile via
// Gabla") with replies going to the seller. Reports { sent: false } instead of throwing when email isn't
// configured, so a missing key never breaks an order.
export class DocumentEmailService {
  async sendDocument({ to, doc, pdf, replyTo }) {
    if (!env.resendApiKey || !env.resendFromEmail) return { sent: false, deliveryStatus: "not_configured" };
    if (!to) return { sent: false, deliveryStatus: "no_recipient" };

    const snap = doc.snapshot;
    const isReceipt = doc.type === "receipt";
    const business = snap.brand?.businessName || doc.provider?.businessName || "Your seller";
    const accent = /^#[0-9a-f]{6}$/i.test(snap.brand?.accentColor) ? snap.brand.accentColor : "#0b2046";
    const subject = isReceipt ? `Receipt ${doc.number} from ${business}` : `Your quotation ${doc.number} from ${business}`;
    const items = (snap.items || []).slice(0, 5);
    const more = (snap.items || []).length - items.length;
    const ordersUrl = `${env.publicSiteUrl}/orders`;

    const rows = items.map((i) => `<tr><td style="padding:7px 0;color:#334155;font-size:14px;">${escapeHtml(i.name)} <span style="color:#94a3b8;">&times; ${i.quantity}</span></td><td style="padding:7px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${ugx(i.total)}</td></tr>`).join("");
    const heading = isReceipt ? "Payment received" : "Here is your quotation";
    const lead = isReceipt
      ? `Thank you for your payment. Your receipt is attached to this email as a PDF.`
      : `${escapeHtml(business)} has prepared a quotation for your order. It is attached as a PDF. Nothing has been charged.`;
    const meta = isReceipt
      ? `Receipt ${escapeHtml(doc.number)} &middot; ${day(snap.payment?.paidAt || snap.issuedAt)}`
      : `Quotation ${escapeHtml(doc.number)} &middot; valid until ${day(snap.validUntil)}`;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(isReceipt ? `Receipt for ${ugx(doc.total)}` : `Quotation for ${ugx(doc.total)}`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
  <tr><td style="background:${accent};border-radius:18px 18px 0 0;padding:22px 26px;color:#ffffff;">
    <div style="font-size:13px;opacity:.85;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(business)}</div>
    <div style="font-size:24px;font-weight:800;margin-top:6px;">${heading}</div>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 18px 18px;padding:26px;">
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#334155;">Hi ${escapeHtml((snap.customer?.name || "there").split(" ")[0])},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">${lead}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;border-radius:14px;padding:6px 18px 14px;">
      <tr><td colspan="2" style="padding:14px 0 6px;font-size:12px;color:#64748b;letter-spacing:.04em;text-transform:uppercase;">${meta}</td></tr>
      ${rows}
      ${more > 0 ? `<tr><td colspan="2" style="padding:4px 0;color:#94a3b8;font-size:13px;">+ ${more} more item${more > 1 ? "s" : ""}</td></tr>` : ""}
      <tr><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;font-weight:700;font-size:15px;">${isReceipt ? "Amount paid" : "Total"}</td><td style="padding:12px 0 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:800;font-size:18px;color:${isReceipt ? "#15803d" : accent};">${ugx(doc.total)}</td></tr>
    </table>
    ${isReceipt ? "" : `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#475569;">Happy with it? Just let ${escapeHtml(business)} know${snap.brand?.phone ? ` on ${escapeHtml(snap.brand.phone)}` : ""}, or keep your order as it is. You pay when you receive your items.</p>`}
    <div style="text-align:center;padding:24px 0 6px;"><a href="${escapeHtml(ordersUrl)}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;">View my orders</a></div>
  </td></tr>
  <tr><td style="padding:18px 8px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6;">Sent on behalf of ${escapeHtml(business)} through Gabla.<br>You can reply to this email to reach them directly.</td></tr>
</table></td></tr></table></body></html>`;

    const text = `${heading}\n\n${isReceipt ? "Thank you for your payment." : `${business} has prepared a quotation for your order.`}\n${isReceipt ? "Receipt" : "Quotation"} ${doc.number}: ${ugx(doc.total)}\nThe PDF is attached.\n\nView your orders: ${ordersUrl}`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${business.replace(/[<>"]/g, "")} via Gabla <${addressOf(env.resendFromEmail)}>`,
          to,
          subject,
          html,
          text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          attachments: [{ filename: `${isReceipt ? "Receipt" : "Quotation"}-${doc.number}.pdf`, content: pdf.toString("base64") }]
        })
      });
      if (!response.ok) return { sent: false, deliveryStatus: "rejected", status: response.status };
      return { sent: true, deliveryStatus: "sent" };
    } catch {
      return { sent: false, deliveryStatus: "delivery_failed" };
    }
  }
}
