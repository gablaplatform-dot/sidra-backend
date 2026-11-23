import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/db.js";
import { ListingService } from "../src/services/listing.service.js";
import { ServiceBookingService, normalizeServiceItems, normalizeBookingConfig } from "../src/services/serviceBooking.service.js";
import { todayEat, addDaysToDateString, weekdayOf } from "../src/utils/busTime.js";

if (process.env.DATABASE_URL !== "file:/tmp/gabla-services-test.db")
  throw Error("Use isolated service-booking fixture database");

const key = `svc-${Date.now()}`;
const listingService = new ListingService();
const bookingService = new ServiceBookingService({});

let customer, providerUser, provider, category;

// The next date that falls on `weekday` (0 = Sunday), at least 2 days out so lead-time/advance
// checks never get in the way.
function nextWeekday(weekday) {
  let d = addDaysToDateString(todayEat(), 2);
  while (weekdayOf(d) !== weekday) d = addDaysToDateString(d, 1);
  return d;
}

before(async () => {
  customer = await prisma.user.create({ data: { name: "Fixture Customer", email: `${key}-cust@example.com`, role: "user" } });
  providerUser = await prisma.user.create({ data: { name: "Fixture Provider", email: `${key}-prov@example.com`, role: "provider" } });
  // assertServiceCategory (listing.service.js) checks the id against BOTH the ServiceCategory
  // table and the directory Category tree, so the fixture category needs a row in each, sharing
  // one id - flagged to the user as a likely pre-existing mismatch, not something this task fixes.
  const categoryId = `${key}-category`;
  category = await prisma.category.create({ data: { id: categoryId, name: `${key}-category`, taxonomyKind: "service" } });
  await prisma.serviceCategory.create({ data: { id: categoryId, name: `${key}-category` } });
  provider = await prisma.provider.create({
    data: {
      userId: providerUser.id,
      businessName: "Fixture Spa",
      categoryId: category.id,
      isApproved: true,
      moderationStatus: "approved",
      onlinePaymentsEnabled: true
    }
  });
});

after(async () => {
  await prisma.serviceBooking.deleteMany({ where: { providerId: provider.id } });
  await prisma.serviceProduct.deleteMany({ where: { providerId: provider.id } });
  await prisma.provider.deleteMany({ where: { id: provider.id } });
  await prisma.category.deleteMany({ where: { id: category.id } });
  await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
  await prisma.user.deleteMany({ where: { id: { in: [customer.id, providerUser.id] } } });
});

async function makeListing({ unit, daysOfWeek, slotMinutes = 30, items, bookingMode = "instant", capacity = 1 } = {}) {
  return listingService.createListing({
    actorUserId: providerUser.id,
    name: `${key}-listing-${Math.random().toString(36).slice(2, 7)}`,
    description: "Fixture service",
    price: 20000,
    serviceCategoryId: category.id,
    type: "service",
    bookingMode,
    booking: { unit, daysOfWeek, slotMinutes, capacity, openFrom: "09:00", openTo: "11:00", advanceDays: 60 },
    items
  });
}

