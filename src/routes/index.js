import Joi from "joi";
import { Router } from "express";
import { buildAuthRoutes } from "./auth.routes.js";
import { buildProviderRoutes } from "./provider.routes.js";
import { buildCategoryRoutes } from "./category.routes.js";
import { buildProductCategoryRoutes } from "./productCategory.routes.js";
import { buildShopCategoryRoutes } from "./shopCategory.routes.js";
import { buildListingRoutes } from "./listing.routes.js";
import { buildAdminSettingsRoutes } from "./adminSettings.routes.js";
import { buildAdminTransactionsRoutes } from "./adminTransactions.routes.js";
import { buildPaymentRoutes } from "./payment.routes.js";
import { buildStorageRoutes } from "./storage.routes.js";
import { buildAdminDataRoutes } from "./adminData.routes.js";
import { buildAdminRoleRoutes } from "./adminRole.routes.js";
import { buildAdminInviteRoutes } from "./adminInvite.routes.js";
import { buildEngagementRoutes } from "./engagement.routes.js";
import { buildSearchRoutes } from "./search.routes.js";
import { buildRideRoutes } from "./ride.routes.js";
import { buildPromotionRoutes } from "./promotion.routes.js";
import { buildInterestRoutes } from "./interest.routes.js";
import { buildBusRoutes } from "./bus.routes.js";
import { buildDocumentRoutes } from "./document.routes.js";
import { buildBookingRoutes } from "./booking.routes.js";
import { buildAiAdminRoutes } from "./aiAdmin.routes.js";

export const buildRoutes = ({
  authController,
  providerController,
  categoryController,
  productCategoryController,
  serviceCategoryController,
  shopCategoryController,
  listingController,
  adminSettingsController,
  transactionController,
  paymentController,
  storageController,
  adminController,
  adminRoleController,
  adminInviteController,
  engagementController,
  searchController,
  rideController,
  promotionController,
  interestController,
  bus,
  documentService,
  aiSettingsService,
  aiSearchService,
  serviceBookingService
}) => {
  const router = Router();

  router.get("/health", (_req, res) => res.status(200).json({ data: { ok: true } }));
  router.use("/auth", buildAuthRoutes({ authController }));
  router.use("/providers", buildProviderRoutes({ providerController }));
  router.use("/categories", buildCategoryRoutes({ categoryController }));
  router.use("/product-categories", buildProductCategoryRoutes({ productCategoryController }));
  router.use(
    "/service-categories",
    buildProductCategoryRoutes({
      productCategoryController: serviceCategoryController,
      extra: {
        bookable: Joi.boolean().optional(),
        bookingUnit: Joi.string().valid("night", "day", "hour").allow(null, "").optional()
      }
    })
  );
  router.use("/shop-categories", buildShopCategoryRoutes({ shopCategoryController }));
  router.use("/listings", buildListingRoutes({ listingController }));
  router.use("/payments", buildPaymentRoutes({ paymentController }));
  router.use("/storage", buildStorageRoutes({ storageController }));
  router.use("/engagement", buildEngagementRoutes({ engagementController }));
  router.use("/search", buildSearchRoutes({ searchController }));
  router.use("/rides", buildRideRoutes({ rideController }));
  router.use("/promotions", buildPromotionRoutes({ promotionController }));
  router.use("/interest", buildInterestRoutes({ interestController }));
  router.use("/bus", buildBusRoutes(bus));
  router.use("/bookings", buildBookingRoutes({ serviceBookingService }));
  router.use("/documents", buildDocumentRoutes({ documentService }));
  router.use("/admin", buildAdminDataRoutes({ adminController }));
  router.use("/admin", buildAdminSettingsRoutes({ adminSettingsController }));
  router.use("/admin/ai", buildAiAdminRoutes({ aiSettingsService, aiSearchService }));
  router.use("/admin", buildAdminTransactionsRoutes({ transactionController }));
  router.use("/admin/roles", buildAdminRoleRoutes({ adminRoleController }));
  router.use("/admin-invites", buildAdminInviteRoutes({ adminInviteController }));

  return router;
};
