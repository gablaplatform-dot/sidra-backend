import { execFileSync } from "node:child_process";
import { BusRouteDeskService } from "../src/services/busRouteDesk.service.js";
import { todayEat, addDaysToDateString } from "../src/utils/busTime.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { prisma } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { BusManagementService } from "../src/services/busManagement.service.js";
import { BusCatalogService } from "../src/services/busCatalog.service.js";
import { BusOperatorService } from "../src/services/busOperator.service.js";
import { BusOperationsService } from "../src/services/busOperations.service.js";
import { BusBookingService } from "../src/services/busBooking.service.js";
import { buildBusRoutes } from "../src/routes/bus.routes.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { departureTime, canCancelBooking } from "../src/domain/busPolicy.js";
if (process.env.DATABASE_URL !== "file:/tmp/gabla-bus-managed-test.db")
  throw Error("Use isolated managed-bus fixture database");
const key = `bus-${Date.now()}`,
  calls = [],
  mails = [];
let deliver = true,
  server,
  base,
  op,
  vehicle,
  route,
  admin,
  buyer,
  other;
const cat = new BusCatalogService(),
  operator = new BusOperatorService({
    catalogService: cat,
    emailService: {},
    hashPassword: () => "",
  });
const booking = new BusBookingService({
  operatorService: operator,
  catalogService: cat,
  mobileMoneyService: {
    async initiateDeposit(p) {
      calls.push(p);
    },
  },
  callbackUrls: () => ({}),
});
const management = new BusManagementService({
  catalogService: cat,
  operatorService: operator,
  bookingService: booking,
  mail: async (p) => {
    mails.push(p);
    return {
      sent: deliver,
      deliveryStatus: deliver ? "sent" : "delivery_failed",
    };
  },
});
booking.management = management;
const routeDesk = new BusRouteDeskService({ catalogService: cat });
const operations = new BusOperationsService({
  catalogService: cat,
  bookingService: booking,
  emailService: {
    async sendAnnouncement() {
      return { sent: true };
    },
  },
});
const token = (u) =>
  signAccessToken({
    payload: { sub: u.id, role: u.role },
    secret: env.jwtSecret,
    issuer: env.jwtIssuer,
    ttlSeconds: 3600,
  });
