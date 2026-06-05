import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const buildAuthRoutes = ({ authController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  const identifierSchema = Joi.object({
    email: Joi.string().email().max(254).optional(),
    phone: Joi.string().max(32).optional()
  }).or("email", "phone");

  const registerUserSchema = identifierSchema.keys({
    name: Joi.string().trim().max(200).required(),
    password: Joi.string().min(8).max(128).required()
  });

  const registerProviderSchema = identifierSchema.keys({
    name: Joi.string().trim().max(200).required(),
    password: Joi.string().min(8).max(128).required(),
    businessName: Joi.string().trim().max(200).required(),
    description: Joi.string().trim().max(5000).optional(),
    categoryId: id.optional(),
    location: Joi.object({
      address: Joi.string().trim().max(500).optional(),
      city: Joi.string().trim().max(120).optional(),
      region: Joi.string().trim().max(120).optional(),
      country: Joi.string().trim().max(120).optional(),
      geo: Joi.object({
        type: Joi.string().valid("Point").optional(),
        coordinates: Joi.array().items(Joi.number()).length(2).optional()
      }).optional()
    }).optional()
  });

  const loginSchema = identifierSchema.keys({
    password: Joi.string().min(8).max(128).required()
  });
  const contactSchema = Joi.object({
    phone: Joi.string().trim().max(32).allow(null).optional(),
    whatsapp: Joi.string().trim().max(32).allow(null).optional(),
    email: Joi.string().email().max(254).allow(null).optional(),
    website: Joi.string().uri().max(500).allow(null).optional()
  });
  const mediaSchema = Joi.object({
    avatarUrl: Joi.string().uri().max(1000).allow(null).optional(),
    coverUrl: Joi.string().uri().max(1000).allow(null).optional(),
    gallery: Joi.array().items(Joi.string().uri().max(1000)).max(40).optional()
  });

  router.post("/register/user", validate(registerUserSchema), authController.registerUser);
  router.post(
    "/register/provider",
    validate(
      registerProviderSchema.keys({
        contact: contactSchema.optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional()
      })
    ),
    authController.registerProvider
  );
  router.post("/login", validate(loginSchema), authController.login);
  router.post(
    "/google",
    validate(Joi.object({ idToken: Joi.string().trim().min(20).required() })),
    authController.googleLogin
  );
  router.get("/me", requireAuth(), authController.me);
  router.patch(
    "/me",
    requireAuth(),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).optional(),
        phone: Joi.string().trim().max(32).allow(null, "").optional(),
        profile: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    authController.updateMe
  );
  router.post(
    "/bootstrap/admin",
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).required(),
        email: Joi.string().email().max(254).required(),
        phone: Joi.string().max(32).optional(),
        password: Joi.string().min(8).max(128).required()
      })
    ),
    authController.bootstrapAdmin
  );

  return router;
};
