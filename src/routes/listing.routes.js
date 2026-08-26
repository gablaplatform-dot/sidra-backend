import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles, ServiceProductType } from "../constants/enums.js";

export const buildListingRoutes = ({ listingController }) => {
  const router = Router();
  const mediaSchema = Joi.object({
    imageUrl: Joi.string().uri().max(1000).allow(null).optional(),
    gallery: Joi.array().items(Joi.string().uri().max(1000)).max(40).optional()
  });
  const id = Joi.string().trim().min(1).max(64);

  router.get("/", listingController.publicList);
  router.get(
    "/me",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional(),
        status: Joi.string().valid("pending", "approved", "suspended").optional(),
        shopCategoryId: id.optional()
      }),
      "query"
    ),
    listingController.listMine
  );
  router.get("/provider/:providerId", listingController.listByProvider);
  router.get(
    "/:listingId",
    validate(Joi.object({ listingId: id.required() }), "params"),
    listingController.getPublicListing
  );

  router.post(
    "/",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).required(),
        description: Joi.string().trim().max(5000).allow("").optional(),
        price: Joi.number().min(0).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).required(),
        categoryId: id.allow(null).optional(),
        shopCategoryId: id.allow(null).optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional()
      })
    ),
    listingController.create
  );

  router.patch(
    "/:listingId",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).optional(),
        description: Joi.string().trim().max(5000).allow("").optional(),
        price: Joi.number().min(0).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional(),
        categoryId: id.allow(null).optional(),
        shopCategoryId: id.allow(null).optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional()
      }).min(1)
    ),
    listingController.update
  );

  router.delete("/:listingId", requireAuth([Roles.PROVIDER]), listingController.remove);

  return router;
};
