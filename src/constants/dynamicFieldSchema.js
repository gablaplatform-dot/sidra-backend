import Joi from "joi";

// Shared shape for a single dynamic-field definition, used by both Category.providerFields/
// listingFields and ProductCategory.listingFields - one source of truth for what a "field" looks
// like, so the two systems can't quietly drift on which `type`s are valid. Rendered by
// public_app/src/components/DynamicField.jsx, which switches on exactly this `type` enum.
export const buildFieldSchema = () =>
  Joi.object({
    key: Joi.string().trim().max(80).required(),
    label: Joi.string().trim().max(120).required(),
    type: Joi.string()
      .valid("text", "textarea", "number", "boolean", "select", "multi_select", "date", "time", "url", "phone")
      .default("text"),
    required: Joi.boolean().optional(),
    options: Joi.array().items(Joi.string().trim().max(120)).default([]),
    unit: Joi.string().trim().max(40).allow(null).optional()
  });
