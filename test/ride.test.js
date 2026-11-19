import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/config/db.js";
import { RideService } from "../src/services/ride.service.js";

if (process.env.DATABASE_URL !== "file:/tmp/gabla-bus-managed-test.db")
  throw Error("Use the isolated fixture database (same one the bus tests use)");

const ride = new RideService();
// Each test gets its own zone, a whole degree (~111km) apart from every other zone - far beyond
// the ~4.9km reach of even the coarse geohash search - so a driver left behind by one test can
// never be mistaken for the nearest driver in another, whatever order tests run in.
const zone = (n) => ({ lat: 0.3476 + n, lng: 32.5825 + n });
const near = (base, offset) => ({ lat: base.lat + offset, lng: base.lng + offset });

async function makeUser(role = "user") {
  return prisma.user.create({
    data: { id: randomUUID(), name: `Test ${role} ${randomUUID().slice(0, 6)}`, phone: `07${Math.floor(Math.random() * 1e8)}`, role, passwordHash: "" }
  });
}

async function makeApprovedDriver(user, { lat, lng }) {
  const registered = await ride.registerDriver({
    actorUserId: user.id,
    vehicleType: "car",
    vehicleModel: "Toyota Premio",
    licensePlate: `UBX ${Math.floor(Math.random() * 999)}A`,
    licensePhotoUrl: "https://example.com/license.jpg",
    contact: { phone: user.phone }
  });
  await ride.adminSetDriverApproval({ driverId: registered.id, approved: true });
  await ride.setOnlineStatus({ actorUserId: user.id, isOnline: true });
  await ride.updateLocation({ actorUserId: user.id, lat, lng });
  return ride.getDriverForUser(user.id);
}

before(async () => {
  await ride.adminUpsertRideSettings({
    vehicleType: "car",
    baseFare: 1000,
    perKmRate: 500,
    perMinuteRate: 0,
    minimumFare: 0,
    commissionPercent: 20,
    roadDistanceMultiplier: 1,
    avgSpeedKmh: 30,
    isActive: true
  });
});

after(async () => prisma.$disconnect());

test("only car is an accepted vehicle type - boda is gone for good", async () => {
  assert.throws(() => ride.assertVehicleType("boda"), /Invalid vehicle type/);
  ride.assertVehicleType("car"); // does not throw
});

test("registering with anything other than car is rejected", async () => {
  const user = await makeUser();
  await assert.rejects(
    () => ride.registerDriver({ actorUserId: user.id, vehicleType: "boda", licensePhotoUrl: "https://x/y.jpg" }),
    /Invalid vehicle type/
  );
});

test("a ride request matches the nearest online, approved driver", async () => {
  const base = zone(1);
  const rider = await makeUser();
  const nearDriver = await makeApprovedDriver(await makeUser(), near(base, 0.001)); // ~150m away
  const farDriver = await makeApprovedDriver(await makeUser(), near(base, 0.08)); // ~9km away

  const pickup = { ...base, address: "Pickup" };
  const dropoff = { lat: base.lat + 0.05, lng: base.lng + 0.05, address: "Dropoff" };
  const trip = await ride.requestTrip({ actorUserId: rider.id, vehicleType: "car", pickup, dropoff, paymentMethod: "cash" });

  assert.equal(trip.status, "matched");
  assert.equal(trip.driverId, nearDriver.id, "should match the closer driver, not the farther one");
  assert.notEqual(trip.driverId, farDriver.id);

  await ride.cancelTrip({ actorUserId: rider.id, tripId: trip.id, reason: "test cleanup" });
});

