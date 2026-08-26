import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildShopCategoryRoutes = ({ shopCategoryController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  router.get("/mine", requireAuth([Roles.PROVIDER]), shopCategoryController.listMine);
  router.get(
    "/provider/:providerId",
    validate(Joi.object({ providerId: id.required() }), "params"),
    shopCategoryController.listForProvider
  );

  router.post(
    "/",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        parentId: id.allow(null).optional()
      })
    ),
    shopCategoryController.create
  );

  router.patch(
    "/:shopCategoryId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ shopCategoryId: id.required() }), "params"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).optional(),
        parentId: id.allow(null).optional()
      }).min(1)
    ),
    shopCategoryController.update
  );

  router.delete(
    "/:shopCategoryId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ shopCategoryId: id.required() }), "params"),
    shopCategoryController.remove
  );

  router.patch(
    "/reorder/list",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        parentId: id.allow(null).optional(),
        orderedIds: Joi.array().items(id.required()).min(1).required()
      })
    ),
    shopCategoryController.reorder
  );

  return router;
};
