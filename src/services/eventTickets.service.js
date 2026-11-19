import crypto from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { sendMail } from "../emails/mailer.js";
import { eventTicketsEmail } from "../emails/eventTickets.js";
import { isAmbiguousPayoutError } from "./mobileMoney.service.js";

const fail = (message, statusCode = 409) => {
  throw new AppError({ message, statusCode, code: "EVENT_TICKETS" });
};
const eventFields = { id: true, title: true, address: true, startsAt: true, endsAt: true };
const holds = (eventId, now) => ({
  eventId,
  OR: [{ status: "paid" }, { status: "pending_payment", expiresAt: { gt: now } }]
});
const saleOpen = (event, now) => event?.status === "approved" && event.owner.isActive &&
  event.ticketSales?.enabled && event.startsAt > now;

export class EventTicketsService {
  constructor({ gateway, callbackUrls, db = prisma, mail = sendMail }) {
    Object.assign(this, { gateway, callbackUrls, db, mail });
  }

  async event(id, db = this.db) {
    const event = await db.communityPost.findFirst({
      where: { id, kind: "event" },
      include: { ticketSales: true, owner: { select: { isActive: true, name: true, phone: true } } }
    });
    if (!event) fail("Event not found", 404);
    return event;
  }

  async configure(id, input) {
    return this.db.$transaction(async (tx) => {
      const event = await this.event(id, tx);
      const now = new Date();
      if (input.enabled && (event.status !== "approved" || !event.owner.isActive || event.startsAt <= now)) {
        fail("Approve the event before opening ticket sales. Sales close when it starts.");
      }
      const taken = await tx.eventTicketOrder.aggregate({ where: holds(id, now), _sum: { quantity: true } });
      if (input.capacity < (taken._sum.quantity ?? 0)) fail("Capacity cannot be lower than tickets sold or held.");
      return tx.eventTicketSales.upsert({ where: { eventId: id }, create: { eventId: id, ...input }, update: input });
    });
  }

  async buy(eventId, buyerId, { quantity, payPhone, email, expectedPrice }) {
    const created = await this.db.$transaction(async (tx) => {
      const now = new Date();
      const event = await this.event(eventId, tx);
      if (!saleOpen(event, now)) fail("Online ticket sales are closed.");
      if (event.ownerId === buyerId) fail("You can’t buy tickets to your own event.");
      const buyer = await tx.user.findUniqueOrThrow({ where: { id: buyerId }, select: { name: true, isActive: true } });
      if (!buyer.isActive) fail("Sign in again to buy tickets.", 403);
      const { price, capacity } = event.ticketSales;
      const existing = await tx.eventTicketOrder.findFirst({
        where: { eventId, buyerId, status: "pending_payment", expiresAt: { gt: now } }
      });
      if (existing) return { order: existing };
      if (price !== expectedPrice) fail("The ticket price changed. Open the event again to see the current price.");
      const taken = await tx.eventTicketOrder.aggregate({ where: holds(eventId, now), _sum: { quantity: true } });
      if ((taken._sum.quantity ?? 0) + quantity > capacity) fail("There aren’t enough tickets left.");
      const total = quantity * price;
      const reference = `event-${crypto.randomUUID()}`;
      const payment = await tx.transaction.create({
        data: { userId: buyerId, type: "event_ticket", status: "pending", amount: total, netAmount: total, reference, metadata: { phone: payPhone, eventId } }
      });
      const order = await tx.eventTicketOrder.create({
        data: { eventId, buyerId, buyerName: buyer.name, buyerEmail: email, payPhone,
          transactionId: payment.id, quantity, unitPrice: price, total,
          expiresAt: new Date(Math.min(now.getTime() + 10 * 60_000, event.startsAt.getTime())) }
      });
      return { order, reference };
    });
    const { order, reference } = created;
    if (reference) {
      try {
        await this.gateway.initiateDeposit({ amount: order.total, phone: payPhone, reference, ...this.callbackUrls() });
      } catch (error) {
        if (isAmbiguousPayoutError(error)) return this.order(order.id, buyerId);
        await this.db.$transaction(async (tx) => {
          const changed = await tx.transaction.updateMany({ where: { id: order.transactionId, status: "pending" }, data: { status: "failed" } });
          if (changed.count) await this.failPayment({ id: order.transactionId }, tx);
        });
        throw error;
      }
    }
    return this.order(order.id, buyerId);
  }

