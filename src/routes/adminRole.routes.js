import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildAdminRoleRoutes = ({ adminRoleController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  router.use(requireAuth([Roles.ADMIN]), requirePermission("adminroles"));

  router.get("/", adminRoleController.list);

  router.post(
    "/",
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        description: Joi.string().trim().max(500).allow("").optional(),
        permissions: Joi.array().items(Joi.string().trim().max(80)).optional()
      })
    ),
    adminRoleController.create
  );

  router.patch(
    "/:roleId",
    validate(Joi.object({ roleId: id.required() }), "params"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).optional(),
        description: Joi.string().trim().max(500).allow("").optional(),
        permissions: Joi.array().items(Joi.string().trim().max(80)).optional()
      }).min(1)
    ),
    adminRoleController.update
  );

  router.delete(
    "/:roleId",
    validate(Joi.object({ roleId: id.required() }), "params"),
    adminRoleController.remove
  );

  return router;
};
