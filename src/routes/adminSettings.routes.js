import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildAdminSettingsRoutes = ({ adminSettingsController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  const money = Joi.alternatives().try(Joi.number().min(0), Joi.string().pattern(/^\d+(\.\d{1,2})?$/));
  const moneyOrNull = Joi.alternatives().try(money, Joi.valid(null));
  const boolOrNull = Joi.alternatives().try(Joi.boolean(), Joi.valid(null));
  const percentOrNull = Joi.alternatives().try(Joi.number().min(0).max(100), Joi.valid(null));

  router.get("/settings", requireAuth([Roles.ADMIN]), adminSettingsController.getGlobal);

  router.put(
    "/settings",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        enableSubscription: Joi.boolean().optional(),
        enableContactFee: Joi.boolean().optional(),
        enableWallet: Joi.boolean().optional(),
        enableEcommerce: Joi.boolean().optional(),
        subscriptionFee: money.optional(),
        contactFee: money.optional(),
        minimumWithdrawalAmount: money.optional(),
        transactionFeePercent: Joi.number().min(0).max(100).optional(),
        platformName: Joi.string().trim().max(120).optional(),
        supportEmail: Joi.string().email().max(254).allow(null, "").optional(),
        supportPhone: Joi.string().trim().max(32).allow(null, "").optional(),
        featureFlags: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    adminSettingsController.updateGlobal
  );

  router.get(
    "/providers/:providerId/settings",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    adminSettingsController.getProviderSettings
  );

  router.put(
    "/providers/:providerId/settings",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(
      Joi.object({
        enableSubscription: boolOrNull.optional(),
        enableContactFee: boolOrNull.optional(),
        enableWallet: boolOrNull.optional(),
        enableEcommerce: boolOrNull.optional(),
        subscriptionFee: moneyOrNull.optional(),
        contactFee: moneyOrNull.optional(),
        transactionFeePercent: percentOrNull.optional()
      }).min(1)
    ),
    adminSettingsController.updateProviderOverrides
  );

  return router;
};
