import { Router } from "express";
import Joi from "joi";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildPaymentRoutes = ({ paymentController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const money = Joi.alternatives().try(Joi.number().min(0), Joi.string().pattern(/^\d+(\.\d{1,2})?$/));
  const note = Joi.string().trim().max(2000).allow(null).optional();

  router.post(
    "/subscriptions/activate",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        amount: money.optional(),
        days: Joi.number().integer().min(1).max(366).optional()
      })
    ),
    paymentController.activateSubscription
  );

  router.post(
    "/contacts/unlock",
    requireAuth([Roles.USER]),
    validate(Joi.object({ providerId: id.required() })),
    paymentController.unlockContact
  );

  router.post(
    "/products/purchase",
    requireAuth([Roles.USER]),
    validate(
      Joi.object({
        listingId: id.required(),
        quantity: Joi.number().integer().min(1).max(99).optional()
      })
    ),
    paymentController.purchaseProduct
  );

  router.post(
    "/withdrawals",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ amount: money.required(), note })),
    paymentController.requestWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/approve",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminApproveWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/reject",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminRejectWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/mark-paid",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminMarkWithdrawalPaid
  );

  return router;
};
