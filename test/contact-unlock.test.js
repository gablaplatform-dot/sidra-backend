import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/db.js";
import { PaymentService } from "../src/services/payment.service.js";
import { ProviderService } from "../src/services/provider.service.js";
import { ListingService } from "../src/services/listing.service.js";
import { ServiceBookingService } from "../src/services/serviceBooking.service.js";
import { todayEat, addDaysToDateString } from "../src/utils/busTime.js";

if (process.env.DATABASE_URL !== "file:/tmp/gabla-contact-unlock-test.db")
  throw Error("Use isolated contact-unlock fixture database");

const key = `cu-${Date.now()}`;
const deposits = [];
const payment = new PaymentService({
  mobileMoneyService: {
    async initiateDeposit(p) {
      deposits.push(p);
    }
  }
});
const providerService = new ProviderService({ hashPassword: () => "", paymentService: payment });
const listingService = new ListingService();
const bookingService = new ServiceBookingService({
  emailService: async () => ({ sent: true, deliveryStatus: "sent" }),
  pushService: { sendToUser: async () => {} }
});

let customer, providerUser, provider, category, settings;

const setFee = (enableContactFee, contactFee) =>
  prisma.adminSettings.update({ where: { id: settings.id }, data: { enableContactFee, contactFee } });

before(async () => {
  settings = await prisma.adminSettings.create({ data: { enableContactFee: true, contactFee: 0 } });
  customer = await prisma.user.create({ data: { name: "Fixture Customer", email: `${key}-cust@example.com`, role: "user" } });
  providerUser = await prisma.user.create({ data: { name: "Fixture Provider", email: `${key}-prov@example.com`, role: "provider" } });
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
      onlinePaymentsEnabled: true,
      contact: { phone: "0772000000", whatsapp: "0772000000", email: "spa@example.com" },
      location: { address: "Plot 1, Kampala Rd", city: "Kampala", geo: { type: "Point", coordinates: [32.58, 0.31] } }
    }
  });
});

beforeEach(async () => {
  await prisma.contactUnlock.deleteMany({ where: { providerId: provider.id } });
});

after(async () => {
  await prisma.serviceBooking.deleteMany({ where: { providerId: provider.id } });
  await prisma.serviceProduct.deleteMany({ where: { providerId: provider.id } });
  await prisma.contactUnlock.deleteMany({ where: { providerId: provider.id } });
  await prisma.provider.deleteMany({ where: { id: provider.id } });
  await prisma.category.deleteMany({ where: { id: category.id } });
  await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
  await prisma.user.deleteMany({ where: { id: { in: [customer.id, providerUser.id] } } });
  await prisma.adminSettings.deleteMany({ where: { id: settings.id } });
});

test("the exact launch-audit bug: fee enabled but left at 0 unlocks for free instead of failing", async () => {
  await setFee(true, 0);
  const result = await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id });
  assert.equal(result.free, true);
  const unlock = await prisma.contactUnlock.findUnique({ where: { userId_providerId: { userId: customer.id, providerId: provider.id } } });
  assert.equal(unlock.paid, true);
});

test("fee feature switched off entirely also unlocks for free, not instantly/invisibly", async () => {
  await setFee(false, 5000);
  const result = await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id });
  assert.equal(result.free, true);
  assert.match(result.message, /bonus/i);
});

test("a real configured fee still goes through the paid mobile-money flow, unchanged", async () => {
  await setFee(true, 5000);
  deposits.length = 0;
  const result = await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id, phone: "0772000111" });
  assert.equal(result.status, "pending");
  assert.equal(result.free, undefined);
  assert.equal(deposits.length, 1, "should have initiated a real mobile money deposit");
  const unlock = await prisma.contactUnlock.findUnique({ where: { userId_providerId: { userId: customer.id, providerId: provider.id } } });
  assert.equal(unlock.paid, false, "not unlocked until the webhook confirms payment");
});

test("already-unlocked (free or paid) is rejected the same way either path got there", async () => {
  await setFee(true, 0);
  await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id });
  await assert.rejects(
    payment.unlockContact({ actorUserId: customer.id, providerId: provider.id }),
    (e) => e.code === "ALREADY_UNLOCKED"
  );
});

test("provider profile always reports contact as locked for the public view, regardless of the fee toggle", async () => {
  await setFee(false, 0);
  const profile = await providerService.getProviderProfile({ providerId: provider.id });
  assert.equal(profile.contactLocked, true);
  assert.equal(profile.contact.phone, null);
  assert.equal(profile.contactUnlockFree, true);

  await setFee(true, 5000);
  const profile2 = await providerService.getProviderProfile({ providerId: provider.id });
  assert.equal(profile2.contactLocked, true);
  assert.equal(profile2.contactUnlockFree, false);

  // The provider's own/admin view of their own (possibly unapproved) listing is never locked.
  const own = await providerService.getProviderProfile({ providerId: provider.id, includeUnapproved: true });
  assert.equal(own.contactLocked, false);
  assert.equal(own.contact.phone, "0772000000");
});

test("getProviderContactForUser requires an unlock even when the fee feature is off", async () => {
  await setFee(false, 0);
  await assert.rejects(
    providerService.getProviderContactForUser({ actorUserId: customer.id, providerId: provider.id }),
    (e) => e.code === "CONTACT_LOCKED"
  );
  await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id });
  const result = await providerService.getProviderContactForUser({ actorUserId: customer.id, providerId: provider.id });
  assert.equal(result.contact.phone, "0772000000");
});

test("an instant service booking no longer leaks the provider's real contact for free", async () => {
  await setFee(true, 5000);
  const listing = await listingService.createListing({
    actorUserId: providerUser.id,
    name: `${key}-listing`,
    description: "Fixture service",
    price: 20000,
    serviceCategoryId: category.id,
    type: "service",
    bookingMode: "instant",
    booking: { unit: "day", advanceDays: 60 }
  });
  const date = addDaysToDateString(todayEat(), 3);
  const booking = await bookingService.create({
    userId: customer.id,
    input: { listingId: listing.id, startDate: date, endDate: addDaysToDateString(date, 1), customer: { name: "Jane Guest", phone: "0772000111" } }
  });
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.contact, null, "contact must not leak before the customer unlocks it");
  assert.equal(booking.contactLocked, true);

  await setFee(false, 0);
  await payment.unlockContact({ actorUserId: customer.id, providerId: provider.id });
  const mine = await bookingService.listMine(customer.id);
  const sameBooking = mine.items.find((b) => b.id === booking.id);
  assert.equal(sameBooking.contactLocked, false);
  assert.equal(sameBooking.contact.phone, "0772000000");
});
