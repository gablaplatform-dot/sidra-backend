import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { UGANDA_DISTRICTS } from "../constants/ugandaDistricts.js";

export const buildInterestRoutes = ({ interestController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const deviceId = Joi.string().trim().min(8).max(64).pattern(/^[A-Za-z0-9_-]+$/);

  router.post(
    "/events",
    optionalAuth(),
    validate(
      Joi.object({
        deviceId: deviceId.optional(),
        type: Joi.string().valid("view", "category", "search", "cart", "order").required(),
        listingId: id.optional(),
        productCategoryId: id.optional(),
        query: Joi.string().trim().max(120).optional()
      })
    ),
    interestController.track
  );

  router.get(
    "/for-you",
    optionalAuth(),
    validate(
      Joi.object({
        deviceId: deviceId.optional(),
        district: Joi.string().valid(...UGANDA_DISTRICTS).optional(),
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
        limit: Joi.number().integer().min(1).max(24).optional()
      }).and("lat", "lng"),
      "query"
    ),
    interestController.forYou
  );

  router.post("/claim", requireAuth(), validate(Joi.object({ deviceId: deviceId.required() })), interestController.claim);

  router.delete("/", optionalAuth(), validate(Joi.object({ deviceId: deviceId.optional() }), "query"), interestController.clear);

  return router;
};
