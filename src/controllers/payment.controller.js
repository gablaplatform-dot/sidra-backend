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

  purchaseProduct = async (req, res, next) => {
    try {
      const result = await this.paymentService.purchaseProduct({
        actorUserId: req.user.id,
        listingId: req.body.listingId,
        quantity: req.body.quantity,
        phone: req.body.phone
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  cartCheckout = async (req, res, next) => {
    try {
      const result = await this.paymentService.cartCheckout({
        actorUserId: req.user.id,
        items: req.body.items,
        phone: req.body.phone
      });
      res.status(200).json({ data: result });
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
  mobileMoneySuccessWebhook = async (req, res, next) => {
    try {
      const result = await this.paymentService.handleMobileMoneySuccess(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  mobileMoneyFailedWebhook = async (req, res, next) => {
    try {
      const result = await this.paymentService.handleMobileMoneyFailed(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}

