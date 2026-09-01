import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { parseMoneyToCents, centsToDecimal, feeFromPercentCents } from "../utils/money.js";
import { geohashEncode, geohashSearchCells, haversineDistanceKm } from "../utils/geohash.js";
import { RideDriverWalletService } from "./rideDriverWallet.service.js";
import { MobileMoneyService } from "./mobileMoney.service.js";

const VEHICLE_TYPES = ["boda", "car"];
const GEOHASH_PRECISION_FINE = 6; // ~1.2km x 0.6km cells - the primary search
const GEOHASH_PRECISION_COARSE = 5; // ~4.9km x 4.9km cells - fallback if the fine search is empty

const decToString = (v) => (v ? v.toString() : "0.00");

const tripDto = (trip) => ({
  id: trip.id,
  riderId: trip.riderId,
  driverId: trip.driverId,
  vehicleType: trip.vehicleType,
  status: trip.status,
  pickup: { lat: trip.pickupLat, lng: trip.pickupLng, address: trip.pickupAddress },
  dropoff: { lat: trip.dropoffLat, lng: trip.dropoffLng, address: trip.dropoffAddress },
  estimatedDistanceKm: trip.estimatedDistanceKm,
  estimatedDurationMin: trip.estimatedDurationMin,
  estimatedFare: decToString(trip.estimatedFare),
  finalFare: decToString(trip.finalFare),
  driverEarning: decToString(trip.driverEarning),
  platformFee: decToString(trip.platformFee),
  paymentMethod: trip.paymentMethod,
  paymentStatus: trip.paymentStatus,
  requestedAt: trip.requestedAt,
  matchedAt: trip.matchedAt,
  arrivedAt: trip.arrivedAt,
  startedAt: trip.startedAt,
  completedAt: trip.completedAt,
  cancelledAt: trip.cancelledAt,
  cancelReason: trip.cancelReason,
  riderRating: trip.riderRating,
  driverRating: trip.driverRating,
  createdAt: trip.createdAt,
  updatedAt: trip.updatedAt
});

const driverDto = (driver) => ({
  id: driver.id,
  userId: driver.userId,
  vehicleType: driver.vehicleType,
  vehicleModel: driver.vehicleModel,
  licensePlate: driver.licensePlate,
  isApproved: driver.isApproved,
  moderationStatus: driver.moderationStatus,
  isOnline: driver.isOnline,
  lat: driver.lat,
  lng: driver.lng,
  lastLocationAt: driver.lastLocationAt,
  ratingAvg: driver.ratingAvg,
  ratingCount: driver.ratingCount,
  contact: driver.contact,
  createdAt: driver.createdAt,
  updatedAt: driver.updatedAt
});

export class RideService {
  constructor({
    rideDriverWalletService = new RideDriverWalletService(),
    mobileMoneyService = new MobileMoneyService()
  } = {}) {
    this.rideDriverWalletService = rideDriverWalletService;
    this.mobileMoneyService = mobileMoneyService;
  }

  mobileMoneyCallbackUrls() {
    return {
      successUrl: `${env.apiBaseUrl}/api/v1/payments/webhooks/mobilemoney/success`,
      failedUrl: `${env.apiBaseUrl}/api/v1/payments/webhooks/mobilemoney/failed`
    };
  }

  assertVehicleType(vehicleType) {
    if (!VEHICLE_TYPES.includes(vehicleType)) {
      throw new AppError({ message: "Invalid vehicle type", statusCode: 400, code: "INVALID_VEHICLE_TYPE" });
    }
  }

  async getDriverForUser(userId) {
    const driver = await prisma.rideDriver.findUnique({ where: { userId } });
    if (!driver) {
      throw new AppError({ message: "Driver profile not found", statusCode: 404, code: "DRIVER_NOT_FOUND" });
    }
    return driver;
  }

  async getRideSettings(vehicleType, session) {
    const tx = session ?? prisma;
    const settings = await tx.rideSettings.findUnique({ where: { vehicleType } });
    if (!settings || !settings.isActive) {
      throw new AppError({ message: "This ride type isn't available right now", statusCode: 400, code: "VEHICLE_TYPE_DISABLED" });
    }
    return settings;
  }

  // --- Driver management --------------------------------------------------------

