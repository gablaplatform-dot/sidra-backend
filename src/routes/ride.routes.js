import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildRideRoutes = ({ rideController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const vehicleType = Joi.string().valid("boda", "car");
  const point = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().trim().max(500).allow("", null).optional()
  });
  // Any logged-in account (customer, provider, or driver) can request a ride or register as a
  // driver - these are not mutually exclusive with other roles on this platform.
  const anyAccount = [Roles.USER, Roles.PROVIDER, Roles.DRIVER];

  router.post(
    "/estimate",
    validate(
      Joi.object({
        vehicleType: vehicleType.required(),
        pickup: point.required(),
        dropoff: point.required()
      })
    ),
    rideController.estimateFare
  );

  // --- Driver ---
  router.post(
    "/drivers/register",
    requireAuth(anyAccount),
    validate(
      Joi.object({
        vehicleType: vehicleType.required(),
        vehicleModel: Joi.string().trim().max(120).allow(null).optional(),
        licensePlate: Joi.string().trim().max(40).allow(null).optional(),
        licensePhotoUrl: Joi.string().uri().max(2000).required(),
        contact: Joi.object({
          phone: Joi.string().trim().max(32).allow(null).optional()
        }).unknown(true).optional()
      })
    ),
    rideController.registerDriver
  );
  // Any authenticated account can check "do I have a driver profile yet?" - not just accounts
  // that already have one. Gating this to Roles.DRIVER made it impossible for a plain user to
  // ever reach the DRIVER_NOT_FOUND signal that tells a client to show the application form.
  router.get("/drivers/me", requireAuth(anyAccount), rideController.getMyDriverProfile);
  router.patch(
    "/drivers/me",
    requireAuth([Roles.DRIVER]),
    validate(
      Joi.object({
        vehicleType: vehicleType.optional(),
        vehicleModel: Joi.string().trim().max(120).allow(null).optional(),
        licensePlate: Joi.string().trim().max(40).allow(null).optional(),
        licensePhotoUrl: Joi.string().uri().max(2000).optional(),
        contact: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    rideController.updateMyDriverProfile
  );
  router.post(
    "/drivers/me/online",
    requireAuth([Roles.DRIVER]),
    validate(Joi.object({ isOnline: Joi.boolean().required() })),
    rideController.setOnlineStatus
  );
  router.post(
    "/drivers/me/location",
    requireAuth([Roles.DRIVER]),
    validate(Joi.object({ lat: Joi.number().min(-90).max(90).required(), lng: Joi.number().min(-180).max(180).required() })),
    rideController.updateLocation
  );
  router.get("/drivers/me/trips", requireAuth([Roles.DRIVER]), rideController.listMyTripsAsDriver);
  router.get("/drivers/me/wallet", requireAuth([Roles.DRIVER]), rideController.getMyRideWallet);

  // --- Rider ---
  router.post(
    "/trips",
    requireAuth(anyAccount),
    validate(
      Joi.object({
        vehicleType: vehicleType.required(),
        pickup: point.required(),
        dropoff: point.required(),
        paymentMethod: Joi.string().valid("cash", "mobile_money").optional(),
        phone: Joi.string().trim().min(6).max(20).optional()
      })
    ),
    rideController.requestTrip
  );
  router.get("/trips/mine", requireAuth(anyAccount), rideController.listMyTripsAsRider);
  router.get(
    "/trips/:tripId",
    requireAuth(anyAccount),
    validate(Joi.object({ tripId: id.required() }), "params"),
    rideController.getTripStatus
  );
  router.post(
    "/trips/:tripId/cancel",
    requireAuth(anyAccount),
    validate(Joi.object({ tripId: id.required() }), "params"),
    validate(Joi.object({ reason: Joi.string().trim().max(500).allow(null).optional() })),
    rideController.cancelTrip
  );
  router.post(
    "/trips/:tripId/confirm",
    requireAuth(anyAccount),
    validate(Joi.object({ tripId: id.required() }), "params"),
    rideController.confirmMatch
  );

  // --- Driver acting on a trip ---
  router.post(
    "/trips/:tripId/respond",
    requireAuth([Roles.DRIVER]),
    validate(Joi.object({ tripId: id.required() }), "params"),
    validate(Joi.object({ accept: Joi.boolean().required() })),
    rideController.respondToTripOffer
  );
  router.patch(
    "/trips/:tripId/status",
    requireAuth([Roles.DRIVER]),
    validate(Joi.object({ tripId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("arrived", "in_progress", "completed").required() })),
    rideController.updateTripStatus
  );

  // --- Admin ---
  router.get(
    "/admin/drivers",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        moderationStatus: Joi.string().valid("pending", "approved", "rejected", "suspended").optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    rideController.adminListDrivers
  );
  router.patch(
    "/admin/drivers/:driverId/approval",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ driverId: id.required() }), "params"),
    validate(Joi.object({ approved: Joi.boolean().required(), rejectionReason: Joi.string().trim().max(500).allow(null).optional() })),
    rideController.adminSetDriverApproval
  );
  router.get(
    "/admin/trips",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        status: Joi.string().trim().max(40).optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    rideController.adminListTrips
  );
  router.get("/admin/settings", requireAuth([Roles.ADMIN]), rideController.getRideSettings);
  router.put(
    "/admin/settings",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        vehicleType: vehicleType.required(),
        baseFare: Joi.number().min(0).optional(),
        perKmRate: Joi.number().min(0).optional(),
        perMinuteRate: Joi.number().min(0).optional(),
        minimumFare: Joi.number().min(0).optional(),
        commissionPercent: Joi.number().integer().min(0).max(100).optional(),
        roadDistanceMultiplier: Joi.number().min(1).max(3).optional(),
        avgSpeedKmh: Joi.number().min(1).max(200).optional(),
        isActive: Joi.boolean().optional()
      })
    ),
    rideController.adminUpsertRideSettings
  );

  return router;
};