  async confirmPayment(tx, transaction) {
    const order = await tx.eventTicketOrder.findUnique({ where: { transactionId: transaction.id }, include: { event: { include: { ticketSales: true, owner: { select: { isActive: true } } } } } });
    if (!order) return { refundDue: true };
    const now = new Date();
    const buyer = await tx.user.findUnique({ where: { id: order.buyerId }, select: { isActive: true } });
    const reserved = await tx.eventTicketOrder.aggregate({
      where: { ...holds(order.eventId, now), id: { not: order.id } }, _sum: { quantity: true }
    });
    if (!buyer?.isActive || !order.event.ticketSales || order.event.status !== "approved" || !order.event.owner.isActive || order.event.startsAt <= now ||
        (reserved._sum.quantity ?? 0) + order.quantity > (order.event.ticketSales?.capacity ?? 0)) {
      await this.failPayment(transaction, tx, "refund_due");
      return { refundDue: true };
    }
    await tx.eventTicketOrder.update({ where: { id: order.id }, data: {
      status: "paid", paidAt: now,
      tickets: { create: Array.from({ length: order.quantity }, () => ({ number: `GE-${crypto.randomBytes(10).toString("hex").toUpperCase()}` })) }
    } });
    return { orderId: order.id };
  }

  failPayment(transaction, db = this.db, status = "failed") {
    return db.eventTicketOrder.updateMany({
      where: { transactionId: transaction.id, status: { in: ["pending_payment", "failed"] } },
      data: { status, ...(status === "refund_due" ? { paidAt: new Date() } : {}) }
    });
  }

  async sendConfirmation(id) {
    const order = await this.db.eventTicketOrder.findUnique({ where: { id }, include: { event: { select: eventFields } } });
    if (order?.status !== "paid" || order.emailStatus === "sent" || !order.buyerEmail) return;
    const result = await this.mail({
      to: order.buyerEmail, email: eventTicketsEmail(order), idempotencyKey: `event-tickets/${id}`
    });
    await this.db.eventTicketOrder.update({ where: { id }, data: { emailStatus: result.deliveryStatus } });
  }

  async retryConfirmations() {
    const orders = await this.db.eventTicketOrder.findMany({
      where: { status: "paid", emailStatus: { in: ["pending", "delivery_failed"] },
        paidAt: { gt: new Date(Date.now() - 23 * 60 * 60_000) } },
      select: { id: true }, take: 20, orderBy: { paidAt: "asc" }
    });
    await Promise.allSettled(orders.map(({ id }) => this.sendConfirmation(id)));
  }

  async order(id, buyerId) {
    const order = await this.db.eventTicketOrder.findFirst({ where: { id, buyerId }, select: {
      id: true, quantity: true, unitPrice: true, total: true, status: true, createdAt: true,
      expiresAt: true, paidAt: true, emailStatus: true, buyerEmail: true,
      event: { select: eventFields }, tickets: { orderBy: { number: "asc" } },
      transaction: { select: { metadata: true } }
    } });
    if (!order) fail("Ticket order not found", 404);
    const { tickets, transaction, ...data } = order;
    return { ...data, status: transaction.metadata?.refundedAt ? "refunded" :
      transaction.metadata?.refundDue ? "refund_due" :
      order.status === "pending_payment" && order.expiresAt <= new Date() ? "expired" : order.status,
      tickets: await Promise.all(tickets.map(async (ticket) => ({
        number: ticket.number, usedAt: ticket.usedAt, qr: await QRCode.toDataURL(ticket.number, { width: 256, margin: 4 })
      }))) };
  }

  async mine(buyerId, page) {
    return { items: await this.db.eventTicketOrder.findMany({ where: { buyerId },
      select: { id: true, status: true, total: true, quantity: true, createdAt: true, event: { select: eventFields } },
      orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30 }) };
  }

  async redeem(eventId, ownerId, number) {
    const event = await this.event(eventId);
    if (event.ownerId !== ownerId) fail("Event not found", 404);
    if (event.status !== "approved") fail("Check-in is unavailable for this event.");
    const where = { number: number.toUpperCase(), order: { eventId, status: "paid", event: { ownerId, status: "approved" } } };
    const usedAt = new Date();
    const claim = await this.db.eventAdmission.updateMany({ where: { ...where, usedAt: null }, data: { usedAt } });
    if (claim.count) return { status: "valid", usedAt };
    const ticket = await this.db.eventAdmission.findFirst({ where, select: { usedAt: true } });
    return ticket ? { status: "used", usedAt: ticket.usedAt } : { status: "not_found" };
  }