test("confirm -> driver declines -> reassigned to the next nearest driver", async () => {
  const base = zone(2);
  const rider = await makeUser();
  const nearDriver = await makeApprovedDriver(await makeUser(), near(base, 0.001));
  const nextDriver = await makeApprovedDriver(await makeUser(), near(base, 0.01));

  const pickup = { ...base, address: "Pickup" };
  const dropoff = { lat: base.lat + 0.05, lng: base.lng + 0.05, address: "Dropoff" };
  const trip = await ride.requestTrip({ actorUserId: rider.id, vehicleType: "car", pickup, dropoff, paymentMethod: "cash" });
  assert.equal(trip.driverId, nearDriver.id);

  const confirmed = await ride.confirmMatch({ actorUserId: rider.id, tripId: trip.id });
  assert.ok(confirmed.riderConfirmedAt);
  assert.ok(confirmed.offerExpiresAt, "accepting a match should start the offer-expiry clock");

  const nearUser = await prisma.rideDriver.findUnique({ where: { id: nearDriver.id } });
  const declined = await ride.respondToTripOffer({ actorUserId: nearUser.userId, tripId: trip.id, accept: false });
  assert.equal(declined.status, "matched");
  assert.equal(declined.driverId, nextDriver.id, "declining should hand the trip to the next-nearest driver");
  assert.ok(declined.offerExpiresAt, "the new driver should get a fresh offer window");

  await ride.cancelTrip({ actorUserId: rider.id, tripId: trip.id, reason: "test cleanup" });
});

test("an offer nobody answers in time is auto-passed to the next driver", async () => {
  const base = zone(3);
  const rider = await makeUser();
  const silent = await makeApprovedDriver(await makeUser(), near(base, 0.001));
  const backup = await makeApprovedDriver(await makeUser(), near(base, 0.01));

  const pickup = { ...base, address: "Pickup" };
  const dropoff = { lat: base.lat + 0.05, lng: base.lng + 0.05, address: "Dropoff" };
  const trip = await ride.requestTrip({ actorUserId: rider.id, vehicleType: "car", pickup, dropoff, paymentMethod: "cash" });
  assert.equal(trip.driverId, silent.id);

  await ride.confirmMatch({ actorUserId: rider.id, tripId: trip.id });

  // Simulate the offer having already expired, instead of sleeping 20s in a test.
  await prisma.rideTrip.update({ where: { id: trip.id }, data: { offerExpiresAt: new Date(Date.now() - 1000) } });

  await ride.expireStaleOffers();

  const after1 = await prisma.rideTrip.findUnique({ where: { id: trip.id } });
  assert.equal(after1.status, "matched");
  assert.equal(after1.driverId, backup.id, "the silent driver's offer should have been passed on");
  assert.ok(after1.metadata?.declinedDriverIds?.includes(silent.id));

  // A trip that isn't actually stale yet must be left alone.
  await prisma.rideTrip.update({ where: { id: trip.id }, data: { offerExpiresAt: new Date(Date.now() + 60_000) } });
  await ride.expireStaleOffers();
  const after2 = await prisma.rideTrip.findUnique({ where: { id: trip.id } });
  assert.equal(after2.driverId, backup.id, "a fresh offer must not be touched by the sweep");

  await ride.cancelTrip({ actorUserId: rider.id, tripId: trip.id, reason: "test cleanup" });
});

test("full trip lifecycle pays the driver their earning, minus the platform fee", async () => {
  const base = zone(4);
  const rider = await makeUser();
  const user = await makeUser();
  await makeApprovedDriver(user, near(base, 0.001));

  const pickup = { ...base, address: "Pickup" };
  const dropoff = { lat: base.lat + 0.05, lng: base.lng + 0.05, address: "Dropoff" };
  const trip = await ride.requestTrip({ actorUserId: rider.id, vehicleType: "car", pickup, dropoff, paymentMethod: "cash" });
  await ride.confirmMatch({ actorUserId: rider.id, tripId: trip.id });
  await ride.respondToTripOffer({ actorUserId: user.id, tripId: trip.id, accept: true });
  await ride.updateTripStatus({ actorUserId: user.id, tripId: trip.id, status: "arrived" });
  await ride.updateTripStatus({ actorUserId: user.id, tripId: trip.id, status: "in_progress" });
  const completed = await ride.updateTripStatus({ actorUserId: user.id, tripId: trip.id, status: "completed" });

  assert.equal(completed.status, "completed");
  // Cash changes hands in person - nothing is charged and, by deliberate design (see
  // RideService#completeTrip), a cash trip never touches the driver's platform wallet. Earning
  // and fee are still recorded for reporting even though no money actually moved through Gabla.
  assert.equal(completed.paymentStatus, "succeeded");
  const fare = Number(completed.finalFare);
  const earning = Number(completed.driverEarning);
  const fee = Number(completed.platformFee);
  assert.ok(fare > 0);
  assert.ok(Math.abs(earning + fee - fare) < 0.01, "driver earning + platform fee should add up to the fare");
});
