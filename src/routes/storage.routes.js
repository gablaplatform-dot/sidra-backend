import { Router } from "express";
import Joi from "joi";

import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildStorageRoutes = ({ storageController }) => {
  const router = Router();

  router.post(
    "/upload-url",
    requireAuth([Roles.ADMIN, Roles.PROVIDER, Roles.USER, Roles.DRIVER]),
    validate(
      Joi.object({
        contentType: Joi.string().valid("image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4").required(),
        folder: Joi.string().trim().max(80).optional(),
        filename: Joi.string().trim().max(200).optional()
      })
    ),
    storageController.createUploadUrl
  );
  router.post(
    "/assets",
    requireAuth([Roles.ADMIN, Roles.PROVIDER]),
    validate(
      Joi.object({
        key: Joi.string().trim().max(1000).required(),
        url: Joi.string().uri().max(2000).required(),
        providerId: Joi.string().trim().min(1).max(64).allow(null).optional(),
        mimeType: Joi.string().trim().max(120).allow(null).optional(),
        size: Joi.number().integer().min(0).allow(null).optional(),
        kind: Joi.string().trim().max(80).optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    storageController.registerAsset
  );

  return router;
};
