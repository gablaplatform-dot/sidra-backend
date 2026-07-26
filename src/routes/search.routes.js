import { Router } from "express";
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

  return router;
};
