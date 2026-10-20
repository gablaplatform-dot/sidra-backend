import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

// The countries and cultures providers say they serve, and the customers' filters built from them.
export const buildAudienceRoutes = ({ audienceService }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const json = (fn, status = 200) => async (req, res, next) => {
    try {
      res.status(status).json({ data: await fn(req) });
    } catch (error) {
      next(error);
    }
  };
  const admin = [requireAuth([Roles.ADMIN]), requirePermission("categories")];
  const kind = Joi.string().valid("country", "culture");
  const name = Joi.string().trim().min(2).max(60);

  // Public: approved entries only, with how many providers serve each.
  router.get("/", json(() => audienceService.listPublic()));

  // A provider suggesting a country or culture that isn't listed. It stays pending until an admin approves it.
  router.post("/mine", requireAuth([Roles.PROVIDER]), validate(Joi.object({ kind: kind.required(), name: name.required() })), json((req) => audienceService.createFromProvider({ actorUserId: req.user.id, ...req.body }), 201));

  router.get("/admin/all", ...admin, json(() => audienceService.listAdmin()));
  router.post("/", ...admin, validate(Joi.object({ kind: kind.required(), name: name.required(), code: Joi.string().trim().max(3).allow("", null).optional() })), json((req) => audienceService.createByAdmin(req.body), 201));
  router.patch(
    "/:audienceId",
    ...admin,
    validate(Joi.object({ audienceId: id.required() }), "params"),
    validate(Joi.object({ name: name.optional(), code: Joi.string().trim().max(3).allow("", null).optional(), moderationStatus: Joi.string().valid("approved", "pending").optional() }).min(1)),
    json((req) => audienceService.update(req.params.audienceId, req.body))
  );
  router.delete("/:audienceId", ...admin, validate(Joi.object({ audienceId: id.required() }), "params"), json((req) => audienceService.remove(req.params.audienceId)));

  return router;
};
