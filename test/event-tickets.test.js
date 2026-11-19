import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { prisma } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { AppError } from "../src/utils/AppError.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { EventTicketsService } from "../src/services/eventTickets.service.js";
import { PaymentController } from "../src/controllers/payment.controller.js";
import { PaymentService } from "../src/services/payment.service.js";
import { buildEventTicketRoutes } from "../src/routes/eventTickets.routes.js";

if (process.env.DATABASE_URL !== "file:/tmp/gabla-event-ticket-integration.db") {
  throw new Error("Event ticket integration tests require the isolated fixture database.");
}

const fixture = `event-ticket-test-${Date.now()}`;
const ids = Object.fromEntries(["owner", "buyer", "other", "reviewer", "finance"].map((key) => [key, `${fixture}-${key}`]));
const phone = "0772123456";
const tokens = {};
const deposits = [];
const withdrawals = [];
const messages = [];
let withdrawalError;
let server;
const gateway = {
  async initiateDeposit(input) { deposits.push(input); },
  async initiateWithdrawal(input) {
    withdrawals.push(input);
    if (withdrawalError) throw withdrawalError;
  }
};
const payments = new PaymentService({ mobileMoneyService: gateway });
const service = new EventTicketsService({
  gateway, callbackUrls: () => ({ successUrl: "https://fixture.test/success" }),
  mail: async (message) => { messages.push(message); return { deliveryStatus: "sent" }; }
});
payments.attachEventTickets(service);

