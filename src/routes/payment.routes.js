import { Router } from "express";
import Joi from "joi";

import { requireAuth, optionalAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { Roles } from "../constants/enums.js";

export const buildPaymentRoutes = ({ paymentController }) => {
  const router = Router();
  const id = Joi.string().trim().min(1).max(64);
  const money = Joi.alternatives().try(Joi.number().min(0), Joi.string().pattern(/^\d+(\.\d{1,2})?$/));
  const note = Joi.string().trim().max(2000).allow(null).optional();
  const phone = Joi.string().trim().min(6).max(20).required();

  router.post(
    "/subscriptions/activate",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ phone })),
    paymentController.activateSubscription
  );

  router.get("/subscription", requireAuth([Roles.PROVIDER]), paymentController.getMySubscription);

  // Unlocking a provider's contact doesn't require an account — anyone can pay by mobile money
  // anonymously. optionalAuth still attaches actorUserId when a session is present, so logged-in
  // customers get the "already unlocked" convenience on return visits; anonymous ones don't.
  router.post(
    "/contacts/unlock",
    optionalAuth(),
    validate(Joi.object({ providerId: id.required(), phone })),
    paymentController.unlockContact
  );

  router.post(
    "/products/purchase",
    requireAuth([Roles.USER, Roles.PROVIDER]),
    validate(
      Joi.object({
        listingId: id.required(),
        quantity: Joi.number().integer().min(1).max(99).optional(),
        phone
      })
    ),
    paymentController.purchaseProduct
  );

  // Also polled by anonymous contact-unlock payments — see optionalAuth note above. The
  // transaction id is an unguessable cuid, and the service matches it against the exact
  // (possibly null) userId that created it, so this stays scoped to the poller's own payment.
  router.get(
    "/transactions/:transactionId/status",
    optionalAuth(),
    validate(Joi.object({ transactionId: id.required() }), "params"),
    paymentController.getTransactionStatus
  );

  // Public mobile money gateway webhooks — no user session, verified against a matching
  // transaction record instead (see PaymentService#handleMobileMoneySuccess/Failed).
  router.post("/webhooks/mobilemoney/success", paymentController.mobileMoneySuccessWebhook);
  router.post("/webhooks/mobilemoney/failed", paymentController.mobileMoneyFailedWebhook);

  router.get("/wallet", requireAuth([Roles.PROVIDER]), paymentController.getMyWallet);

  router.get(
    "/transactions",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(200).optional(),
        status: Joi.string().trim().max(40).optional(),
        type: Joi.string().trim().max(40).optional()
      }),
      "query"
    ),
    paymentController.listMyTransactions
  );

  router.get(
    "/withdrawals",
    requireAuth([Roles.PROVIDER]),
    validate(
      Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
      }),
      "query"
    ),
    paymentController.listMyWithdrawals
  );

  router.post(
    "/withdrawals",
    requireAuth([Roles.PROVIDER]),
    validate(Joi.object({ amount: money.required(), note })),
    paymentController.requestWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/approve",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminApproveWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/reject",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminRejectWithdrawal
  );

  router.post(
    "/admin/withdrawals/:withdrawalRequestId/mark-paid",
    requireAuth([Roles.ADMIN]),
    validate(Joi.object({ withdrawalRequestId: id.required() }), "params"),
    validate(Joi.object({ note })),
    paymentController.adminMarkWithdrawalPaid
  );

  return router;
};