  async registerDriver({ actorUserId, vehicleType, vehicleModel, licensePlate, contact }) {
    this.assertVehicleType(vehicleType);
    const existing = await prisma.rideDriver.findUnique({ where: { userId: actorUserId } });
    if (existing) {
      throw new AppError({ message: "You already have a driver profile", statusCode: 409, code: "DRIVER_ALREADY_EXISTS" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const driver = await tx.rideDriver.create({
        data: {
          userId: actorUserId,
          vehicleType,
          vehicleModel: vehicleModel ?? null,
          licensePlate: licensePlate ?? null,
          contact: contact ?? {},
          moderationStatus: "pending",
          isApproved: false
        }
      });
      await tx.user.update({ where: { id: actorUserId }, data: { role: "driver" } });
      return driver;
    });

    return driverDto(created);
  }

  async getMyDriverProfile({ actorUserId }) {
    return driverDto(await this.getDriverForUser(actorUserId));
  }

  async updateMyDriverProfile({ actorUserId, updates }) {
    const driver = await this.getDriverForUser(actorUserId);
    const data = {};
    if (updates.vehicleModel !== undefined) data.vehicleModel = updates.vehicleModel;
    if (updates.licensePlate !== undefined) data.licensePlate = updates.licensePlate;
    if (updates.contact !== undefined) data.contact = updates.contact ?? {};
    if (updates.vehicleType !== undefined) {
      this.assertVehicleType(updates.vehicleType);
      data.vehicleType = updates.vehicleType;
    }
    const updated = await prisma.rideDriver.update({ where: { id: driver.id }, data });
    return driverDto(updated);
  }

  async setOnlineStatus({ actorUserId, isOnline }) {
    const driver = await this.getDriverForUser(actorUserId);
    if (isOnline && (!driver.isApproved || driver.moderationStatus !== "approved")) {
      throw new AppError({ message: "Your driver account isn't approved yet", statusCode: 403, code: "DRIVER_NOT_APPROVED" });
    }
    const updated = await prisma.rideDriver.update({ where: { id: driver.id }, data: { isOnline: Boolean(isOnline) } });
    return driverDto(updated);
  }

  async updateLocation({ actorUserId, lat, lng }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new AppError({ message: "Invalid coordinates", statusCode: 400, code: "INVALID_COORDINATES" });
    }
    const driver = await this.getDriverForUser(actorUserId);
    const updated = await prisma.rideDriver.update({
      where: { id: driver.id },
      data: {
        lat,
        lng,
        geohash5: geohashEncode(lat, lng, GEOHASH_PRECISION_COARSE),
        geohash6: geohashEncode(lat, lng, GEOHASH_PRECISION_FINE),
        lastLocationAt: new Date()
      }
    });
    return driverDto(updated);
  }

  // --- Matching ------------------------------------------------------------------