before(async () => {
  for (const [key, id] of Object.entries(ids)) {
    const admin = ["reviewer", "finance"].includes(key);
    const role = admin ? await prisma.adminRole.create({
      data: { key: id, name: key, permissions: key === "finance" ? ["events", "transactions"] : ["events"] }
    }) : null;
    await prisma.user.create({
      data: { id, name: key, email: `${id}@fixture.test`, role: admin ? "admin" : "user", adminRoleId: role?.id,
        phone: key === "owner" ? phone : null }
    });
    tokens[key] = signAccessToken({ payload: { sub: id, role: admin ? "admin" : "user" }, secret: env.jwtSecret, issuer: env.jwtIssuer, ttlSeconds: 3600 });
  }
  const app = express();
  app.use(express.json());
  const controller = new PaymentController({ paymentService: payments });
  app.post("/events/__gateway/success", controller.mobileMoneySuccessWebhook);
  app.use("/events", buildEventTicketRoutes(service));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  const events = { event: { ownerId: ids.owner } };
  await prisma.eventAdmission.deleteMany({ where: { order: events } });
  await prisma.eventTicketOrder.deleteMany({ where: events });
  await prisma.eventTicketPayout.deleteMany({ where: events });
  await prisma.communityPost.deleteMany({ where: { ownerId: ids.owner } });
  await prisma.transaction.deleteMany({ where: { userId: ids.buyer } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.adminRole.deleteMany({ where: { key: { in: Object.values(ids) } } });
  await prisma.$disconnect();
});

async function call(path, user, body, method = body ? "POST" : "GET") {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/events${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${tokens[user]}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, ...await response.json() };
}

function createEvent() {
  return prisma.communityPost.create({ data: {
    ownerId: ids.owner, title: "Fixture <Live>", kind: "event", category: "Music", status: "approved",
    address: "Kampala", description: "Integration fixture event",
    startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 7200_000)
  } });
}

const checkout = { quantity: 2, email: "passes@fixture.test", payPhone: phone, expectedPrice: 10000 };
const sales = { enabled: true, price: 10000, capacity: 2 };

test("payment confirmation issues unique private passes once, and concurrent scans admit once", async () => {
  const event = await createEvent();
  const path = `/${event.id}/tickets/orders`;
  const desk = `/admin/${event.id}`;
  assert.equal((await call(path, "buyer", checkout)).status, 409);
  assert.equal((await call(`${desk}/ticket-sales`, "other", sales, "PUT")).status, 403);
  assert.equal((await call(`${desk}/ticket-sales`, "reviewer", sales, "PUT")).status, 200);
  assert.equal((await call(path, null, checkout)).status, 401);
  assert.equal((await call(path, "buyer", { ...checkout, expectedPrice: 999 })).status, 409);
  const pending = (await call(path, "buyer", checkout)).data;
  assert.equal(pending.status, "pending_payment");
  assert.equal(pending.tickets.length, 0);
  assert.equal((await call(path, "buyer", checkout)).data.id, pending.id);
  assert.equal(deposits.length, 1);
  assert.equal((await call(path, "other", { ...checkout, quantity: 1 })).status, 409);
  assert.equal((await call(`/tickets/orders/${pending.id}`, "other")).status, 404);

  const payload = { external_ref: deposits[0].reference, amount: 20000, msisdn: "+256772123456",
    payer_email: "mobilemoney@fixture.test", date_time: "2026-11-10 20:00:00" };
  assert.equal((await call("/__gateway/success", null, payload)).status, 403);
  const callback = new URL(payments.mobileMoneyCallbackUrls().successUrl);
  assert.equal((await call(`/__gateway/success${callback.search}`, null, payload)).status, 200);
  assert.equal((await payments.handleMobileMoneySuccess(payload, { verified: true })).reason, "already_processed");
  const order = (await call(`/tickets/orders/${pending.id}`, "buyer")).data;
  assert.equal(order.status, "paid");
  assert.equal(new Set(order.tickets.map((pass) => pass.number)).size, 2);
  assert.match(order.tickets[0].qr, /^data:image\/png;base64,/);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, checkout.email);
  assert.match(messages[0].email.html, /Fixture &lt;Live&gt;/);
  assert.ok(messages[0].email.text.includes(`/events/tickets/${order.id}`));

  const redeem = `/${event.id}/tickets/redeem`;
  const number = order.tickets[0].number;
  assert.equal((await call(redeem, "other", { number })).status, 404);
  assert.equal((await call(redeem, "owner", { number: "GE-NOT-REAL" })).data.status, "not_found");
  const attempts = await Promise.all([call(redeem, "owner", { number }), call(redeem, "owner", { number: number.toLowerCase() })]);
  assert.deepEqual(attempts.map((result) => result.data.status).sort(), ["used", "valid"]);
  const report = (await call(`${desk}/ticket-orders`, "reviewer")).data;
  assert.equal(report.items[0].payerPhone, payload.msisdn);
  assert.equal(report.items[0].payerEmail, payload.payer_email);
  assert.equal(report.items[0].accountEmail, `${ids.buyer}@fixture.test`);
  assert.ok(report.items[0].paidAt);
  assert.equal(report.available, 20000);

  assert.equal((await call(`${desk}/ticket-payouts`, "finance", { phone })).status, 409);
  await prisma.communityPost.update({ where: { id: event.id }, data: {
    startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 3600_000)
  } });
  assert.equal((await call(`${desk}/ticket-payouts`, "reviewer", { phone })).status, 403);
  assert.equal((await call(`${desk}/ticket-payouts`, "finance", { phone: "0700123456" })).status, 409);
  withdrawalError = new AppError({ message: "Gateway timed out", statusCode: 502, details: { ambiguous: true } });
  assert.equal((await call(`${desk}/ticket-payouts`, "finance", { phone })).status, 502);
  assert.equal((await call(`${desk}/ticket-payouts`, "finance", { phone })).status, 409);
  const held = (await call(`${desk}/ticket-orders`, "finance")).data;
  assert.equal(held.available, 0);
  assert.equal(held.payouts[0].status, "unknown");
  assert.equal((await call(`${desk}/ticket-payouts/${held.payouts[0].id}`, "finance",
    { status: "failed", note: "Gateway statement confirms no transfer." }, "PATCH")).status, 200);
  withdrawalError = undefined;
  const paid = (await call(`${desk}/ticket-payouts`, "finance", { phone })).data;
  assert.equal(paid.status, "paid");
  assert.equal(Number(paid.amount), 20000);
  assert.equal((await call(`${desk}/ticket-payouts`, "finance", { phone })).status, 409);
  assert.equal(withdrawals.length, 2);
});

test("a mismatched payment is held for refund and issues no admissions", async () => {
  const event = await createEvent();
  await service.configure(event.id, sales);
  const order = await service.buy(event.id, ids.buyer, checkout);
  const deposit = deposits.at(-1);
  await payments.handleMobileMoneySuccess({ external_ref: deposit.reference, amount: 5000 }, { verified: true });
  const held = await service.order(order.id, ids.buyer);
  assert.equal(held.status, "refund_due");
  assert.equal(held.tickets.length, 0);
  assert.equal((await service.report(event.id, { page: 1 })).available, 0);
  const refund = (await payments.listRefundQueue()).items.find((item) => item.reference === deposit.reference);
  assert.equal(refund.amount, "5000");
  await payments.resolveRefund({ adminUserId: ids.finance, transactionId: refund.transactionId });
  assert.equal((await service.order(order.id, ids.buyer)).status, "refunded");
});
