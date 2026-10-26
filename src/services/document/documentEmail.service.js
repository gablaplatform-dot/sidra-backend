import { env } from "../../config/env.js";
import { addressOf, sendMail } from "../../emails/mailer.js";
import { documentEmail } from "../../emails/templates.js";

// Emails the buyer their quotation or receipt as a PDF attachment, in the seller's name ("Pearl Mobile via
// Gabla") with replies going to the seller. Reports { sent: false } instead of throwing when email isn't
// configured, so a missing key never breaks an order.
export class DocumentEmailService {
  async sendDocument({ to, doc, pdf, replyTo }) {
    const snap = doc.snapshot;
    const isReceipt = doc.type === "receipt";
    const business = snap.brand?.businessName || doc.provider?.businessName || "Your seller";
    const accent = /^#[0-9a-f]{6}$/i.test(snap.brand?.accentColor) ? snap.brand.accentColor : "#0B2046";
    const email = documentEmail({ doc, business, accent, ordersUrl: `${env.publicSiteUrl}/orders` });
    return sendMail({
      to,
      email,
      from: `${business.replace(/[<>"]/g, "")} via Gabla <${addressOf(env.resendFromEmail || "")}>`,
      replyTo,
      attachments: [{ filename: `${isReceipt ? "Receipt" : "Quotation"}-${doc.number}.pdf`, content: pdf.toString("base64") }]
    });
  }
}