  // Never compares against every driver: queries only the geohash cells around the pickup
  // point (an indexed lookup), computes exact distance for just that small candidate set, and
  // only widens to a coarser grid if the fine one comes up empty. See src/utils/geohash.js.
  async findNearestDriver({ lat, lng, vehicleType, excludeDriverIds = [] }) {
    const tryPrecision = async (precision) => {
      const cells = geohashSearchCells(lat, lng, precision);
      const geohashField = precision === GEOHASH_PRECISION_FINE ? "geohash6" : "geohash5";
      const candidates = await prisma.rideDriver.findMany({
        where: {
          isOnline: true,
          vehicleType,
          isApproved: true,
          moderationStatus: "approved",
          [geohashField]: { in: cells },
          id: excludeDriverIds.length ? { notIn: excludeDriverIds } : undefined,
          lat: { not: null },
          lng: { not: null }
        },
        take: 50
      });
      if (!candidates.length) return null;

      let nearest = null;
      let nearestDistance = Infinity;
      for (const candidate of candidates) {
        const distance = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      return { driver: nearest, distanceKm: nearestDistance };
    };

    return (await tryPrecision(GEOHASH_PRECISION_FINE)) ?? (await tryPrecision(GEOHASH_PRECISION_COARSE));
  }

  // --- Fare estimation -------------------------------------------------------------

  async estimateFare({ vehicleType, pickup, dropoff }) {
    this.assertVehicleType(vehicleType);
    const settings = await this.getRideSettings(vehicleType);
    const straightLineKm = haversineDistanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const distanceKm = straightLineKm * settings.roadDistanceMultiplier;
    const durationMin = (distanceKm / settings.avgSpeedKmh) * 60;

    const baseCents = parseMoneyToCents(settings.baseFare);
    const perKmCents = parseMoneyToCents(settings.perKmRate);
    const perMinCents = parseMoneyToCents(settings.perMinuteRate);
    const minimumCents = parseMoneyToCents(settings.minimumFare);

    const distanceCentsRaw = BigInt(Math.round(distanceKm * 100)) * perKmCents / 100n;
    const durationCentsRaw = BigInt(Math.round(durationMin * 100)) * perMinCents / 100n;
    let fareCents = baseCents + distanceCentsRaw + durationCentsRaw;
    if (fareCents < minimumCents) fareCents = minimumCents;

    return {
      distanceKm,
      durationMin,
      fare: centsToDecimal(fareCents).toString()
    };
  }

  // --- Trip lifecycle -------------------------------------------------------------

  async requestTrip({ actorUserId, vehicleType, pickup, dropoff, paymentMethod = "cash", phone }) {
    this.assertVehicleType(vehicleType);
    if (!["cash", "mobile_money"].includes(paymentMethod)) {
      throw new AppError({ message: "Invalid payment method", statusCode: 400, code: "INVALID_PAYMENT_METHOD" });
    }
    if (paymentMethod === "mobile_money" && !phone) {
      throw new AppError({ message: "A phone number is required to pay by mobile money", statusCode: 400, code: "PHONE_REQUIRED" });
    }
    for (const point of [pickup, dropoff]) {
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        throw new AppError({ message: "Invalid pickup/dropoff location", statusCode: 400, code: "INVALID_LOCATION" });
      }
    }

    const activeTrip = await prisma.rideTrip.findFirst({
      where: { riderId: actorUserId, status: { in: ["searching", "matched", "arrived", "in_progress"] } }
    });
    if (activeTrip) {
      throw new AppError({ message: "You already have an active ride", statusCode: 409, code: "ACTIVE_TRIP_EXISTS", details: { tripId: activeTrip.id } });
    }

    const estimate = await this.estimateFare({ vehicleType, pickup, dropoff });
    const match = await this.findNearestDriver({ lat: pickup.lat, lng: pickup.lng, vehicleType });

    const trip = await prisma.rideTrip.create({
      data: {
        riderId: actorUserId,
        driverId: match?.driver?.id ?? null,
        vehicleType,
        status: match ? "matched" : "no_drivers_found",
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address ?? "",
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: dropoff.address ?? "",
        estimatedDistanceKm: estimate.distanceKm,
        estimatedDurationMin: estimate.durationMin,
        estimatedFare: estimate.fare,
        paymentMethod,
        matchedAt: match ? new Date() : null,
        metadata: paymentMethod === "mobile_money" ? { riderPhone: phone } : {}
      }
    });

    return tripDto(trip);
  }

