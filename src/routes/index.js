import { Router } from "express";
import { buildAuthRoutes } from "./auth.routes.js";
import { buildProviderRoutes } from "./provider.routes.js";
import { buildCategoryRoutes } from "./category.routes.js";
import { buildShopCategoryRoutes } from "./shopCategory.routes.js";
import { buildListingRoutes } from "./listing.routes.js";
import { buildAdminSettingsRoutes } from "./adminSettings.routes.js";
import { buildAdminTransactionsRoutes } from "./adminTransactions.routes.js";
import { buildPaymentRoutes } from "./payment.routes.js";
import { buildStorageRoutes } from "./storage.routes.js";
import { buildAdminDataRoutes } from "./adminData.routes.js";
import { buildEngagementRoutes } from "./engagement.routes.js";
import { buildSearchRoutes } from "./search.routes.js";

export const buildRoutes = ({
  authController,
  providerController,
  categoryController,
  shopCategoryController,
  listingController,
  adminSettingsController,
  transactionController,
  paymentController,
  storageController,
  adminController,
  engagementController,
  searchController
}) => {
  const router = Router();

  router.get("/health", (_req, res) => res.status(200).json({ data: { ok: true } }));
  router.use("/auth", buildAuthRoutes({ authController }));
  router.use("/providers", buildProviderRoutes({ providerController }));
  router.use("/categories", buildCategoryRoutes({ categoryController }));
  router.use("/shop-categories", buildShopCategoryRoutes({ shopCategoryController }));
  router.use("/listings", buildListingRoutes({ listingController }));
  router.use("/payments", buildPaymentRoutes({ paymentController }));
  router.use("/storage", buildStorageRoutes({ storageController }));
  router.use("/engagement", buildEngagementRoutes({ engagementController }));
  router.use("/search", buildSearchRoutes({ searchController }));
  router.use("/admin", buildAdminDataRoutes({ adminController }));
  router.use("/admin", buildAdminSettingsRoutes({ adminSettingsController }));
  router.use("/admin", buildAdminTransactionsRoutes({ transactionController }));

  return router;
};
