import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildAdminTransactionsRoutes = ({ transactionController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  router.get(
    "/transactions",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional(),
        status: Joi.string().trim().max(32).optional(),
        type: Joi.string().trim().max(32).optional(),
        userId: Joi.alternatives().try(id, Joi.valid(""), Joi.valid(null)).optional(),
        providerId: Joi.alternatives().try(id, Joi.valid(""), Joi.valid(null)).optional(),
        from: Joi.date().iso().optional(),
        to: Joi.date().iso().optional(),
        sort: Joi.string().valid("newest", "oldest", "amount").optional()
      }),
      "query"
    ),
    transactionController.adminList
  );

  return router;
};
