import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";
import { buildFieldSchema } from "../constants/dynamicFieldSchema.js";

const id = Joi.string().trim().min(1).max(64);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = Joi.number().min(0).max(100000000);
const phone = Joi.string().trim().min(7).max(20);
const url = Joi.string().uri().max(1000).allow(null, "");

const stop = Joi.object({ name: Joi.string().trim().max(80).required(), minutesFromStart: Joi.number().integer().min(0).max(2000).optional() });
const ticketTypeInput = Joi.object({ name: Joi.string().trim().max(60).required(), price: money.required(), description: Joi.string().trim().max(200).allow("").optional() });
const departureInput = Joi.object({
  name: Joi.string().trim().max(80).allow("").optional(),
  departureTime: time.required(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).default([0, 1, 2, 3, 4, 5, 6]),
  startDate: date.optional(),
  endDate: date.allow(null).optional(),
  seats: Joi.number().integer().min(1).max(120).optional()
});
const routeInput = Joi.object({
  name: Joi.string().trim().max(120).allow("").optional(),
  originName: Joi.string().trim().max(80).required(),
  originDistrict: Joi.string().trim().max(80).allow(null, "").optional(),
  destinationName: Joi.string().trim().max(80).required(),
  destinationDistrict: Joi.string().trim().max(80).allow(null, "").optional(),
  boardingPoint: Joi.string().trim().max(160).allow("").optional(),
  dropoffPoint: Joi.string().trim().max(160).allow("").optional(),
  distanceKm: Joi.number().min(0).max(5000).allow(null).optional(),
  durationMinutes: Joi.number().integer().min(10).max(4000).optional(),
  stops: Joi.array().items(stop).max(20).optional(),
  busTypeId: id.allow(null, "").optional(),
  ticketTypes: Joi.array().items(ticketTypeInput).max(10).default([]),
  departures: Joi.array().items(departureInput).max(20).default([])
});

const profileInput = Joi.object({
  companyName: Joi.string().trim().max(120).required(),
  description: Joi.string().trim().max(2000).allow("").optional(),
  logoUrl: url.optional(),
  coverUrl: url.optional(),
  contactPhone: phone.optional(),
  whatsapp: phone.allow(null, "").optional(),
  parkName: Joi.string().trim().max(120).required(),
  parkDistrict: Joi.string().trim().max(80).required(),
  parkAddress: Joi.string().trim().max(240).allow(null, "").optional(),
  parkLat: Joi.number().min(-90).max(90).allow(null).optional(),
  parkLng: Joi.number().min(-180).max(180).allow(null).optional(),
  fleetSize: Joi.number().integer().min(0).max(5000).default(0),
  customFields: Joi.object().unknown(true).default({})
});

// Handlers are tiny (parse request -> call service -> wrap in { data }), so they live here rather
// than in one controller class per service.
const h = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
};

