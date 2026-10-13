import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

// Admin controls for AI smart search: on/off switch, key, model, and a "try it" test.
export const buildAiAdminRoutes = ({ aiSettingsService, aiSearchService }) => {
  const router = Router();
  const gate = [requireAuth([Roles.ADMIN]), requirePermission("settings")];
  const json = (fn) => async (req, res, next) => {
    try {
      res.status(200).json({ data: await fn(req) });
    } catch (error) {
      next(error);
    }
  };

  router.get("/settings", ...gate, json(() => aiSettingsService.get()));

  router.put(
    "/settings",
    ...gate,
    validate(
      Joi.object({
        enabled: Joi.boolean().optional(),
        apiKey: Joi.string().trim().min(10).max(400).optional(),
        clearKey: Joi.boolean().optional(),
        model: Joi.string().trim().min(3).max(80).optional()
      }).min(1)
    ),
    json((req) => aiSettingsService.update(req.body))
  );

  router.post(
    "/test",
    ...gate,
    validate(Joi.object({ query: Joi.string().trim().max(120).allow("").optional() })),
    json(async (req) => ({ result: await aiSearchService.test(req.body.query), settings: await aiSettingsService.get() }))
  );

  return router;
};
