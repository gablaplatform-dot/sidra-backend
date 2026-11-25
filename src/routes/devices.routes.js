import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

// Any signed-in account - customer, provider, or driver - registers its own FCM token the same
// way, so there's nothing role-specific to check beyond "is someone logged in".
const anyAccount = [Roles.USER, Roles.PROVIDER, Roles.ADMIN, Roles.DRIVER, Roles.BUS_OPERATOR];

export const buildDeviceRoutes = ({ deviceController }) => {
  const router = Router();

  router.post(
    "/",
    requireAuth(anyAccount),
    validate(
      Joi.object({
        token: Joi.string().trim().min(10).max(4096).required(),
        platform: Joi.string().valid("android", "ios").optional()
      })
    ),
    deviceController.registerToken
  );

  // Fire on logout so a shared/reset device stops receiving another account's pushes - token in
  // the body (not the path) since FCM tokens can contain characters that don't round-trip
  // cleanly through a URL segment.
  router.post(
    "/unregister",
    requireAuth(anyAccount),
    validate(Joi.object({ token: Joi.string().trim().min(10).max(4096).required() })),
    deviceController.unregisterToken
  );

  return router;
};
