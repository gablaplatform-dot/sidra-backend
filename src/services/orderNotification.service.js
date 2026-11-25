import { prisma } from "../config/db.js";
import { sendMail } from "../emails/mailer.js";
import { orderApprovedForBuyer, orderNewForSeller, orderPaidForSeller, orderStatusForBuyer } from "../emails/templates.js";
import { PushService } from "./push.service.js";

const STATUS_PUSH_BODY = {
  accepted: "Your order was accepted by the seller.",
  on_the_way: "Your order is on its way.",
  delivered: "Your order has been delivered.",
  declined: "Your order was declined.",
  cancelled: "Your order was cancelled."
};

// Best-effort emails (and, alongside each, a push) around an order. Failures here must never
// break the order itself, so callers fire and forget (catch and ignore). What each email looks
// like lives in src/emails/templates.js; push copy is kept short and inline here instead.
export class OrderNotificationService {
  constructor({ pushService = new PushService() } = {}) {
    this.pushService = pushService;
  }

  // A new order landed against one of the seller's listings (Order Now, cart checkout, or Buy Now).
  async notifyProviderNewOrder({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: { include: { user: true } } } });
    if (order?.provider?.user?.id) {
      this.pushService.sendToUser({
        userId: order.provider.user.id,
        title: "New order",
        body: "You've received a new order.",
        data: { type: "order", orderId }
      });
    }
    const to = order?.provider?.user?.email;
    if (!to) return { sent: false, reason: "no_provider_email" };
    return sendMail({ to, email: orderNewForSeller({ order }) });
  }

  // The seller accepted an online order: the buyer can now pay for it.
  async notifyBuyerOrderApproved({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: true, user: { select: { id: true, email: true } } } });
    if (order?.user?.id) {
      this.pushService.sendToUser({
        userId: order.user.id,
        title: "Order approved",
        body: "Your order was approved - you can pay for it now.",
        data: { type: "order", orderId }
      });
    }
    const to = order?.customer?.email || order?.user?.email;
    if (!to) return { sent: false, reason: "no_email" };
    return sendMail({ to, email: orderApprovedForBuyer({ order }) });
  }

  // An online order was paid: the seller can go ahead and fulfil it.
  async notifyProviderOrderPaid({ orderId }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: { include: { user: true } } } });
    if (order?.provider?.user?.id) {
      this.pushService.sendToUser({
        userId: order.provider.user.id,
        title: "Order paid",
        body: "An order was paid - you can go ahead and fulfil it.",
        data: { type: "order", orderId }
      });
    }
    const to = order?.provider?.user?.email;
    if (!to) return { sent: false, reason: "no_provider_email" };
    return sendMail({ to, email: orderPaidForSeller({ order }) });
  }

  // Every change the seller makes to an order is pushed/mailed to the buyer: accepted, on its way, delivered, declined, cancelled.
  async notifyBuyerOrderStatus({ orderId, status }) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, provider: true, user: { select: { id: true, email: true } } } });
    if (order?.user?.id && STATUS_PUSH_BODY[status]) {
      this.pushService.sendToUser({
        userId: order.user.id,
        title: "Order update",
        body: STATUS_PUSH_BODY[status],
        data: { type: "order", orderId, status }
      });
    }
    const to = order?.customer?.email || order?.user?.email;
    if (!to) return { sent: false, reason: "no_email" };
    const email = orderStatusForBuyer({ order, status });
    if (!email) return { sent: false, reason: "no_template" };
    return sendMail({ to, email });
  }
}
