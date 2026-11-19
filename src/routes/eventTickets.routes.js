import { Router } from "express";
import Joi from "joi";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

const phone = Joi.string().trim().pattern(/^(?:\+?256|0)7\d{8}$/).required();
const page = Joi.number().integer().min(1).max(10000).default(1);
const admin = [requireAuth(["admin"]), requirePermission("events")];
const finance = requirePermission("transactions");
const signed = requireAuth();
const handle = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req);
    res.set("Cache-Control", "private, no-store").json({ data });
  } catch (error) {
    next(error);
  }
};

export function buildEventTicketRoutes(service) {
  const router = Router();
  router.get("/tickets/mine", signed, validate(Joi.object({ page }), "query"),
    handle((req) => service.mine(req.user.id, req.query.page)));
  router.get("/tickets/orders/:id", signed, handle((req) => service.order(req.params.id, req.user.id)));
  router.post("/:id/tickets/orders", signed, validate(Joi.object({
    quantity: Joi.number().integer().min(1).max(10).required(),
    expectedPrice: Joi.number().integer().min(500).required(),
    payPhone: phone, email: Joi.string().email({ tlds: { allow: false } }).max(254).required()
  })), handle((req) => service.buy(req.params.id, req.user.id, req.body)));
  router.post("/:id/tickets/redeem", signed, validate(Joi.object({
    number: Joi.string().trim().max(128).required()
  })), handle((req) => service.redeem(req.params.id, req.user.id, req.body.number)));

  router.put("/admin/:id/ticket-sales", ...admin, validate(Joi.object({
    enabled: Joi.boolean().required(), price: Joi.number().integer().min(500).max(10_000_000).required(),
    capacity: Joi.number().integer().min(1).max(100_000).required()
  })), handle((req) => service.configure(req.params.id, req.body)));
  router.get("/admin/:id/ticket-orders", ...admin, validate(Joi.object({
    page, q: Joi.string().trim().max(120),
    status: Joi.string().valid("pending_payment", "paid", "failed", "refund_due", "refunded")
  }), "query"), handle((req) => service.report(req.params.id, req.query)));
  router.post("/admin/:id/ticket-payouts", ...admin, finance, validate(Joi.object({ phone })),
    handle((req) => service.settle(req.params.id, req.user.id, req.body.phone)));
  router.patch("/admin/:id/ticket-payouts/:payoutId", ...admin, finance, validate(Joi.object({
    status: Joi.string().valid("paid", "failed").required(), note: Joi.string().trim().min(10).max(500).required()
  })), handle((req) => service.reconcile(req.params.payoutId, req.params.id, req.body.status, req.body.note)));
  return router;
}
