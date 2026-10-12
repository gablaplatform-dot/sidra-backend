import { Router } from "express";
import Joi from "joi";

import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { Roles } from "../constants/enums.js";

const id = Joi.string().trim().min(1).max(64);

export const buildDocumentRoutes = ({ documentService }) => {
  const router = Router();
  const json = (fn) => async (req, res, next) => {
    try {
      res.status(200).json({ data: await fn(req) });
    } catch (e) {
      next(e);
    }
  };
  const provider = requireAuth([Roles.PROVIDER]);
  const providerId = async (req) => (await documentService.providerForUser(req.user.id)).id;

  router.get("/settings", provider, json(async (req) => documentService.getSettings(await providerId(req))));
  router.put("/settings", provider, validate(Joi.object().unknown(true)), json(async (req) => documentService.updateSettings(await providerId(req), req.body)));

  // PDF of sample content in the template being edited, for the live preview.
  router.post(
    "/preview",
    provider,
    validate(Joi.object({ type: Joi.string().valid("quotation", "receipt").default("quotation"), settings: Joi.object().unknown(true).default({}) })),
    async (req, res, next) => {
      try {
        const pdf = await documentService.previewPdf(await providerId(req), req.body);
        res.set({ "Content-Type": "application/pdf", "Cache-Control": "no-store" }).status(200).send(pdf);
      } catch (e) {
        next(e);
      }
    }
  );

  router.get(
    "/",
    provider,
    validate(Joi.object({ type: Joi.string().valid("quotation", "receipt").optional(), page: Joi.number().integer().min(1).optional(), limit: Joi.number().integer().min(1).max(100).optional() }), "query"),
    json(async (req) => documentService.listForProvider(await providerId(req), req.query))
  );

  // Issue (or revise) the quotation for an order and email it to the buyer.
  router.post(
    "/orders/:orderId/quotation",
    provider,
    validate(
      Joi.object({
        discount: Joi.number().min(0).max(1e10).default(0),
        deliveryFee: Joi.number().min(0).max(1e10).default(0),
        note: Joi.string().trim().max(600).allow("").default(""),
        validityDays: Joi.number().integer().min(1).max(365).optional(),
        send: Joi.boolean().default(true)
      })
    ),
    json(async (req) => {
      const { send, ...adjustments } = req.body;
      return documentService.issueQuotation({ orderId: req.params.orderId, adjustments, send, actingProviderId: await providerId(req) });
    })
  );

  router.post("/:documentId/resend", provider, validate(Joi.object({ documentId: id.required() }), "params"), json(async (req) => documentService.resend({ documentId: req.params.documentId, providerId: await providerId(req) })));

  // The PDF itself: the buyer it was issued to, the seller who issued it, or an admin.
  router.get("/:documentId/pdf", requireAuth(), validate(Joi.object({ documentId: id.required() }), "params"), async (req, res, next) => {
    try {
      const { pdf, filename } = await documentService.pdfFor({ documentId: req.params.documentId, actor: req.user });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store" }).status(200).send(pdf);
    } catch (e) {
      next(e);
    }
  });

  return router;
};
