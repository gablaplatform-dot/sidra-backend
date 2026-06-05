import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { CategoryBehavior, CategoryViewType, Roles } from "../constants/enums.js";

export const buildCategoryRoutes = ({ categoryController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const fieldSchema = Joi.object({
    key: Joi.string().trim().max(80).required(),
    label: Joi.string().trim().max(120).required(),
    type: Joi.string()
      .valid("text", "textarea", "number", "boolean", "select", "multi_select", "date", "time", "url", "phone")
      .default("text"),
    required: Joi.boolean().optional(),
    options: Joi.array().items(Joi.string().trim().max(120)).default([]),
    unit: Joi.string().trim().max(40).allow(null).optional()
  });

  router.get("/", categoryController.listNested);

  router.post(
    "/",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        behavior: Joi.string().valid(...Object.values(CategoryBehavior)).optional(),
        viewType: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        appView: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        providerFields: Joi.array().items(fieldSchema).optional(),
        listingFields: Joi.array().items(fieldSchema).optional(),
        settings: Joi.object().unknown(true).optional()
      })
    ),
    categoryController.createCategory
  );

  router.post(
    "/sub",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).required(),
        parentId: id.required(),
        behavior: Joi.string().valid(...Object.values(CategoryBehavior)).optional(),
        viewType: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        appView: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        providerFields: Joi.array().items(fieldSchema).optional(),
        listingFields: Joi.array().items(fieldSchema).optional(),
        settings: Joi.object().unknown(true).optional()
      })
    ),
    categoryController.createSubcategory
  );

  router.patch(
    "/:categoryId",
    requireAuth([Roles.ADMIN]),
    validate(
      Joi.object({
        name: Joi.string().trim().max(120).optional(),
        parentId: id.allow(null).optional(),
        behavior: Joi.string().valid(...Object.values(CategoryBehavior)).optional(),
        viewType: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        appView: Joi.string().valid(...Object.values(CategoryViewType)).optional(),
        providerFields: Joi.array().items(fieldSchema).optional(),
        listingFields: Joi.array().items(fieldSchema).optional(),
        settings: Joi.object().unknown(true).optional()
      }).min(1)
    ),
    categoryController.updateCategory
  );

  router.delete("/:categoryId", requireAuth([Roles.ADMIN]), categoryController.deleteCategory);

  return router;
};
