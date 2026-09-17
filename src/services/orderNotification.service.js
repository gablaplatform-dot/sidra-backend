import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const ugx = (value) => `UGX ${Number(value ?? 0).toLocaleString()}`;

// Best-effort email to a provider when a new order lands against one of their listings (Order
// Now, cart checkout, or Buy Now). Failures here must never break order creation, so every
// caller is expected to fire-and-forget this (catch and ignore).
export class OrderNotificationService {
  async notifyProviderNewOrder({ orderId }) {
    if (!env.resendApiKey || !env.resendFromEmail) {
      return { sent: false, reason: "not_configured" };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, provider: { include: { user: true } } }
    });
    const to = order?.provider?.user?.email;
    if (!to) {
      return { sent: false, reason: "no_provider_email" };
    }

    const itemsHtml = order.items
      .map((item) => `<li>${escapeHtml(item.name)} &times; ${item.quantity} — ${ugx(item.total)}</li>`)
      .join("");
    const itemsText = order.items.map((item) => `${item.name} x${item.quantity} — ${ugx(item.total)}`).join("\n");
    const subject = `New order on Gabla — ${ugx(order.total)}`;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.resendFromEmail,
          to,
          subject,
          text: `You have a new order on Gabla.\n\n${itemsText}\n\nTotal: ${ugx(order.total)}\n\nOpen your Gabla provider profile, then the Orders tab, to accept it.`,
          html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
            <p>You have a new order on Gabla.</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total: ${ugx(order.total)}</strong></p>
            <p>Open your Gabla provider profile, then the Orders tab, to accept it.</p>
          </body></html>`
        })
      });
      return { sent: true };
    } catch {
      return { sent: false, reason: "delivery_failed" };
    }
  }
}
