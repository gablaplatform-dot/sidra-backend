import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles, ServiceProductType } from "../constants/enums.js";
import { UGANDA_DISTRICTS } from "../constants/ugandaDistricts.js";

export const buildListingRoutes = ({ listingController }) => {
  const router = Router();
  const mediaSchema = Joi.object({
    imageUrl: Joi.string().uri().max(1000).allow(null).optional(),
    gallery: Joi.array().items(Joi.string().uri().max(1000)).max(40).optional()
  });
  const id = Joi.string().trim().min(1).max(64);
  const sortOptions = ["newest", "price_asc", "price_desc", "bestsellers", "featured"];
  const enrichmentFields = {
    originalPrice: Joi.number().min(0).allow(null).optional(),
    discountPercent: Joi.number().integer().min(1).max(100).allow(null).optional(),
    isNew: Joi.boolean().optional(),
    sku: Joi.string().trim().max(120).allow(null).optional(),
    inventory: Joi.number().integer().min(0).allow(null).optional()
  };

  // Shared by the result list and the sidebar facet counts so the two can never drift apart:
  // a count is only trustworthy if it was computed from exactly the filters the list used.
  const browseQuery = {
    type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional(),
    q: Joi.string().trim().max(200).optional(),
    categoryId: id.optional(),
    productCategoryId: id.optional(),
    shopCategoryId: id.optional(),
    providerId: id.optional(),
    discountOnly: Joi.boolean().optional(),
    isNew: Joi.boolean().optional(),
    lat: Joi.number().min(-90).max(90).optional(),
    lng: Joi.number().min(-180).max(180).optional(),
    // Max raised from 50 to 1000: the nearby-search widening ladder (see
    // ListingService#publicList) can echo back an effective radius up to the
    // nationwide sentinel (~900km) on later pages of an already-widened search.
    radiusKm: Joi.number().min(0).max(1000).optional(),
    district: Joi.string().valid(...UGANDA_DISTRICTS).optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    // JSON string: {"brand":["Apple","Dell"],"condition":["Used"]}
    attrs: Joi.string().max(2000).optional()
  };

  router.get(
    "/",
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        sort: Joi.string().valid(...sortOptions).optional(),
        ...browseQuery
      }).and("lat", "lng", "radiusKm"),
      "query"
    ),
    listingController.publicList
  );

  router.get(
    "/facets",
    validate(Joi.object(browseQuery).and("lat", "lng", "radiusKm"), "query"),
    listingController.facets
  );
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
    "/new-arrivals",
    validate(
      Joi.object({
        limit: Joi.number().integer().min(1).max(60).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional()
      }),
      "query"
    ),
    listingController.listNewArrivals
  );
  router.get(
    "/best-sellers",
    validate(
      Joi.object({
        limit: Joi.number().integer().min(1).max(60).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional()
      }),
      "query"
    ),
    listingController.listBestSellers
  );
  router.get(
    "/featured",
    validate(
      Joi.object({
        limit: Joi.number().integer().min(1).max(60).optional(),
        type: Joi.string().valid(ServiceProductType.SERVICE, ServiceProductType.PRODUCT).optional()
      }),
      "query"
    ),
    listingController.listFeatured
  );
  router.get(
    "/:listingId/similar",
    validate(Joi.object({ listingId: id.required() }), "params"),
    validate(Joi.object({ limit: Joi.number().integer().min(1).max(24).optional() }), "query"),
    listingController.similar
  );
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
        productCategoryId: id.allow(null).optional(),
        shopCategoryId: id.allow(null).optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional(),
        ...enrichmentFields
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
        productCategoryId: id.allow(null).optional(),
        shopCategoryId: id.allow(null).optional(),
        media: mediaSchema.optional(),
        customFields: Joi.object().unknown(true).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional(),
        ...enrichmentFields
      }).min(1)
    ),
    listingController.update
  );

  router.delete("/:listingId", requireAuth([Roles.PROVIDER]), listingController.remove);

  return router;
};
