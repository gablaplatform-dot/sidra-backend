import { Router } from "express";
import Joi from "joi";

import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { CategoryViewType, ProviderModerationStatus, Roles, ServiceProductStatus, ServiceProductType, TransactionStatus, TransactionType } from "../constants/enums.js";

export const buildAdminDataRoutes = ({ adminController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  router.use(requireAuth([Roles.ADMIN]));

  // No requirePermission gate - every admin (any role) can see the dashboard and the permission
  // catalog itself.
  router.get("/dashboard", adminController.dashboard);
  router.get("/permissions", adminController.permissions);
  router.get(
    "/reports",
    requirePermission("reports"),
    validate(
      Joi.object({
        from: Joi.date().iso().optional(),
        to: Joi.date().iso().optional()
      }),
      "query"
    ),
    adminController.reports
  );
  router.get(
    "/users",
    requirePermission("users"),
    validate(
      Joi.object({
        q: Joi.string().trim().max(200).optional(),
        role: Joi.string().valid(...Object.values(Roles)).optional(),
        status: Joi.string().valid("active", "suspended").optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listUsers
  );
  router.patch(
    "/users/:userId/status",
    requirePermission("users"),
    validate(Joi.object({ userId: id.required() }), "params"),
    validate(Joi.object({ isActive: Joi.boolean().required() })),
    adminController.setUserStatus
  );

  router.get(
    "/providers",
    requirePermission("providers"),
    validate(
      Joi.object({
        q: Joi.string().trim().max(200).optional(),
        status: Joi.string().valid(...Object.values(ProviderModerationStatus)).optional(),
        categoryId: id.optional(),
        subscriptionStatus: Joi.string().trim().max(32).optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listProviders
  );
  router.patch(
    "/providers/:providerId/status",
    requirePermission("providers"),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid(...Object.values(ProviderModerationStatus)).required() })),
    adminController.setProviderStatus
  );
  router.patch(
    "/providers/:providerId/online-payments",
    requirePermission("providers"),
    validate(Joi.object({ providerId: id.required() }), "params"),
    validate(Joi.object({ enabled: Joi.boolean().required() })),
    adminController.setProviderOnlinePayments
  );
  router.delete(
    "/providers/:providerId",
    requirePermission("providers"),
    validate(Joi.object({ providerId: id.required() }), "params"),
    adminController.deleteProvider
  );

  router.get(
    "/categories",
    requirePermission("categories"),
    validate(
      Joi.object({
        viewType: Joi.string().valid(...Object.values(CategoryViewType)).optional()
      }),
      "query"
    ),
    adminController.listCategories
  );
  router.get("/product-categories", requirePermission("categories"), adminController.listProductCategories);
  router.get(
    "/listings",
    requirePermission("listings"),
    validate(
      Joi.object({
        q: Joi.string().trim().max(200).optional(),
        type: Joi.string().valid(...Object.values(ServiceProductType)).optional(),
        status: Joi.string().valid(...Object.values(ServiceProductStatus)).optional(),
        providerId: id.optional(),
        categoryId: id.optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listListings
  );
  router.post(
    "/listings",
    requirePermission("listings"),
    validate(
      Joi.object({
        providerId: id.required(),
        name: Joi.string().trim().max(200).required(),
        description: Joi.string().trim().max(5000).allow("").optional(),
        price: Joi.number().min(0).optional(),
        type: Joi.string().valid(...Object.values(ServiceProductType)).required(),
        status: Joi.string().valid(...Object.values(ServiceProductStatus)).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional(),
        media: Joi.object().unknown(true).optional(),
        customFields: Joi.object().unknown(true).optional()
      })
    ),
    adminController.createListing
  );
  router.patch(
    "/listings/:listingId",
    requirePermission("listings"),
    validate(Joi.object({ listingId: id.required() }), "params"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).optional(),
        description: Joi.string().trim().max(5000).allow("").optional(),
        price: Joi.number().min(0).optional(),
        type: Joi.string().valid(...Object.values(ServiceProductType)).optional(),
        status: Joi.string().valid(...Object.values(ServiceProductStatus)).optional(),
        featured: Joi.boolean().optional(),
        onlinePaymentEnabled: Joi.boolean().optional(),
        media: Joi.object().unknown(true).optional(),
        customFields: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    adminController.updateListing
  );
  router.delete(
    "/listings/:listingId",
    requirePermission("listings"),
    validate(Joi.object({ listingId: id.required() }), "params"),
    adminController.deleteListing
  );

  router.get(
    "/transactions",
    requirePermission("transactions"),
    validate(
      Joi.object({
        type: Joi.string().valid(...Object.values(TransactionType)).optional(),
        status: Joi.string().valid(...Object.values(TransactionStatus)).optional(),
        providerId: id.optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listTransactions
  );
  router.get("/platform-wallet", requirePermission("wallets"), adminController.getPlatformWallet);
  router.get("/platform-wallet/revenue-by-type", requirePermission("wallets"), adminController.getPlatformRevenueByType);
  router.get(
    "/platform-wallet/transactions",
    requirePermission("wallets"),
    validate(
      Joi.object({
        type: Joi.string().valid(...Object.values(TransactionType)).optional(),
        status: Joi.string().valid(...Object.values(TransactionStatus)).optional(),
        from: Joi.date().iso().optional(),
        to: Joi.date().iso().optional(),
        sort: Joi.string().valid("newest", "oldest", "amount").optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listPlatformWalletTransactions
  );
  router.post(
    "/platform-wallet/withdraw",
    requirePermission("wallets"),
    validate(
      Joi.object({
        amount: Joi.alternatives().try(Joi.number().min(0), Joi.string().pattern(/^\d+(\.\d{1,2})?$/)).required(),
        phone: Joi.string().trim().min(6).max(20).required(),
        type: Joi.string().valid("contact_unlock", "subscription", "purchase").optional(),
        note: Joi.string().trim().max(2000).allow(null).optional()
      })
    ),
    adminController.platformWithdraw
  );
  router.get("/wallets", requirePermission("wallets"), adminController.listWallets);
  router.get("/withdrawals", requirePermission("wallets"), adminController.listWithdrawals);
  router.post(
    "/withdrawals/:withdrawalRequestId/approve",
    requirePermission("wallets"),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note: Joi.string().trim().max(2000).allow(null).optional() })),
    adminController.approveWithdrawal
  );
  router.post(
    "/withdrawals/:withdrawalRequestId/reject",
    requirePermission("wallets"),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note: Joi.string().trim().max(2000).allow(null).optional() })),
    adminController.rejectWithdrawal
  );
  router.post(
    "/withdrawals/:withdrawalRequestId/mark-paid",
    requirePermission("wallets"),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note: Joi.string().trim().max(2000).allow(null).optional() })),
    adminController.markWithdrawalPaid
  );
  router.get("/subscriptions", requirePermission("subscriptions"), adminController.listSubscriptions);
  router.get(
    "/reviews",
    requirePermission("reviews"),
    validate(
      Joi.object({
        status: Joi.string().valid("pending", "approved", "rejected", "archived").optional(),
        providerId: id.optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listReviews
  );
  router.patch(
    "/reviews/:reviewId",
    requirePermission("reviews"),
    validate(Joi.object({ reviewId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("pending", "approved", "rejected", "archived").required() })),
    adminController.updateReview
  );
  router.get(
    "/inquiries",
    requirePermission("inquiries"),
    validate(
      Joi.object({
        status: Joi.string().valid("new", "open", "closed", "archived").optional(),
        providerId: id.optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listInquiries
  );
  router.patch(
    "/inquiries/:inquiryId",
    requirePermission("inquiries"),
    validate(Joi.object({ inquiryId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("new", "open", "closed", "archived").required() })),
    adminController.updateInquiry
  );
  router.get(
    "/orders",
    requirePermission("orders"),
    validate(
      Joi.object({
        status: Joi.string().valid("pending", "accepted", "fulfilled", "canceled", "rejected").optional(),
        providerId: id.optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listOrders
  );
  router.patch(
    "/orders/:orderId",
    requirePermission("orders"),
    validate(Joi.object({ orderId: id.required() }), "params"),
    validate(Joi.object({ status: Joi.string().valid("pending", "accepted", "fulfilled", "canceled", "rejected").required() })),
    adminController.updateOrder
  );
  router.get(
    "/media",
    requirePermission("media"),
    validate(
      Joi.object({
        kind: Joi.string().trim().max(80).optional(),
        providerId: id.optional(),
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional()
      }),
      "query"
    ),
    adminController.listMedia
  );
  router.delete(
    "/media/:mediaId",
    requirePermission("media"),
    validate(Joi.object({ mediaId: id.required() }), "params"),
    adminController.deleteMedia
  );
  router.get("/admins", requirePermission("adminroles"), adminController.listAdmins);
  // Admin account creation happens only via POST /admin-invites (email-invite flow) - see
  // adminInvite.routes.js.
  router.patch(
    "/admins/:adminId",
    requirePermission("adminroles"),
    validate(Joi.object({ adminId: id.required() }), "params"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(200).optional(),
        phone: Joi.string().trim().max(32).allow(null).optional(),
        isActive: Joi.boolean().optional(),
        roleId: id.optional()
      }).min(1)
    ),
    adminController.updateAdmin
  );

  return router;
};
