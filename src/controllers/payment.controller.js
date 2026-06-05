export class PaymentController {
  constructor({ paymentService }) {
    this.paymentService = paymentService;
  }

  activateSubscription = async (req, res, next) => {
    try {
      const result = await this.paymentService.activateSubscription({
        actorUserId: req.user.id,
        amount: req.body.amount,
        days: req.body.days
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  unlockContact = async (req, res, next) => {
    try {
      const result = await this.paymentService.unlockContact({
        actorUserId: req.user.id,
        providerId: req.body.providerId
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
        quantity: req.body.quantity
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
}

