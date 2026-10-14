import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";
import { buildFieldSchema } from "../constants/dynamicFieldSchema.js";

// `extra` adds fields to the admin create/update bodies (the service-category tree reuses these routes).
export const buildProductCategoryRoutes = ({ productCategoryController, extra = {} }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const imageUrlField = Joi.string().uri({ scheme: ["http", "https"] }).max(1000).allow(null).optional();
  const listingFieldsField = Joi.array().items(buildFieldSchema()).optional();

  router.get("/", productCategoryController.listNested);

  router.get(
    "/roots",
    validate(Joi.object({ limit: Joi.number().integer().min(1).max(60).optional() }), "query"),
    productCategoryController.listRoots
  );

  router.post(
    "/mine",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        parentId: id.required(),
        imageUrl: imageUrlField
      })
    ),
    productCategoryController.createMine
  );

  router.post(
    "/",
    requireAuth([Roles.ADMIN]), requirePermission("categories"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        imageUrl: imageUrlField,
        isActive: Joi.boolean().optional(),
        listingFields: listingFieldsField,
        ...extra
      })
    ),
    productCategoryController.createCategory
  );

  router.post(
    "/sub",
    requireAuth([Roles.ADMIN]), requirePermission("categories"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        parentId: id.required(),
        imageUrl: imageUrlField,
        isActive: Joi.boolean().optional(),
        listingFields: listingFieldsField,
        ...extra
      })
    ),
    productCategoryController.createSubcategory
  );

  router.patch(
    "/reorder",
    requireAuth([Roles.ADMIN]), requirePermission("categories"),
    validate(
      Joi.object({
        parentId: id.allow(null).optional(),
        orderedIds: Joi.array().items(id.required()).min(1).required()
      })
    ),
    productCategoryController.reorderCategories
  );

  router.patch(
    "/:categoryId",
    requireAuth([Roles.ADMIN]), requirePermission("categories"),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).optional(),
        parentId: id.allow(null).optional(),
        imageUrl: imageUrlField,
        isActive: Joi.boolean().optional(),
        moderationStatus: Joi.string().valid("pending", "approved").optional(),
        listingFields: listingFieldsField,
        ...extra
      }).min(1)
    ),
    productCategoryController.updateCategory
  );

  router.delete("/:categoryId", requireAuth([Roles.ADMIN]), requirePermission("categories"), productCategoryController.deleteCategory);

  return router;
};
