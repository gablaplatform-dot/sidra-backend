import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { PromotionType, Roles } from "../constants/enums.js";
import { UGANDA_DISTRICTS } from "../constants/ugandaDistricts.js";

export const buildPromotionRoutes = ({ promotionController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const adMediaFields = {
    title: Joi.string().trim().max(200),
    subtitle: Joi.string().trim().max(500).allow(null),
    imageUrl: Joi.string().uri().max(1000).allow(null),
    videoUrl: Joi.string().uri().max(1000).allow(null),
    ctaLabel: Joi.string().trim().max(120).allow(null),
    ctaHref: Joi.string().trim().max(500).allow(null),
    startsAt: Joi.date().allow(null),
    endsAt: Joi.date().allow(null)
  };

  router.get(
    "/featured",
    validate(
      Joi.object({
        limit: Joi.number().integer().min(1).max(60).optional(),
        type: Joi.string().valid(...Object.values(PromotionType)).optional()
      }),
      "query"
    ),
    promotionController.listFeatured
  );

  // Public - powers the Shop hero carousel, so it must sit ahead of the generic /:promotionId
  // GET below or that route would swallow this path instead.
  router.get(
    "/ads/nearby",
    validate(
      Joi.object({
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
        radiusKm: Joi.number().min(0).max(1000).optional(),
        district: Joi.string().valid(...UGANDA_DISTRICTS).optional(),
        limit: Joi.number().integer().min(1).max(30).optional()
      }).and("lat", "lng", "radiusKm"),
      "query"
    ),
    promotionController.listNearbyAds
  );

  router.get(
    "/mine",
    requireAuth([Roles.PROVIDER]),
    promotionController.listMine
  );

  router.post(
    "/mine",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        title: adMediaFields.title.required(),
        subtitle: adMediaFields.subtitle.optional(),
        imageUrl: adMediaFields.imageUrl.optional(),
        videoUrl: adMediaFields.videoUrl.optional(),
        ctaLabel: adMediaFields.ctaLabel.optional(),
        ctaHref: adMediaFields.ctaHref.optional(),
        startsAt: adMediaFields.startsAt.optional(),
        endsAt: adMediaFields.endsAt.optional()
      })
    ),
    promotionController.createMine
  );

  router.patch(
    "/mine/:promotionId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ promotionId: id.required() }), "params"),
    validate(
      Joi.object({
        title: adMediaFields.title.optional(),
        subtitle: adMediaFields.subtitle.optional(),
        imageUrl: adMediaFields.imageUrl.optional(),
        videoUrl: adMediaFields.videoUrl.optional(),
        ctaLabel: adMediaFields.ctaLabel.optional(),
        ctaHref: adMediaFields.ctaHref.optional(),
        startsAt: adMediaFields.startsAt.optional(),
        endsAt: adMediaFields.endsAt.optional(),
        isActive: Joi.boolean().optional()
      }).min(1)
    ),
    promotionController.updateMine
  );

  router.delete(
    "/mine/:promotionId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ promotionId: id.required() }), "params"),
    promotionController.deleteMine
  );

  router.get(
    "/admin",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        isActive: Joi.boolean().optional(),
        type: Joi.string().valid(...Object.values(PromotionType)).optional()
      }),
      "query"
    ),
    promotionController.listAdmin
  );

  router.get(
    "/:promotionId",
    validate(Joi.object({ promotionId: id.required() }), "params"),
    promotionController.getById
  );

  router.post(
    "/",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        title: Joi.string().trim().max(200).required(),
        subtitle: Joi.string().trim().max(500).allow(null).optional(),
        type: Joi.string().valid(...Object.values(PromotionType)).optional(),
        startsAt: Joi.date().allow(null).optional(),
        endsAt: Joi.date().allow(null).optional(),
        discountPercent: Joi.number().integer().min(1).max(100).allow(null).optional(),
        imageUrl: Joi.string().uri().max(1000).allow(null).optional(),
        ctaLabel: Joi.string().trim().max(120).allow(null).optional(),
        ctaHref: Joi.string().trim().max(500).allow(null).optional(),
        listingIds: Joi.array().items(Joi.string().trim().max(64)).optional(),
        categoryId: id.allow(null).optional(),
        providerId: id.allow(null).optional(),
        isFeatured: Joi.boolean().optional(),
        sortOrder: Joi.number().integer().optional(),
        isActive: Joi.boolean().optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    promotionController.create
  );

  router.patch(
    "/:promotionId",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        title: Joi.string().trim().max(200).optional(),
        subtitle: Joi.string().trim().max(500).allow(null).optional(),
        type: Joi.string().valid(...Object.values(PromotionType)).optional(),
        startsAt: Joi.date().allow(null).optional(),
        endsAt: Joi.date().allow(null).optional(),
        discountPercent: Joi.number().integer().min(1).max(100).allow(null).optional(),
        imageUrl: Joi.string().uri().max(1000).allow(null).optional(),
        ctaLabel: Joi.string().trim().max(120).allow(null).optional(),
        ctaHref: Joi.string().trim().max(500).allow(null).optional(),
        listingIds: Joi.array().items(Joi.string().trim().max(64)).optional(),
        categoryId: id.allow(null).optional(),
        providerId: id.allow(null).optional(),
        isFeatured: Joi.boolean().optional(),
        sortOrder: Joi.number().integer().optional(),
        isActive: Joi.boolean().optional(),
        metadata: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    promotionController.update
  );

  router.delete(
    "/:promotionId",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ promotionId: id.required() }), "params"),
    promotionController.remove
  );

  return router;
};