async function api(path, { actor = admin, method = "GET", body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token(actor)}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, ...(await r.json()) };
}
async function trip({ hours = 8, delay = 0 } = {}) {
  return prisma.busTrip.create({
    data: {
      operatorId: op.id,
      routeId: route.id,
      vehicleId: vehicle.id,
      departureAt: new Date(Date.now() + hours * 3600000),
      delayMinutes: delay,
      seats: vehicle.seats,
    },
  });
}
async function paid(t, quantity = 1) {
  const b = await booking.createBooking({
    userId: buyer.id,
    tripId: t.id,
    items: [{ ticketTypeId: route.ticketTypes[0].id, quantity }],
    passenger: {
      name: "Fixture Passenger",
      phone: "0772123456",
      email: buyer.email,
    },
    payPhone: "0772123456",
  });
  await prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findFirst({
      where: { busBooking: { id: b.bookingId } },
    });
    await booking.confirmPayment({
      tx,
      transaction: trx,
      walletService: { async creditBalance() {} },
    });
    await tx.transaction.update({
      where: { id: trx.id },
      data: { status: "success" },
    });
  });
  return prisma.busBooking.findUnique({ where: { id: b.bookingId } });
}
before(async () => {
  const role = await prisma.adminRole.create({
    data: { key, name: "Bus operations", permissions: ["busticketing"] },
  });
  admin = await prisma.user.create({
    data: {
      name: "Operator admin",
      role: "admin",
      email: `${key}-admin@example.com`,
      adminRoleId: role.id,
    },
  });
  buyer = await prisma.user.create({
    data: {
      name: "Passenger",
      role: "user",
      email: `${key}-buyer@example.com`,
    },
  });
  other = await prisma.user.create({
    data: {
      name: "Other passenger",
      role: "user",
      email: `${key}-other@example.com`,
    },
  });
  const app = express();
  app.use(express.json());
  app.use(
    "/bus",
    buildBusRoutes({
      busCatalogService: cat,
      busOperatorService: operator,
      busOperationsService: operations,
      busBookingService: booking,
      busManagementService: management,
      busRouteDeskService: routeDesk,
    }),
  );
  app.use((e, req, res, _next) =>
    res
      .status(e.statusCode || 500)
      .json({ error: { code: e.code, message: e.message } }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await prisma.$disconnect();
});
test("admin creates managed company without invitation or claiming existing customer account", async () => {
  const result = await api("/bus/admin/companies", {
    method: "POST",
    body: {
      companyName: key,
      contactName: "Dispatcher",
      contactPhone: "0772123456",
      email: buyer.email,
      parkName: "Kisenyi",
      parkDistrict: "Kampala",
      parkLat: 0.31,
      parkLng: 32.57,
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  op = result.data;
  assert.equal(op.managedByGabla, true);
  assert.equal(op.onboardingStatus, "registered");
  assert.notEqual(op.userId, buyer.id);
  assert.equal(
    await prisma.busOperatorInvitation.count({ where: { operatorId: op.id } }),
    0,
  );
  assert.equal(
    (await prisma.user.findUnique({ where: { id: op.userId } })).isActive,
    false,
  );
});
test("customer cannot create companies; admin must provide map coordinates", async () => {
  assert.equal(
    (
      await api("/bus/admin/companies", {
        actor: buyer,
        method: "POST",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("/bus/admin/companies", {
        method: "POST",
        body: { companyName: "Invalid company" },
      })
    ).status,
    400,
  );
});
test("admin adds bus, scoped route, prices and schedules", async () => {
  let r = await api(`/bus/admin/companies/${op.id}/buses`, {
    method: "POST",
    body: {
      name: "Executive coach",
      registration: key,
      contactName: "Conductor",
      contactPhone: "0772123456",
      seats: 45,
      cancellationMinutes: 120,
      amenities: ["USB charging"],
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  vehicle = r.data;
  r = await api(`/bus/admin/companies/${op.id}/routes`, {
    method: "POST",
    body: {
      originName: "Kampala",
      destinationName: "Gulu",
      vehicleId: vehicle.id,
      durationMinutes: 330,
      ticketTypes: [{ name: "Standard", price: 40000 }],
      departures: [{ departureTime: "08:00" }],
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  route = r.data;
  const generated = await prisma.busTrip.findFirst({
    where: { routeId: route.id },
  });
  assert.equal(generated.vehicleId, vehicle.id);
  assert.equal(generated.seats, 45);
  await assert.rejects(
    () =>
      cat.createRoute(op.id, {
        originName: "A",
        destinationName: "B",
        vehicleId: "not-owned",
      }),
    (e) => e.code === "BUS_VEHICLE_INVALID",
  );
});
test("payment creates multiple tickets, snapshots cancellation policy and queues receipt atomically", async () => {
  const t = await trip();
  const b = await paid(t, 2);
  assert.equal(b.cancellationMinutes, 120);
  assert.equal(+b.cancellationClosesAt, +departureTime(t) - 120 * 60000);
  assert.equal(await prisma.busTicket.count({ where: { bookingId: b.id } }), 2);
  assert.equal(
    await prisma.busNotification.count({
      where: { bookingId: b.id, kind: "ticket" },
    }),
    1,
  );
  const dto = await booking.getBooking({ userId: buyer.id, bookingId: b.id });
  assert.equal(dto.canCancel, true);
  assert.equal(dto.seatCount, 2);
});
test("customer cancellation is owner-only, releases tickets once and makes refund due", async () => {
  const t = await trip(),
    b = await paid(t);
  await assert.rejects(
    () => management.cancelBooking({ bookingId: b.id, userId: other.id }),
    (e) => e.statusCode === 404,
  );
  const before = Number(
    (await prisma.busOperator.findUnique({ where: { id: op.id } }))
      .walletBalance,
  );
  await management.cancelBooking({ bookingId: b.id, userId: buyer.id });
  assert.equal(
    (await prisma.busBooking.findUnique({ where: { id: b.id } })).status,
    "refund_due",
  );
  assert.equal(
    (await prisma.busTicket.findFirst({ where: { bookingId: b.id } })).status,
    "cancelled",
  );
  await assert.rejects(() =>
    management.cancelBooking({ bookingId: b.id, userId: buyer.id }),
  );
  const after = Number(
    (await prisma.busOperator.findUnique({ where: { id: op.id } }))
      .walletBalance,
  );
  assert.equal(before - after, 38000);
  assert.equal(
    await prisma.busNotification.count({
      where: { bookingId: b.id, kind: "cancelled" },
    }),
    1,
  );
});
test("deadline lock is enforced even before maintenance; lock email queues exactly once", async () => {
  const t = await trip({ hours: 1 }),
    b = await paid(t);
  await assert.rejects(
    () => management.cancelBooking({ bookingId: b.id, userId: buyer.id }),
    (e) => e.code === "BUS_CANCELLATION_CLOSED",
  );
  await management.maintenance();
  await management.maintenance();
  const row = await prisma.busBooking.findUnique({
    where: { id: b.id },
    include: { trip: true },
  });
  assert.ok(row.lockedAt);
  assert.equal(canCancelBooking(row), false);
  assert.equal(
    await prisma.busNotification.count({
      where: { bookingId: b.id, kind: "locked" },
    }),
    1,
  );
  assert.ok(
    mails.find(
      (m) =>
        m.email.subject.includes("non-refundable") &&
        m.email.text.includes(b.reference),
    ),
  );
});
test("failed email remains pending and retries using a stable delivery key", async () => {
  const t = await trip(),
    b = await paid(t);
  deliver = false;
  await management.deliver();
  let job = await prisma.busNotification.findUnique({
    where: { bookingId_kind: { bookingId: b.id, kind: "ticket" } },
  });
  assert.equal(job.status, "pending");
  assert.equal(job.lastError, "delivery_failed");
  deliver = true;
  await prisma.busNotification.update({
    where: { id: job.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await management.deliver();
  job = await prisma.busNotification.findUnique({ where: { id: job.id } });
  assert.equal(job.status, "sent");
  assert.equal(
    mails.filter((m) => m.idempotencyKey === `bus-${job.id}`).length,
    2,
  );
});
test("cash handover requires a call, closed cancellation and exact net amount; cannot double pay", async () => {
  const t = await trip({ hours: 1 }),
    b = await paid(t);
  const input = {
    bookingId: b.id,
    actorId: admin.id,
    recipient: "Bus contact",
    phone: "0772123456",
    reference: "CASH-TEST-01",
    amount: 38000,
  };
  await assert.rejects(() => management.handover(input));
  await management.verifyAvailability({
    bookingId: b.id,
    actorId: admin.id,
    available: true,
    note: "Called conductor; bus waiting",
  });
  await assert.rejects(() => management.handover({ ...input, amount: 40000 }));
  await management.handover(input);
  await assert.rejects(() => management.handover(input));
  const row = await prisma.busBooking.findUnique({ where: { id: b.id } });
  assert.equal(row.handoverById, admin.id);
  assert.equal(row.handoverRecipient, "Bus contact");
  const open = await paid(await trip());
  await management.verifyAvailability({
    bookingId: open.id,
    actorId: admin.id,
    available: true,
    note: "Bus available",
  });
  await assert.rejects(() =>
    management.handover({ ...input, bookingId: open.id }),
  );
});
test("unavailable buses reject payment before prompting mobile money", async () => {
  const t = await trip();
  await operations.setAvailability({
    operatorId: op.id,
    tripId: t.id,
    available: false,
    note: "Dispatcher: bus broke down",
  });
  const count = calls.length;
  await assert.rejects(
    () => paid(t),
    (e) => e.code === "BUS_UNAVAILABLE",
  );
  assert.equal(calls.length, count);
});
test("demo catalogue can be browsed but never charged", async () => {
  await prisma.busOperator.update({
    where: { id: op.id },
    data: { isDemo: true },
  });
  const t = await trip();
  assert.equal((await booking.getTrip(t.id)).bookable, false);
  await assert.rejects(
    () => paid(t),
    (e) => e.code === "BUS_DEMO_ONLY",
  );
  await prisma.busOperator.update({
    where: { id: op.id },
    data: { isDemo: false },
  });
});
test("delays respect effective departure; background clock changes departed and completed states", async () => {
  const future = await trip({ hours: -0.25, delay: 60 });
  await management.maintenance();
  assert.equal(
    (await prisma.busTrip.findUnique({ where: { id: future.id } })).status,
    "scheduled",
  );
  const past = await trip({ hours: -0.25 });
  await management.maintenance();
  assert.equal(
    (await prisma.busTrip.findUnique({ where: { id: past.id } })).status,
    "departed",
  );
  const ended = await trip({ hours: -8 });
  await management.maintenance();
  assert.equal(
    (await prisma.busTrip.findUnique({ where: { id: ended.id } })).status,
    "completed",
  );
});
test("delay extends an open policy but never reopens a locked booking", async () => {
  const t = await trip(),
    b = await paid(t),
    old = +b.cancellationClosesAt;
  await operations.delayTrip({
    operatorId: op.id,
    tripId: t.id,
    delayMinutes: 60,
    note: "Traffic",
  });
  assert.equal(
    +(await prisma.busBooking.findUnique({ where: { id: b.id } }))
      .cancellationClosesAt,
    old + 3600000,
  );
  const t2 = await trip({ hours: 1 }),
    b2 = await paid(t2);
  await management.maintenance();
  await operations.delayTrip({
    operatorId: op.id,
    tripId: t2.id,
    delayMinutes: 180,
    note: "Traffic",
  });
  assert.equal(
    (await booking.getBooking({ userId: buyer.id, bookingId: b2.id }))
      .canCancel,
    false,
  );
});
test("late successful payment after departure is flagged for refund without tickets", async () => {
  const t = await trip();
  const b = await booking.createBooking({
    userId: buyer.id,
    tripId: t.id,
    items: [{ ticketTypeId: route.ticketTypes[0].id, quantity: 1 }],
    passenger: { name: "Passenger", phone: "0772123456" },
    payPhone: "0772123456",
  });
  await prisma.busTrip.update({
    where: { id: t.id },
    data: { departureAt: new Date(Date.now() - 60000) },
  });
  const result = await prisma.$transaction(async (tx) =>
    booking.confirmPayment({
      tx,
      transaction: await tx.transaction.findFirst({
        where: { busBooking: { id: b.bookingId } },
      }),
      walletService: {},
    }),
  );
  assert.equal(result.refundDue, true);
  assert.equal(
    await prisma.busTicket.count({ where: { bookingId: b.bookingId } }),
    0,
  );
});
test("refund record requires a reference and is idempotent", async () => {
  const b = await paid(await trip());
  await management.cancelBooking({ bookingId: b.id, userId: buyer.id });
  await assert.rejects(() => operations.adminMarkRefunded(b.id));
  await operations.adminMarkRefunded(b.id, {
    actorId: admin.id,
    reference: "REFUND-TEST-01",
  });
  await assert.rejects(() =>
    operations.adminMarkRefunded(b.id, {
      actorId: admin.id,
      reference: "DOUBLE",
    }),
  );
  assert.equal(
    (await prisma.busBooking.findUnique({ where: { id: b.id } })).refundedById,
    admin.id,
  );
});
test("admin booking filters include payment/contact/audit data and customer cannot access desk", async () => {
  assert.equal(
    (await api("/bus/admin/desk/bookings", { actor: buyer })).status,
    403,
  );
  const result = await api(
    `/bus/admin/desk/bookings?operatorId=${op.id}&status=confirmed&limit=2`,
  );
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.data.items.length, 2);
  assert.ok(result.data.items[0].payPhone);
  assert.ok(result.data.items[0].trip.vehicle.contactPhone);
});

test("admin can correct an automatic departure after calling the stage, without reopening locked bookings", async () => {
  const t = await trip({ hours: 1 }),
    b = await paid(t);
  await prisma.busTrip.update({
    where: { id: t.id },
    data: { departureAt: new Date(Date.now() - 15 * 60000) },
  });
  await management.maintenance();
  assert.equal(
    (await prisma.busTrip.findUnique({ where: { id: t.id } })).status,
    "departed",
  );
  await operations.delayTrip({
    operatorId: op.id,
    tripId: t.id,
    delayMinutes: 90,
    note: "Called dispatcher: bus still at stage; new departure confirmed",
  });
  assert.equal(
    (await prisma.busTrip.findUnique({ where: { id: t.id } })).status,
    "scheduled",
  );
  assert.equal(
    (await booking.getBooking({ bookingId: b.id, userId: buyer.id })).canCancel,
    false,
  );
});

let sharedRoute, secondCompany;
const travelDate = addDaysToDateString(todayEat(), 1);
test("route exists before any company or bus is assigned and duplicate towns are rejected", async () => {
  const result = await api("/bus/admin/routes", {
    method: "POST",
    body: {
      originName: `Kampala ${key}`,
      destinationName: "Hoima",
      durationMinutes: 210,
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  sharedRoute = result.data;
  assert.equal((await routeDesk.get(sharedRoute.id)).departures.length, 0);
  assert.equal(
    (
      await api("/bus/admin/routes", {
        method: "POST",
        body: { originName: `Kampala ${key}`, destinationName: "Hoima" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api("/bus/admin/routes", {
        method: "POST",
        body: { originName: "Kampala", destinationName: "kampala" },
      })
    ).status,
    400,
  );
});
test("adding an existing bus under a route keeps its own pickup stage, pin and departure", async () => {
  const result = await api(`/bus/admin/routes/${sharedRoute.id}/buses`, {
    method: "POST",
    body: {
      operatorId: op.id,
      vehicleId: vehicle.id,
      pickupName: "Kisenyi Hoima Stage",
      pickupLat: 0.31,
      pickupLng: 32.57,
      date: travelDate,
      departureTime: "09:00",
      repeatDaily: true,
      price: 25000,
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  const detail = await routeDesk.get(sharedRoute.id);
  assert.equal(detail.departures.length, 1);
  assert.equal(detail.departures[0].vehicleId, vehicle.id);
  assert.equal(detail.departures[0].boardingLat, 0.31);
  assert.equal(detail.departures[0].schedules[0].departureTime, "09:00");
});
test("another company and a new bus can join the same route with a different stage and fare", async () => {
  secondCompany = await management.createCompany({
    companyName: `Second ${key}`,
    contactName: "Dispatcher",
    contactPhone: "0772123456",
    parkName: "Namayiba",
    parkDistrict: "Kampala",
    parkLat: 0.32,
    parkLng: 32.58,
  });
  const result = await api(`/bus/admin/routes/${sharedRoute.id}/buses`, {
    method: "POST",
    body: {
      operatorId: secondCompany.id,
      bus: {
        name: "Express coach",
        registration: `ROUTE-${key}`,
        contactName: "Second conductor",
        contactPhone: "0772123456",
        seats: 50,
        cancellationMinutes: 90,
        amenities: ["Luggage"],
      },
      pickupName: "Namayiba Hoima Stage",
      pickupLat: 0.32,
      pickupLng: 32.58,
      date: travelDate,
      departureTime: "11:00",
      repeatDaily: false,
      price: 30000,
    },
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  const detail = await routeDesk.get(sharedRoute.id);
  assert.equal(detail.departures.length, 2);
  assert.equal(new Set(detail.departures.map((d) => d.operatorId)).size, 2);
  assert.equal(new Set(detail.departures.map((d) => d.boardingPoint)).size, 2);
  const card = (await routeDesk.list({ q: key })).items.find(
    (r) => r.id === sharedRoute.id,
  );
  assert.equal(card.companies, 2);
  assert.equal(card.buses, 2);
  assert.equal(card.priceFrom, 25000);
});
test("company/bus mismatch and missing map pin are rejected without partially creating data", async () => {
  const count = await prisma.busRoute.count();
  const body = {
    operatorId: secondCompany.id,
    vehicleId: vehicle.id,
    pickupName: "Wrong stage",
    pickupLat: 0,
    pickupLng: 32,
    date: travelDate,
    departureTime: "12:00",
    price: 25000,
  };
  assert.equal(
    (
      await api(`/bus/admin/routes/${sharedRoute.id}/buses`, {
        method: "POST",
        body,
      })
    ).status,
    400,
  );
  const missingPin = { ...body };
  delete missingPin.pickupLat;
  assert.equal(
    (
      await api(`/bus/admin/routes/${sharedRoute.id}/buses`, {
        method: "POST",
        body: missingPin,
      })
    ).status,
    400,
  );
  assert.equal(await prisma.busRoute.count(), count);
});
test("passengers compare companies on one route and retain the selected pickup coordinates", async () => {
  const results = await booking.searchTrips({
    from: sharedRoute.originName,
    to: sharedRoute.destinationName,
    date: travelDate,
  });
  const options = results.items.filter(
    (t) => t.route.corridorId === sharedRoute.id,
  );
  assert.equal(options.length, 2);
  assert.equal(new Set(options.map((t) => t.operator.id)).size, 2);
  const chosen = options.find((t) => t.operator.id === secondCompany.id);
  assert.equal(chosen.route.boardingLat, 0.32);
  assert.equal(chosen.priceFrom, "30000");
  assert.equal(chosen.cancellationMinutes, 90);
  const detail = await booking.getTrip(chosen.id);
  const created = await booking.createBooking({
    userId: buyer.id,
    tripId: chosen.id,
    items: [{ ticketTypeId: detail.ticketTypes[0].id, quantity: 1 }],
    passenger: { name: "Route Passenger", phone: "0772123456" },
    payPhone: "0772123456",
  });
  const dto = await booking.getBooking({
    userId: buyer.id,
    bookingId: created.bookingId,
  });
  assert.equal(dto.trip.route.boardingPoint, "Namayiba Hoima Stage");
  assert.equal(dto.trip.route.boardingLng, 32.58);
});
test("route departure board includes both companies and respects a one-off departure date", async () => {
  const today = (
    await routeDesk.trips(sharedRoute.id, { from: travelDate, to: travelDate })
  ).items;
  assert.equal(today.length, 2);
  assert.equal(new Set(today.map((t) => t.operator.companyName)).size, 2);
  const next = addDaysToDateString(travelDate, 1);
  assert.equal(
    (await routeDesk.trips(sharedRoute.id, { from: next, to: next })).items
      .length,
    1,
  );
  assert.equal(
    (await api(`/bus/admin/routes/${sharedRoute.id}`, { actor: buyer })).status,
    403,
  );
});

test("legacy company routes migrate into shared routes without changing bookings or issuing duplicate data", async () => {
  const before = await prisma.busBooking.findMany({
    select: { id: true, tripId: true, total: true, status: true },
    orderBy: { id: "asc" },
  });
  execFileSync(process.execPath, ["scripts/sqlite-push.js"], {
    env: process.env,
    stdio: "pipe",
  });
  assert.equal(await prisma.busRoute.count({ where: { corridorId: null } }), 0);
  const groups = await prisma.busCorridor.count();
  execFileSync(process.execPath, ["scripts/sqlite-push.js"], {
    env: process.env,
    stdio: "pipe",
  });
  assert.equal(await prisma.busCorridor.count(), groups);
  const after = await prisma.busBooking.findMany({
    select: { id: true, tripId: true, total: true, status: true },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(after, before);
});
