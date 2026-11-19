import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";

export const buildSearchRoutes = ({ searchController }) => {
  const router = Router();

  router.get(
    "/",
    validate(
      Joi.object({
        q: Joi.string().trim().max(200).allow("").optional(),
        limit: Joi.number().integer().min(1).max(20).optional()
      }),
      "query"
    ),
    searchController.search
  );

  // Photo search costs an AI call each time, so it has its own, tighter limit per visitor.
  const photoLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "You've used a lot of photo searches. Please try again later or type what you want." } }
  });
  router.post("/image", photoLimit, express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "6mb" }), searchController.imageSearch);

  return router;
};