test("normalizeServiceItems keeps included and priced items, drops unnamed ones", () => {
  const items = normalizeServiceItems([
    { name: "Tents", price: null },
    { name: "Catering", price: 150000, required: true },
    { name: "  " },
    { price: 5000 }
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { name: "Tents", price: null, required: false });
  assert.deepEqual(items[1], { name: "Catering", price: 150000, required: true });
});

test("normalizeBookingConfig defaults appointment daysOfWeek to every day and bounds slotMinutes", () => {
  const cfg = normalizeBookingConfig({ unit: "appointment" });
  assert.deepEqual(cfg.daysOfWeek, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(cfg.slotMinutes, 30);
  const cfg2 = normalizeBookingConfig({ unit: "appointment", daysOfWeek: [2, 2, 9, "4"], slotMinutes: 1000 });
  assert.deepEqual(cfg2.daysOfWeek, [2, 4]);
  assert.equal(cfg2.slotMinutes, 240);
});

test("appointment availability only opens the configured weekday, in slotMinutes steps", async () => {
  const tuesday = nextWeekday(2);
  const monday = nextWeekday(1);
  const listing = await makeListing({ unit: "appointment", daysOfWeek: [2], slotMinutes: 30 });

  const onDay = await bookingService.availability({ listingId: listing.id, date: tuesday });
  assert.deepEqual(onDay.slots.map((s) => s.time), ["09:00", "09:30", "10:00", "10:30"]);
  assert.ok(onDay.days[tuesday].free > 0 && !onDay.days[tuesday].blocked);

  const offDay = await bookingService.availability({ listingId: listing.id, date: monday });
  assert.equal(offDay.days[monday].blocked, true);
});

test("booking an appointment slot: wrong weekday and off-slot times are rejected, capacity is enforced", async () => {
  const tuesday = nextWeekday(2);
  const monday = nextWeekday(1);
  const listing = await makeListing({ unit: "appointment", daysOfWeek: [2], slotMinutes: 30, capacity: 1 });
  const customerInput = { name: "Jane Guest", phone: "0772000111" };

  await assert.rejects(
    bookingService.create({ userId: customer.id, input: { listingId: listing.id, startDate: monday, startTime: "09:30", customer: customerInput } }),
    (e) => e.code === "DAY_CLOSED"
  );
  await assert.rejects(
    bookingService.create({ userId: customer.id, input: { listingId: listing.id, startDate: tuesday, startTime: "09:15", customer: customerInput } }),
    (e) => e.code === "INVALID_TIME"
  );

  const booking = await bookingService.create({ userId: customer.id, input: { listingId: listing.id, startDate: tuesday, startTime: "09:30", customer: customerInput } });
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.startTime, "09:30");
  assert.equal(booking.endTime, "10:00");

  await assert.rejects(
    bookingService.create({ userId: customer.id, input: { listingId: listing.id, startDate: tuesday, startTime: "09:30", customer: customerInput } }),
    (e) => e.code === "NOT_AVAILABLE"
  );
});

test("selected add-ons are priced into the total; required add-ons are always included", async () => {
  const tuesday = nextWeekday(2);
  const listing = await makeListing({
    unit: "appointment",
    daysOfWeek: [2],
    slotMinutes: 30,
    items: [
      { name: "Hot towel treatment", price: 5000 },
      { name: "Hair wash", price: null, required: true }
    ]
  });
  assert.deepEqual(listing.items, [
    { name: "Hot towel treatment", price: 5000, required: false },
    { name: "Hair wash", price: null, required: true }
  ]);

  const booking = await bookingService.create({
    userId: customer.id,
    input: { listingId: listing.id, startDate: tuesday, startTime: "10:00", items: ["Hot towel treatment"], customer: { name: "Jane Guest", phone: "0772000111" } }
  });
  assert.equal(booking.total, 20000 + 5000);
  assert.deepEqual(
    booking.items.sort((a, b) => a.name.localeCompare(b.name)),
    [{ name: "Hair wash", price: null }, { name: "Hot towel treatment", price: 5000 }]
  );

  const unselected = await bookingService.create({
    userId: customer.id,
    input: { listingId: listing.id, startDate: tuesday, startTime: "10:30", items: [], customer: { name: "Jane Guest", phone: "0772000111" } }
  });
  assert.equal(unselected.total, 20000);
  assert.deepEqual(unselected.items, [{ name: "Hair wash", price: null }]);
});

test("flexible hourly booking (unaffected by the appointment changes) still books a multi-hour slot", async () => {
  const listing = await makeListing({ unit: "hour", capacity: 3 });
  const date = addDaysToDateString(todayEat(), 3);
  const booking = await bookingService.create({
    userId: customer.id,
    input: { listingId: listing.id, startDate: date, startTime: "09:00", hours: 2, customer: { name: "Jane Guest", phone: "0772000111" } }
  });
  assert.equal(booking.units, 2);
  assert.equal(booking.total, 20000 * 2);
});

test("provider can approve a pending appointment request", async () => {
  const tuesday = nextWeekday(2);
  const listing = await makeListing({ unit: "appointment", daysOfWeek: [2], bookingMode: "request" });
  const booking = await bookingService.create({
    userId: customer.id,
    input: { listingId: listing.id, startDate: tuesday, startTime: "09:00", customer: { name: "Jane Guest", phone: "0772000111" } }
  });
  assert.equal(booking.status, "pending");
  const responded = await bookingService.respond({ userId: providerUser.id, id: booking.id, action: "accept" });
  assert.equal(responded.status, "confirmed");
});