  async report(eventId, { page, status, q }) {
    const event = await this.event(eventId);
    const where = { eventId, ...(status ? { status } : {}), ...(q ? { OR: [
      { buyerName: { contains: q } }, { buyerEmail: { contains: q } }, { payPhone: { contains: q } },
      { tickets: { some: { number: { contains: q.toUpperCase() } } } }
    ] } : {}) };
    const [items, total, sales, available, payouts] = await Promise.all([
      this.db.eventTicketOrder.findMany({ where, include: { tickets: true, transaction: { select: { status: true, metadata: true } } },
        orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25 }),
      this.db.eventTicketOrder.count({ where }),
      this.db.eventTicketOrder.aggregate({ where: { eventId, status: "paid" }, _sum: { quantity: true, total: true } }),
      this.db.eventTicketOrder.aggregate({ where: { eventId, status: "paid", payoutId: null }, _sum: { total: true } }),
      this.db.eventTicketPayout.findMany({ where: { eventId }, orderBy: { createdAt: "desc" }, take: 30 })
    ]);
    const buyers = await this.db.user.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.buyerId))] } },
      select: { id: true, email: true }
    });
    const accountEmails = new Map(buyers.map(({ id, email }) => [id, email]));
    return {
      items: items.map(({ transaction, ...order }) => ({
        accountEmail: accountEmails.get(order.buyerId) ?? null,
        ...order, status: transaction.metadata?.refundedAt ? "refunded" : order.status, payerPhone: transaction.metadata?.msisdn || order.payPhone,
        receivedAmount: order.paidAt ? transaction.metadata?.refundAmount ?? order.total : null,
        payerEmail: transaction.metadata?.payerEmail || null, gatewayPaidAt: transaction.metadata?.dateTime || null
      })),
      total, sales: sales._sum, available: available._sum.total ?? 0, payouts, salesConfig: event.ticketSales,
      owner: event.owner, canSettle: event.status === "approved" && event.endsAt <= new Date()
    };
  }

  async settle(eventId, adminId, phone) {
    const payout = await this.db.$transaction(async (tx) => {
      const event = await this.event(eventId, tx);
      if (event.status !== "approved" || event.endsAt > new Date()) fail("Payout is available after an approved event ends.");
      if (!event.owner.isActive || !event.owner.phone || event.owner.phone.replace(/\D/g, "").slice(-9) !== phone.replace(/\D/g, "").slice(-9)) {
        fail("Use the event owner’s account phone.");
      }
      const unresolved = await tx.eventTicketPayout.findFirst({ where: { eventId, status: { in: ["processing", "unknown"] } } });
      if (unresolved) fail("Resolve the previous payout before sending another.");
      const where = { eventId, status: "paid", payoutId: null };
      const amount = (await tx.eventTicketOrder.aggregate({ where, _sum: { total: true } }))._sum.total;
      if (!amount) fail("There are no unsettled sales.");
      const created = await tx.eventTicketPayout.create({ data: { eventId, ownerId: event.ownerId, adminId, phone, amount } });
      await tx.eventTicketOrder.updateMany({ where, data: { payoutId: created.id } });
      return created;
    });
    try {
      await this.gateway.initiateWithdrawal({ amount: payout.amount, phone, userId: payout.ownerId, reference: `event-payout-${payout.id}` });
    } catch (error) {
      if (isAmbiguousPayoutError(error)) {
        await this.db.eventTicketPayout.updateMany({ where: { id: payout.id, status: "processing" }, data: { status: "unknown" } });
        fail("Payout outcome unknown. Check the gateway statement before reconciling it.", 502);
      }
      await this.finishPayout(payout.id, eventId, "failed", "Gateway rejected the transfer.", { status: "processing" });
      throw error;
    }
    return this.finishPayout(payout.id, eventId, "paid", null, { status: "processing" });
  }

  async finishPayout(id, eventId, status, note, eligibility) {
    return this.db.$transaction(async (tx) => {
      const claim = await tx.eventTicketPayout.updateMany({
        where: { id, eventId, ...eligibility },
        data: { status, settledAt: new Date(), reconciliationNote: note }
      });
      if (!claim.count) fail("This payout cannot be updated.");
      if (status === "failed") await tx.eventTicketOrder.updateMany({ where: { payoutId: id }, data: { payoutId: null } });
      return tx.eventTicketPayout.findUnique({ where: { id } });
    });
  }

  reconcile(id, eventId, status, note) {
    // A process may stop after submitting the transfer but before recording its result.
    // Allow recovery of an abandoned processing record once the gateway request has timed out.
    return this.finishPayout(id, eventId, status, note, {
      OR: [{ status: "unknown" }, { status: "processing", createdAt: { lt: new Date(Date.now() - 5 * 60_000) } }]
    });
  }
}
