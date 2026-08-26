import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { defaultRateLimit } from "./middlewares/rateLimit.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { buildRoutes } from "./routes/index.js";

import { AuthService } from "./services/auth.service.js";
import { AuthController } from "./controllers/auth.controller.js";
import { ProviderService } from "./services/provider.service.js";
import { ProviderController } from "./controllers/provider.controller.js";
import { CategoryService } from "./services/category.service.js";
import { CategoryController } from "./controllers/category.controller.js";
import { ShopCategoryService } from "./services/shopCategory.service.js";
import { ShopCategoryController } from "./controllers/shopCategory.controller.js";
import { ListingService } from "./services/listing.service.js";
import { ListingController } from "./controllers/listing.controller.js";
import { AdminSettingsService } from "./services/adminSettings.service.js";
import { AdminSettingsController } from "./controllers/adminSettings.controller.js";
import { TransactionService } from "./services/transaction.service.js";
import { TransactionController } from "./controllers/transaction.controller.js";
import { PaymentService } from "./services/payment.service.js";
import { PaymentController } from "./controllers/payment.controller.js";
import { StorageService } from "./services/storage.service.js";
import { StorageController } from "./controllers/storage.controller.js";
import { AdminService } from "./services/admin.service.js";
import { AdminController } from "./controllers/admin.controller.js";
import { EngagementService } from "./services/engagement.service.js";
import { EngagementController } from "./controllers/engagement.controller.js";
import { SearchService } from "./services/search.service.js";
import { SearchController } from "./controllers/search.controller.js";
import { hashPassword, verifyPassword } from "./utils/password.js";
import { signAccessToken } from "./utils/jwt.js";
import { env } from "./config/env.js";

export const buildApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(defaultRateLimit);
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "sidra-backend" });
  });

  const authService = new AuthService({
    hashPassword,
    verifyPassword,
    signAccessToken,
    jwt: { secret: env.jwtSecret, issuer: env.jwtIssuer, accessTtlSeconds: env.jwtAccessTtlSeconds }
  });
  const authController = new AuthController({ authService });

  const providerService = new ProviderService({ hashPassword });
  const providerController = new ProviderController({ providerService });

  const categoryService = new CategoryService();
  const categoryController = new CategoryController({ categoryService });

  const shopCategoryService = new ShopCategoryService();
  const shopCategoryController = new ShopCategoryController({ shopCategoryService });

  const listingService = new ListingService();
  const listingController = new ListingController({ listingService });

  const adminSettingsService = new AdminSettingsService();
  const adminSettingsController = new AdminSettingsController({ adminSettingsService });

  const transactionService = new TransactionService();
  const transactionController = new TransactionController({ transactionService });

  const paymentService = new PaymentService();
  const paymentController = new PaymentController({ paymentService });

  const storageService = new StorageService();
  const storageController = new StorageController({ storageService });

  const adminService = new AdminService({ hashPassword, paymentService, transactionService });
  const adminController = new AdminController({ adminService });

  const engagementService = new EngagementService();
  const engagementController = new EngagementController({ engagementService });

  const searchService = new SearchService();
  const searchController = new SearchController({ searchService });

  app.use(
    "/api/v1",
    buildRoutes({
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
    })
  );
  app.use(errorMiddleware);

  return app;
};
