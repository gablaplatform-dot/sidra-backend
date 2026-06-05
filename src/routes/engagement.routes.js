import { Router } from "express";
import Joi from "joi";

import { Roles } from "../constants/enums.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

export const buildEngagementRoutes = ({ engagementController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);

  router.post(
    "/providers/:providerId/visit",
    optionalAuth(),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(
      Joi.object({
        source: Joi.string().trim().max(120).allow(null).optional(),
        sessionId: Joi.string().trim().max(160).allow(null).optional(),
        ipHash: Joi.string().trim().max(160).allow(null).optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    engagementController.recordProfileVisit
  );

  router.post(
    "/providers/:providerId/contact-events",
    optionalAuth(),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(
      Joi.object({
        type: Joi.string().valid("call", "whatsapp", "email", "website", "directions").required(),
        value: Joi.string().trim().max(500).allow(null).optional(),
        paid: Joi.boolean().optional(),
        source: Joi.string().trim().max(120).allow(null).optional(),
        sessionId: Joi.string().trim().max(160).allow(null).optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    engagementController.recordContactEvent
  );

  router.post(
    "/search-events",
    optionalAuth(),
    validate(
      Joi.object({
        query: Joi.string().trim().max(300).allow(null, "").optional(),
        categoryId: id.allow(null).optional(),
        filters: Joi.object().unknown(true).optional(),
        resultCount: Joi.number().integer().min(0).optional(),
        sessionId: Joi.string().trim().max(160).allow(null).optional()
      })
    ),
    engagementController.recordSearchEvent
  );

  router.get("/favorites", requireAuth([Roles.USER]), engagementController.listFavorites);
  router.post(
    "/favorites/:providerId",
    requireAuth([Roles.USER]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    engagementController.addFavorite
  );
  router.delete(
    "/favorites/:providerId",
    requireAuth([Roles.USER]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    engagementController.removeFavorite
  );

  router.get(
    "/providers/:providerId/reviews",
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    engagementController.listProviderReviews
  );
  router.post(
    "/providers/:providerId/reviews",
    requireAuth([Roles.USER]),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(
      Joi.object({
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().max(3000).allow("").optional()
      })
    ),
    engagementController.createReview
  );

  router.post(
    "/inquiries",
    validate(
      Joi.object({
        providerId: id.required(),
        listingId: id.allow(null).optional(),
        type: Joi.string().trim().max(80).optional(),
        name: Joi.string().trim().max(200).allow(null).optional(),
        email: Joi.string().email().max(254).allow(null).optional(),
        phone: Joi.string().trim().max(32).allow(null).optional(),
        message: Joi.string().trim().max(5000).allow("").optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    engagementController.createInquiry
  );
  router.get(
    "/provider/inquiries",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        status: Joi.string().trim().max(80).optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    engagementController.listProviderInquiries
  );
  router.patch(
    "/provider/inquiries/:inquiryId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ inquiryId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("new", "open", "closed", "archived").required() })),
    engagementController.updateProviderInquiry
  );

  router.post(
    "/orders",
    requireAuth([Roles.USER]),
    validate(
      Joi.object({
        providerId: id.required(),
        items: Joi.array()
          .items(
            Joi.object({
              listingId: id.allow(null).optional(),
              name: Joi.string().trim().max(300).optional(),
              quantity: Joi.number().integer().min(1).max(99).optional(),
              unitPrice: Joi.number().min(0).optional(),
              metadata: Joi.object().unknown(true).optional()
            })
          )
          .min(1)
          .required(),
        customer: Joi.object().unknown(true).optional(),
        fulfillment: Joi.object().unknown(true).optional(),
        metadata: Joi.object().unknown(true).optional()
      })
    ),
    engagementController.createOrder
  );
  router.get(
    "/provider/orders",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        status: Joi.string().trim().max(80).optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    engagementController.listProviderOrders
  );
  router.patch(
    "/provider/orders/:orderId",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ orderId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("pending", "accepted", "fulfilled", "canceled", "rejected").required() })),
    engagementController.updateProviderOrder
  );

  return router;
};