  async getTripStatus({ actorUserId, tripId }) {
    const trip = await prisma.rideTrip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
    }
    const driver = trip.driverId ? await prisma.rideDriver.findUnique({ where: { id: trip.driverId } }) : null;
    const isRider = trip.riderId === actorUserId;
    const isAssignedDriver = driver && driver.userId === actorUserId;
    if (!isRider && !isAssignedDriver) {
      throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
    }
    return { ...tripDto(trip), driver: driver ? { id: driver.id, vehicleModel: driver.vehicleModel, licensePlate: driver.licensePlate, lat: driver.lat, lng: driver.lng, ratingAvg: driver.ratingAvg, contact: driver.contact } : null };
  }

  async listMyTripsAsRider({ actorUserId, limit = 20 }) {
    const trips = await prisma.rideTrip.findMany({ where: { riderId: actorUserId }, orderBy: { createdAt: "desc" }, take: Math.min(100, limit) });
    return { items: trips.map(tripDto) };
  }

  async listMyTripsAsDriver({ actorUserId, limit = 20 }) {
    const driver = await this.getDriverForUser(actorUserId);
    const trips = await prisma.rideTrip.findMany({ where: { driverId: driver.id }, orderBy: { createdAt: "desc" }, take: Math.min(100, limit) });
    return { items: trips.map(tripDto) };
  }

  // A driver declining a match reassigns to the next-nearest available driver (excluding
  // everyone who has already declined this specific trip), rather than forcing the rider to
  // start over.
  async respondToTripOffer({ actorUserId, tripId, accept }) {
    const driver = await this.getDriverForUser(actorUserId);
    return prisma.$transaction(async (tx) => {
      const trip = await tx.rideTrip.findUnique({ where: { id: tripId } });
      if (!trip || trip.driverId !== driver.id) {
        throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
      }
      if (trip.status !== "matched") {
        throw new AppError({ message: "This trip is no longer awaiting a response", statusCode: 409, code: "INVALID_TRIP_STATE" });
      }

      if (accept) {
        return tripDto(trip);
      }

      const declinedIds = [...(trip.metadata?.declinedDriverIds ?? []), driver.id];
      const match = await this.findNearestDriver({ lat: trip.pickupLat, lng: trip.pickupLng, vehicleType: trip.vehicleType, excludeDriverIds: declinedIds });

      const updated = await tx.rideTrip.update({
        where: { id: tripId },
        data: {
          driverId: match?.driver?.id ?? null,
          status: match ? "matched" : "no_drivers_found",
          matchedAt: match ? new Date() : trip.matchedAt,
          metadata: { ...(trip.metadata ?? {}), declinedDriverIds: declinedIds }
        }
      });
      return tripDto(updated);
    });
  }

  async updateTripStatus({ actorUserId, tripId, status }) {
    const driver = await this.getDriverForUser(actorUserId);
    const trip = await prisma.rideTrip.findUnique({ where: { id: tripId } });
    if (!trip || trip.driverId !== driver.id) {
      throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
    }

    const VALID_TRANSITIONS = { matched: "arrived", arrived: "in_progress", in_progress: "completed" };
    if (VALID_TRANSITIONS[trip.status] !== status) {
      throw new AppError({ message: `Cannot move a trip from "${trip.status}" to "${status}"`, statusCode: 409, code: "INVALID_TRIP_STATE" });
    }

    if (status === "completed") {
      return this.completeTrip({ trip });
    }

    const timestampField = { arrived: "arrivedAt", in_progress: "startedAt" }[status];
    const updated = await prisma.rideTrip.update({ where: { id: tripId }, data: { status, [timestampField]: new Date() } });
    return tripDto(updated);
  }

  async completeTrip({ trip }) {
    const settings = await this.getRideSettings(trip.vehicleType);
    const fareCents = parseMoneyToCents(trip.estimatedFare);
    const feeCents = feeFromPercentCents({ amountCents: fareCents, percent: settings.commissionPercent });
    const netCents = fareCents - feeCents;

    const finalFare = centsToDecimal(fareCents);
    const platformFee = centsToDecimal(feeCents);
    const driverEarning = centsToDecimal(netCents);

    if (trip.paymentMethod === "cash") {
      // Cash changes hands in person - nothing to charge, and (for now) no platform-commission
      // ledger for cash trips; that's a real gap worth solving later, tracked deliberately as a
      // simplification rather than half-built here.
      const updated = await prisma.rideTrip.update({
        where: { id: trip.id },
        data: { status: "completed", completedAt: new Date(), finalFare, platformFee, driverEarning, paymentStatus: "succeeded" }
      });
      return tripDto(updated);
    }

    // mobile_money: charge the rider now for the final fare, matching the exact pending-then-
    // webhook-confirms pattern already proven for contact unlocks/purchases - the driver's
    // wallet is only credited once handleMobileMoneySuccess sees the deposit actually succeed.
    const phone = trip.metadata?.riderPhone;
    if (!phone) {
      throw new AppError({ message: "No payment phone number on file for this trip", statusCode: 400, code: "PHONE_REQUIRED" });
    }

    const { transactionId, reference } = await prisma.$transaction(async (tx) => {
      const reference = `ride-${trip.id}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "ride_trip",
          userId: trip.riderId,
          providerId: null,
          amount: finalFare,
          fee: platformFee,
          netAmount: driverEarning,
          status: "pending",
          reference,
          metadata: { tripId: trip.id, phone }
        }
      });
      await tx.rideTrip.update({
        where: { id: trip.id },
        data: { status: "completed", completedAt: new Date(), finalFare, platformFee, driverEarning, paymentStatus: "pending", transactionId: transaction.id }
      });
      return { transactionId: transaction.id, reference };
    });

    try {
      await this.mobileMoneyService.initiateDeposit({ amount: finalFare, phone, reference, ...this.mobileMoneyCallbackUrls() });
    } catch (gatewayError) {
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: transactionId }, data: { status: "failed" } }),
        prisma.rideTrip.update({ where: { id: trip.id }, data: { paymentStatus: "failed" } })
      ]);
      throw gatewayError;
    }

    const updated = await prisma.rideTrip.findUnique({ where: { id: trip.id } });
    return tripDto(updated);
  }

  async cancelTrip({ actorUserId, tripId, reason }) {
    const trip = await prisma.rideTrip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
    }
    const isRider = trip.riderId === actorUserId;
    const driver = trip.driverId ? await prisma.rideDriver.findUnique({ where: { id: trip.driverId } }) : null;
    const isAssignedDriver = driver && driver.userId === actorUserId;
    if (!isRider && !isAssignedDriver) {
      throw new AppError({ message: "Trip not found", statusCode: 404, code: "TRIP_NOT_FOUND" });
    }
    if (!["searching", "matched", "arrived"].includes(trip.status)) {
      throw new AppError({ message: "This trip can no longer be cancelled", statusCode: 409, code: "INVALID_TRIP_STATE" });
    }

    const updated = await prisma.rideTrip.update({
      where: { id: tripId },
      data: {
        status: isRider ? "cancelled_by_rider" : "cancelled_by_driver",
        cancelledAt: new Date(),
        cancelReason: reason ?? null
      }
    });
    return tripDto(updated);
  }

  // --- Driver wallet / admin -------------------------------------------------------

  async getMyRideWallet({ actorUserId }) {
    const driver = await this.getDriverForUser(actorUserId);
    return this.rideDriverWalletService.getBalance({ rideDriverId: driver.id });
  }

  async adminListDrivers({ moderationStatus, page = 1, limit = 50 }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = moderationStatus ? { moderationStatus } : {};
    const [items, total] = await Promise.all([
      prisma.rideDriver.findMany({ where, orderBy: { createdAt: "desc" }, skip: (normalizedPage - 1) * normalizedLimit, take: normalizedLimit }),
      prisma.rideDriver.count({ where })
    ]);
    return { items: items.map(driverDto), page: normalizedPage, limit: normalizedLimit, total };
  }

  async adminSetDriverApproval({ driverId, approved }) {
    const updated = await prisma.rideDriver.update({
      where: { id: driverId },
      data: { isApproved: Boolean(approved), moderationStatus: approved ? "approved" : "rejected" }
    });
    return driverDto(updated);
  }

  async adminListTrips({ status, page = 1, limit = 50 }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.rideTrip.findMany({ where, orderBy: { createdAt: "desc" }, skip: (normalizedPage - 1) * normalizedLimit, take: normalizedLimit }),
      prisma.rideTrip.count({ where })
    ]);
    return { items: items.map(tripDto), page: normalizedPage, limit: normalizedLimit, total };
  }

  async getRideSettingsList() {
    const settings = await prisma.rideSettings.findMany();
    return { items: settings };
  }

  async adminUpsertRideSettings({ vehicleType, baseFare, perKmRate, perMinuteRate, minimumFare, commissionPercent, roadDistanceMultiplier, avgSpeedKmh, isActive }) {
    this.assertVehicleType(vehicleType);
    const data = {};
    if (baseFare !== undefined) data.baseFare = baseFare;
    if (perKmRate !== undefined) data.perKmRate = perKmRate;
    if (perMinuteRate !== undefined) data.perMinuteRate = perMinuteRate;
    if (minimumFare !== undefined) data.minimumFare = minimumFare;
    if (commissionPercent !== undefined) data.commissionPercent = commissionPercent;
    if (roadDistanceMultiplier !== undefined) data.roadDistanceMultiplier = roadDistanceMultiplier;
    if (avgSpeedKmh !== undefined) data.avgSpeedKmh = avgSpeedKmh;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.rideSettings.upsert({
      where: { vehicleType },
      update: data,
      create: { vehicleType, ...data }
    });
    return updated;
  }
}
