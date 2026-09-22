import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

// Mounted at the top-level /admin-invites (not nested under /admin) so the two invitee-facing
// routes below stay reachable without a session - an invite recipient has no admin login yet.
export const buildAdminInviteRoutes = ({ adminInviteController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const token = Joi.string().trim().min(20).required();

  // Public - no session required.
  router.get("/:token", validate(Joi.object({ token }), "params"), adminInviteController.getInviteInfo);
  router.post(
    "/:token/accept",
    validate(Joi.object({ token }), "params"),
    validate(Joi.object({ password: Joi.string().min(8).max(128).required() })),
    adminInviteController.accept
  );

  // Protected - managing invites requires the adminroles permission.
  router.get("/", requireAuth([Roles.ADMIN]), requirePermission("adminroles"), adminInviteController.list);
  router.post(
    "/",
    requireAuth([Roles.ADMIN]),
    requirePermission("adminroles"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).required(),
        email: Joi.string().email().max(254).required(),
        roleId: id.required()
      })
    ),
    adminInviteController.create
  );
  router.post(
    "/:inviteId/resend",
    requireAuth([Roles.ADMIN]),
    requirePermission("adminroles"),
    validate(Joi.object({ inviteId: id.required() }), "params"),
    adminInviteController.resend
  );
  router.post(
    "/:inviteId/revoke",
    requireAuth([Roles.ADMIN]),
    requirePermission("adminroles"),
    validate(Joi.object({ inviteId: id.required() }), "params"),
    adminInviteController.revoke
  );

  return router;
};
