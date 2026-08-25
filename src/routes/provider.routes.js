import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildProviderRoutes = ({ providerController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  const identifierSchema = Joi.object({
    email: Joi.string().email().max(254).optional(),
    phone: Joi.string().max(32).optional()
  }).or("email", "phone");

  const locationSchema = Joi.object({
    address: Joi.string().trim().max(500).optional(),
    city: Joi.string().trim().max(120).optional(),
    region: Joi.string().trim().max(120).optional(),
    country: Joi.string().trim().max(120).optional(),
    geo: Joi.object({
      type: Joi.string().valid("Point").optional(),
      coordinates: Joi.array().items(Joi.number()).length(2).optional()
    }).optional()
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

  router.get(
    "/",
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        categoryId: id.optional(),
        q: Joi.string().trim().max(200).optional(),
        city: Joi.string().trim().max(120).optional(),
        region: Joi.string().trim().max(120).optional(),
        country: Joi.string().trim().max(120).optional(),
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
        radiusKm: Joi.number().min(0).max(200).optional(),
        minRating: Joi.number().min(0).max(5).optional(),
        sort: Joi.string().valid("random", "top-rated", "top_rated", "toprated", "newest").optional()
      }).and("lat", "lng", "radiusKm"),
      "query"
    ),
    providerController.listPublicProviders
  );
  router.post(
    "/admin",
    requireAuth([Roles.ADMIN]),
    validate(
      identifierSchema.keys({
        name: Joi.string().trim().max(200).required(),
        email: Joi.string().email().max(254).required(),
        businessName: Joi.string().trim().max(200).required(),
        description: Joi.string().trim().max(5000).optional(),
        categoryId: id.optional(),
        location: locationSchema.optional(),
        contact: contactSchema.optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional()
      })
    ),
    providerController.adminCreateProvider
  );

  router.patch(
    "/admin/:providerId/approval",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ approved: Joi.boolean().required() })),
    providerController.adminSetApproval
  );
  router.post(
    "/admin/:providerId/resend-invitation",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    providerController.adminResendInvitation
  );
  router.post(
    "/admin/:providerId/resend-google-link",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    providerController.adminResendGoogleLink
  );

  router.post(
    "/link-google/request",
    validate(Joi.object({ email: Joi.string().email().max(254).required() })),
    providerController.requestGoogleLink
  );

  router.get("/onboarding/:token", providerController.getOnboardingInfo);
  router.post(
    "/onboarding/:token/complete",
    validate(
      Joi.object({
        password: Joi.string().min(8).max(128).optional(),
        profile: Joi.object({
          businessName: Joi.string().trim().max(200).optional(),
          description: Joi.string().trim().max(5000).optional(),
          categoryId: id.optional(),
          location: locationSchema.optional(),
          contact: contactSchema.optional(),
          media: mediaSchema.optional(),
          customFields: Joi.object().unknown(true).optional()
        }).optional()
      })
    ),
    providerController.completeOnboarding
  );

  router.post(
    "/onboarding/:token/link-google",
    validate(Joi.object({ idToken: Joi.string().trim().required() })),
    providerController.linkGoogleAccount
  );

  router.put(
    "/me",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        businessName: Joi.string().trim().max(200).optional(),
        description: Joi.string().trim().max(5000).optional(),
        categoryId: id.optional(),
        location: locationSchema.optional(),
        contact: contactSchema.optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional(),
        onlinePaymentsEnabled: Joi.boolean().optional()
      })
    ),
    providerController.updateMyProfile
  );
  router.get("/me", requireAuth([Roles.PROVIDER]), providerController.getMyProfile);

  router.get(
    "/:providerId/contact",
    requireAuth([Roles.USER]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    providerController.getProviderContact
  );
  router.get("/:providerId", providerController.getPublicProviderProfile);

  return router;
};
