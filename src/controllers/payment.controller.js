import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
export class PaymentController {
  constructor({ paymentService }) {
    this.paymentService = paymentService;
  }

  activateSubscription = async (req, res, next) => {
    try {
      const result = await this.paymentService.activateSubscription({
        actorUserId: req.user.id,
        phone: req.body.phone
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getMySubscription = async (req, res, next) => {
    try {
      const result = await this.paymentService.getMySubscription({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  unlockContact = async (req, res, next) => {
    try {
      const result = await this.paymentService.unlockContact({
        actorUserId: req.user?.id ?? null,
        providerId: req.body.providerId,
        phone: req.body.phone
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  payOrder = async (req, res, next) => {
    try {
      const result = await this.paymentService.payOrder({ actorUserId: req.user.id, orderId: req.params.orderId, phone: req.body.phone });
      res.status(202).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  payBooking = async (req, res, next) => {
    try {
      const result = await this.paymentService.payServiceBooking({ actorUserId: req.user.id, bookingId: req.params.bookingId, phone: req.body.phone });
      res.status(202).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getTransactionStatus = async (req, res, next) => {
    try {
      const result = await this.paymentService.getTransactionStatus({
        actorUserId: req.user?.id ?? null,
        transactionId: req.params.transactionId
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getMyWallet = async (req, res, next) => {
    try {
      const result = await this.paymentService.getMyWallet({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMyTransactions = async (req, res, next) => {
    try {
      const result = await this.paymentService.listMyTransactions({
        actorUserId: req.user.id,
        ...req.query
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMyWithdrawals = async (req, res, next) => {
    try {
      const result = await this.paymentService.listMyWithdrawals({
        actorUserId: req.user.id,
        ...req.query
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  requestWithdrawal = async (req, res, next) => {
    try {
      const result = await this.paymentService.requestWithdrawal({
        actorUserId: req.user.id,
        amount: req.body.amount,
        note: req.body.note
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminApproveWithdrawal = async (req, res, next) => {
    try {
      const result = await this.paymentService.adminApproveWithdrawal({
        adminUserId: req.user.id,
        withdrawalRequestId: req.params.withdrawalRequestId,
        note: req.body.note
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminRejectWithdrawal = async (req, res, next) => {
    try {
      const result = await this.paymentService.adminRejectWithdrawal({
        adminUserId: req.user.id,
        withdrawalRequestId: req.params.withdrawalRequestId,
        note: req.body.note
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminMarkWithdrawalPaid = async (req, res, next) => {
    try {
      const result = await this.paymentService.adminMarkWithdrawalPaid({
        adminUserId: req.user.id,
        withdrawalRequestId: req.params.withdrawalRequestId,
        note: req.body.note
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  // Public webhooks called by the mobile money gateway itself — no user session, so any
  // trust decision happens inside the service by matching against a transaction we created.
  // Refuses (or, until enforcement is switched on, just logs) a callback that lacks the secret key we put in its URL.
  assertWebhookKey(req) {
    if (this.paymentService.verifyWebhookKey(req.query?.k)) return;
    if (env.mobileMoneyWebhookEnforce) {
      throw new AppError({ message: "Forbidden", statusCode: 403, code: "WEBHOOK_FORBIDDEN" });
    }
    process.stderr.write(`[webhook] payment callback without a valid key (ref ${req.body?.external_ref ?? req.body?.failed_transaction_reference ?? "?"}); enforcement is off\n`);
  }

  mobileMoneySuccessWebhook = async (req, res, next) => {
    try {
      this.assertWebhookKey(req);
      const result = await this.paymentService.handleMobileMoneySuccess(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  mobileMoneyFailedWebhook = async (req, res, next) => {
    try {
      this.assertWebhookKey(req);
      const result = await this.paymentService.handleMobileMoneyFailed(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}

