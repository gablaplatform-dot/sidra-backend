import { prisma } from "../config/db.js";
import { sendMail } from "../emails/mailer.js";
import { orderApprovedForBuyer, orderNewForSeller, orderPaidForSeller, orderStatusForBuyer } from "../emails/templates.js";

// Best-effort emails around an order. Failures here must never break the order itself, so callers fire and
// forget (catch and ignore). What each email looks like lives in src/emails/templates.js.
export class OrderNotificationService {
  // A new order landed against one of the seller's listings (Order Now, cart checkout, or Buy Now).
  async notifyProviderNewOrder({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: { include: { user: true } } } });
    const to = order?.provider?.user?.email;
    if (!to) return { sent: false, reason: "no_provider_email" };
    return sendMail({ to, email: orderNewForSeller({ order }) });
  }

  // The seller accepted an online order: the buyer can now pay for it.
  async notifyBuyerOrderApproved({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: true, user: { select: { email: true } } } });
    const to = order?.customer?.email || order?.user?.email;
    if (!to) return { sent: false, reason: "no_email" };
    return sendMail({ to, email: orderApprovedForBuyer({ order }) });
  }

  // An online order was paid: the seller can go ahead and fulfil it.
  async notifyProviderOrderPaid({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: { include: { user: true } } } });
    const to = order?.provider?.user?.email;
    if (!to) return { sent: false, reason: "no_provider_email" };
    return sendMail({ to, email: orderPaidForSeller({ order }) });
  }

  // Every change the seller makes to an order is mailed to the buyer: accepted, on its way, delivered, declined, cancelled.
  async notifyBuyerOrderStatus({ orderId, status }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: true, user: { select: { email: true } } } });
    const to = order?.customer?.email || order?.user?.email;
    if (!to) return { sent: false, reason: "no_email" };
    const email = orderStatusForBuyer({ order, status });
    if (!email) return { sent: false, reason: "no_template" };
    return sendMail({ to, email });
  }
}