export const buildBusRoutes = ({ busBookingService, busOperatorService, busCatalogService, busOperationsService, storageService }) => {
  const router = Router();

  // ============================================================ public discovery
  router.get("/places", h(() => busBookingService.places()));
  router.get("/popular-routes", validate(Joi.object({ limit: Joi.number().integer().min(1).max(20).optional() }), "query"), h((req) => busBookingService.popularRoutes(req.query)));
  router.get("/types", h(() => busBookingService.listTypes()));
  router.get(
    "/parks",
    validate(Joi.object({ q: Joi.string().trim().max(80).optional(), district: Joi.string().trim().max(80).optional(), busTypeId: id.optional() }), "query"),
    h((req) => busBookingService.listParks(req.query))
  );
  router.get("/parks/:slug", h((req) => busBookingService.getPark(req.params.slug)));
  router.get(
    "/trips",
    validate(
      Joi.object({
        date: date.optional(),
        from: Joi.string().trim().max(80).optional(),
        to: Joi.string().trim().max(80).optional(),
        operatorSlug: Joi.string().trim().max(120).optional(),
        busTypeId: id.optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    h((req) => busBookingService.searchTrips(req.query))
  );
  router.get(
    "/calendar",
    validate(
      Joi.object({
        from: date.optional(),
        to: date.optional(),
        fromPlace: Joi.string().trim().max(80).optional(),
        toPlace: Joi.string().trim().max(80).optional(),
        operatorSlug: Joi.string().trim().max(120).optional(),
        busTypeId: id.optional()
      }),
      "query"
    ),
    h((req) => busBookingService.calendar(req.query))
  );
  router.get("/trips/:tripId", h((req) => busBookingService.getTrip(req.params.tripId)));

  // The QR image embedded in the ticket email - it only encodes the ticket number, which is not secret on its own.
  router.get("/tickets/:ticketNumber/qr.png", async (req, res, next) => {
    try {
      const png = await busBookingService.ticketQr(req.params.ticketNumber.toUpperCase());
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" }).status(200).send(png);
    } catch (e) {
      next(e);
    }
  });

  // ============================================================ customer
  const customer = requireAuth();
  router.post(
    "/bookings",
    customer,
    validate(
      Joi.object({
        tripId: id.required(),
        items: Joi.array().items(Joi.object({ ticketTypeId: id.required(), quantity: Joi.number().integer().min(0).max(10).required() })).min(1).max(10).required(),
        passenger: Joi.object({ name: Joi.string().trim().min(2).max(120).required(), phone: phone.required(), email: Joi.string().trim().email().allow("", null).optional() }).required(),
        payPhone: phone.required()
      })
    ),
    h((req) => busBookingService.createBooking({ userId: req.user.id, ...req.body }))
  );
  router.get("/bookings/:bookingId", customer, h((req) => busBookingService.getBooking({ userId: req.user.id, bookingId: req.params.bookingId })));
  router.get("/my-tickets", customer, h((req) => busBookingService.myTickets({ userId: req.user.id })));
  router.get("/my-tickets/:ticketNumber", customer, h((req) => busBookingService.getTicket({ userId: req.user.id, ticketNumber: req.params.ticketNumber.toUpperCase() })));
  router.get("/my-messages", customer, h((req) => busBookingService.myMessages({ userId: req.user.id })));

  // ============================================================ operator onboarding (emailed link)
  router.get("/onboarding", validate(Joi.object({ token: Joi.string().required() }), "query"), h((req) => busOperatorService.getOnboardingInfo({ token: req.query.token })));
  router.post(
    "/onboarding/google",
    validate(Joi.object({ token: Joi.string().required(), idToken: Joi.string().required() })),
    h((req) => busOperatorService.linkGoogleAccount({ onboardingToken: req.body.token, idToken: req.body.idToken }))
  );
  // Logo / cover uploads during onboarding: the invitation link is the credential, so a company that
  // chose a password (and has no session yet) can still upload.
  router.post(
    "/onboarding/upload-url",
    validate(
      Joi.object({
        token: Joi.string().required(),
        contentType: Joi.string().valid("image/jpeg", "image/png", "image/webp").required(),
        filename: Joi.string().trim().max(200).optional()
      })
    ),
    h((req) => {
      const payload = busOperatorService.verifyOnboardingToken(req.body.token);
      return storageService.createUploadUrl({ actorUserId: String(payload.sub), role: "bus_operator", contentType: req.body.contentType, folder: "bus-operators", filename: req.body.filename });
    })
  );
  router.post(
    "/onboarding/complete",
    validate(
      Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(8).max(100).optional(),
        profile: profileInput.required(),
        routes: Joi.array().items(routeInput).min(1).max(10).required()
      })
    ),
    h((req) => busOperatorService.completeOnboarding(req.body))
  );

  // ============================================================ operator portal
  const operator = Router();
  operator.use(requireAuth([Roles.BUS_OPERATOR]));
  operator.use(async (req, _res, next) => {
    try {
      req.operator = await busOperatorService.requireOperator(req.user.id);
      next();
    } catch (e) {
      next(e);
    }
  });
  const opId = (req) => req.operator.id;

  operator.get("/me", h((req) => busOperatorService.getMe(req.user.id)));
  operator.patch(
    "/me",
    validate(
      Joi.object({
        companyName: Joi.string().trim().max(120).optional(),
        description: Joi.string().trim().max(2000).allow("").optional(),
        logoUrl: url.optional(),
        coverUrl: url.optional(),
        contactPhone: phone.optional(),
        whatsapp: phone.allow(null, "").optional(),
        parkName: Joi.string().trim().max(120).optional(),
        parkDistrict: Joi.string().trim().max(80).optional(),
        parkAddress: Joi.string().trim().max(240).allow(null, "").optional(),
        parkLat: Joi.number().min(-90).max(90).allow(null).optional(),
        parkLng: Joi.number().min(-180).max(180).allow(null).optional(),
        fleetSize: Joi.number().integer().min(0).max(5000).optional(),
        customFields: Joi.object().unknown(true).optional()
      })
    ),
    h((req) => busOperatorService.updateMe(req.user.id, req.body))
  );
  operator.get("/stats", h((req) => busOperationsService.stats(opId(req))));
  operator.get("/types", h(() => busCatalogService.listTypes()));

  operator.get("/routes", h((req) => busCatalogService.listRoutes(opId(req))));
  operator.post("/routes", validate(routeInput), h((req) => busCatalogService.createRoute(opId(req), req.body)));
  operator.patch(
    "/routes/:routeId",
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).allow("").optional(),
        originName: Joi.string().trim().max(80).optional(),
        originDistrict: Joi.string().trim().max(80).allow(null, "").optional(),
        destinationName: Joi.string().trim().max(80).optional(),
        destinationDistrict: Joi.string().trim().max(80).allow(null, "").optional(),
        boardingPoint: Joi.string().trim().max(160).allow("").optional(),
        dropoffPoint: Joi.string().trim().max(160).allow("").optional(),
        distanceKm: Joi.number().min(0).max(5000).allow(null).optional(),
        durationMinutes: Joi.number().integer().min(10).max(4000).optional(),
        stops: Joi.array().items(stop).max(20).optional(),
        busTypeId: id.allow(null, "").optional(),
        isActive: Joi.boolean().optional()
      })
    ),
    h((req) => busCatalogService.updateRoute(opId(req), req.params.routeId, req.body))
  );
  operator.post("/routes/:routeId/ticket-types", validate(ticketTypeInput), h((req) => busCatalogService.createTicketType(opId(req), req.params.routeId, req.body)));
  operator.patch(
    "/ticket-types/:ticketTypeId",
    validate(Joi.object({ name: Joi.string().trim().max(60).optional(), description: Joi.string().trim().max(200).allow("").optional(), price: money.optional(), isActive: Joi.boolean().optional(), sortOrder: Joi.number().integer().optional() })),
    h((req) => busCatalogService.updateTicketType(opId(req), req.params.ticketTypeId, req.body))
  );
  operator.delete("/ticket-types/:ticketTypeId", h((req) => busCatalogService.deleteTicketType(opId(req), req.params.ticketTypeId)));

  operator.get("/schedules", h((req) => busCatalogService.listSchedules(opId(req))));
  operator.post("/schedules", validate(departureInput.keys({ routeId: id.required() })), h((req) => busCatalogService.createSchedule(opId(req), req.body)));
  operator.patch(
    "/schedules/:scheduleId",
    validate(
      Joi.object({
        name: Joi.string().trim().max(80).allow("").optional(),
        departureTime: time.optional(),
        daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(),
        startDate: date.optional(),
        endDate: date.allow(null).optional(),
        seats: Joi.number().integer().min(1).max(120).optional(),
        isActive: Joi.boolean().optional()
      })
    ),
    h((req) => busCatalogService.updateSchedule(opId(req), req.params.scheduleId, req.body))
  );
  operator.delete("/schedules/:scheduleId", h((req) => busCatalogService.deleteSchedule(opId(req), req.params.scheduleId)));

  operator.get("/trips", validate(Joi.object({ from: date.optional(), to: date.optional(), status: Joi.string().valid("scheduled", "cancelled", "departed", "completed").optional() }), "query"), h((req) => busOperationsService.listTrips({ operatorId: opId(req), ...req.query })));
  operator.post("/trips", validate(Joi.object({ routeId: id.required(), date: date.required(), time: time.required(), seats: Joi.number().integer().min(1).max(120).optional() })), h((req) => busCatalogService.createOneOffTrip(opId(req), req.body)));
  operator.get("/trips/:tripId", h((req) => busOperationsService.getTrip({ operatorId: opId(req), tripId: req.params.tripId })));
  operator.post("/trips/:tripId/cancel", validate(Joi.object({ reason: Joi.string().trim().max(300).allow("").optional() })), h((req) => busOperationsService.cancelTrip({ operatorId: opId(req), tripId: req.params.tripId, reason: req.body.reason })));
  operator.post("/trips/:tripId/delay", validate(Joi.object({ delayMinutes: Joi.number().integer().min(0).max(720).required(), note: Joi.string().trim().max(300).allow("").optional() })), h((req) => busOperationsService.delayTrip({ operatorId: opId(req), tripId: req.params.tripId, ...req.body })));
  operator.post("/trips/:tripId/status", validate(Joi.object({ status: Joi.string().valid("departed", "completed").required() })), h((req) => busOperationsService.markTrip({ operatorId: opId(req), tripId: req.params.tripId, status: req.body.status })));

  operator.get(
    "/bookings",
    validate(Joi.object({ status: Joi.string().valid("confirmed", "refund_due", "cancelled").optional(), q: Joi.string().trim().max(80).optional(), page: Joi.number().integer().min(1).optional(), limit: Joi.number().integer().min(1).max(100).optional() }), "query"),
    h((req) => busOperationsService.listBookings({ operatorId: opId(req), ...req.query }))
  );
  operator.post("/tickets/verify", validate(Joi.object({ ticketNumber: Joi.string().trim().max(40).required() })), h((req) => busOperationsService.verifyTicket({ operatorId: opId(req), ticketNumber: req.body.ticketNumber })));
  operator.post("/tickets/check-in", validate(Joi.object({ ticketNumber: Joi.string().trim().max(40).required() })), h((req) => busOperationsService.verifyTicket({ operatorId: opId(req), ticketNumber: req.body.ticketNumber, checkIn: true })));

  operator.get("/customers", validate(Joi.object({ q: Joi.string().trim().max(80).optional() }), "query"), h((req) => busOperationsService.listCustomers({ operatorId: opId(req), q: req.query.q })));
  operator.get("/announcements", h((req) => busOperationsService.listAnnouncements(opId(req))));
  operator.post(
    "/announcements",
    validate(
      Joi.object({
        title: Joi.string().trim().min(2).max(120).required(),
        message: Joi.string().trim().min(2).max(1500).required(),
        kind: Joi.string().valid("notice", "promotion").default("notice"),
        audience: Joi.string().valid("all", "upcoming").default("all"),
        tripId: id.optional()
      })
    ),
    h((req) => busOperationsService.sendAnnouncement({ operatorId: opId(req), ...req.body }))
  );

  operator.get("/payouts", h((req) => busOperationsService.listPayouts(opId(req))));
  operator.post("/payouts", validate(Joi.object({ amount: money.required(), phone: phone.required() })), h((req) => busOperationsService.requestPayout({ operatorId: opId(req), amount: req.body.amount, phone: req.body.phone })));
  router.use("/operator", operator);

  // ============================================================ admin
  const admin = Router();
  admin.use(requireAuth([Roles.ADMIN]), requirePermission("busticketing"));

  admin.get("/overview", h(() => busOperationsService.adminOverview()));
  admin.get("/settings", h(() => busOperatorService.getSettings()));
  admin.put(
    "/settings",
    validate(Joi.object({ onboardingFields: Joi.array().items(buildFieldSchema()).max(40).optional(), defaultCommissionPercent: Joi.number().min(0).max(50).optional(), holdMinutes: Joi.number().integer().min(3).max(60).optional() })),
    h((req) => busOperatorService.updateSettings(req.body))
  );

  admin.get("/operators", validate(Joi.object({ q: Joi.string().trim().max(80).optional(), status: Joi.string().optional(), page: Joi.number().integer().min(1).optional(), limit: Joi.number().integer().min(1).max(100).optional() }), "query"), h((req) => busOperatorService.listOperators(req.query)));
  admin.post(
    "/operators",
    validate(Joi.object({ companyName: Joi.string().trim().min(2).max(120).required(), contactName: Joi.string().trim().max(120).allow("").optional(), email: Joi.string().trim().email().required(), phone: phone.allow("", null).optional(), commissionPercent: Joi.number().min(0).max(50).optional() })),
    h((req) => busOperatorService.invite(req.body))
  );
  admin.get("/operators/:operatorId", h((req) => busOperatorService.getOperator(req.params.operatorId)));
  admin.patch("/operators/:operatorId", validate(Joi.object({ status: Joi.string().valid("active", "suspended").optional(), commissionPercent: Joi.number().min(0).max(50).optional(), companyName: Joi.string().trim().max(120).optional(), contactPhone: phone.optional() })), h((req) => busOperatorService.updateOperator(req.params.operatorId, req.body)));
  admin.post("/operators/:operatorId/resend", h((req) => busOperatorService.resendInvitation(req.params.operatorId)));

  const typeBody = Joi.object({ name: Joi.string().trim().min(2).max(60), description: Joi.string().trim().max(500).allow(""), seats: Joi.number().integer().min(1).max(120), imageUrl: url, amenities: Joi.array().items(Joi.string().trim().max(40)).max(20), sortOrder: Joi.number().integer(), isActive: Joi.boolean() });
  admin.get("/types", h(() => busCatalogService.listTypes({ includeInactive: true })));
  admin.post("/types", validate(typeBody.fork(["name"], (s) => s.required())), h((req) => busCatalogService.createType(req.body)));
  admin.patch("/types/:typeId", validate(typeBody), h((req) => busCatalogService.updateType(req.params.typeId, req.body)));
  admin.delete("/types/:typeId", h((req) => busCatalogService.deleteType(req.params.typeId)));

  admin.get("/bookings", validate(Joi.object({ status: Joi.string().optional(), q: Joi.string().trim().max(80).optional(), page: Joi.number().integer().min(1).optional(), limit: Joi.number().integer().min(1).max(100).optional() }), "query"), h((req) => busOperationsService.adminListBookings(req.query)));
  admin.post("/bookings/:bookingId/refunded", h((req) => busOperationsService.adminMarkRefunded(req.params.bookingId)));
  admin.get("/payouts", validate(Joi.object({ status: Joi.string().valid("requested", "paid", "rejected").optional() }), "query"), h((req) => busOperationsService.adminListPayouts(req.query)));
  admin.post("/payouts/:payoutId", validate(Joi.object({ status: Joi.string().valid("paid", "rejected").required(), note: Joi.string().trim().max(300).allow("").optional() })), h((req) => busOperationsService.adminProcessPayout({ payoutId: req.params.payoutId, ...req.body })));
  router.use("/admin", admin);

  return router;
};
