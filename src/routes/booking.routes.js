import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

const id = Joi.string().trim().min(1).max(64);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

// Bookings for bookable services (hotel rooms, venues, hourly slots).
export const buildBookingRoutes = ({ serviceBookingService }) => {
  const router = Router();
  const json = (fn, status = 200) => async (req, res, next) => {
    try {
      res.status(status).json({ data: await fn(req) });
    } catch (error) {
      next(error);
    }
  };
  const customer = requireAuth([Roles.USER, Roles.PROVIDER]);
  const provider = requireAuth([Roles.PROVIDER]);

  // Public: which dates (or hourly slots on `date`) are open.
  router.get(
    "/availability",
    validate(Joi.object({ listingId: id.required(), from: date.optional(), to: date.optional(), date: date.optional() }), "query"),
    json((req) => serviceBookingService.availability(req.query))
  );

  router.post(
    "/",
    customer,
    validate(
      Joi.object({
        listingId: id.required(),
        startDate: date.required(),
        endDate: date.optional(),
        startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
        hours: Joi.number().integer().min(1).max(24).optional(),
        quantity: Joi.number().integer().min(1).max(500).default(1),
        guests: Joi.number().integer().min(1).max(100000).default(1),
        customer: Joi.object({
          name: Joi.string().trim().min(2).max(120).required(),
          phone: Joi.string().trim().min(7).max(40).required(),
          email: Joi.string().trim().email().max(200).allow("").optional(),
          notes: Joi.string().trim().max(800).allow("").optional()
        }).required()
      })
    ),
    json((req) => serviceBookingService.create({ userId: req.user.id, input: req.body }), 201)
  );

  router.get("/mine", customer, json((req) => serviceBookingService.listMine(req.user.id)));
  router.post("/:bookingId/cancel", customer, json((req) => serviceBookingService.cancelMine({ userId: req.user.id, id: req.params.bookingId })));

  router.get(
    "/provider",
    provider,
    validate(Joi.object({ status: Joi.string().valid("pending", "confirmed", "declined", "cancelled", "completed", "expired").optional() }), "query"),
    json((req) => serviceBookingService.listForProvider(req.user.id, req.query))
  );
  router.patch(
    "/provider/:bookingId",
    provider,
    validate(Joi.object({ action: Joi.string().valid("accept", "decline", "cancel", "complete").required(), note: Joi.string().trim().max(500).allow("").optional() })),
    json((req) => serviceBookingService.respond({ userId: req.user.id, id: req.params.bookingId, action: req.body.action, note: req.body.note }))
  );

  return router;
};
