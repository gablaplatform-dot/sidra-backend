export class AdminController {
  constructor({ adminService }) {
    this.adminService = adminService;
  }

  dashboard = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.dashboard() });
    } catch (e) {
      next(e);
    }
  };

  permissions = async (_req, res, next) => {
    try {
      res.status(200).json({ data: this.adminService.permissions() });
    } catch (e) {
      next(e);
    }
  };

  reports = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.reports(req.query) });
    } catch (e) {
      next(e);
    }
  };

  listUsers = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listUsers(req.query) });
    } catch (e) {
      next(e);
    }
  };

  setUserStatus = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.setUserStatus({ userId: req.params.userId, isActive: req.body.isActive }) });
    } catch (e) {
      next(e);
    }
  };

  listProviders = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listProviders(req.query) });
    } catch (e) {
      next(e);
    }
  };

  setProviderStatus = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.setProviderStatus({ providerId: req.params.providerId, status: req.body.status }) });
    } catch (e) {
      next(e);
    }
  };

  setProviderOnlinePayments = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.adminService.setProviderOnlinePayments({ providerId: req.params.providerId, enabled: req.body.enabled })
      });
    } catch (e) {
      next(e);
    }
  };

  deleteProvider = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.deleteProvider({ providerId: req.params.providerId }) });
    } catch (e) {
      next(e);
    }
  };

  listCategories = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listCategories() });
    } catch (e) {
      next(e);
    }
  };

  listListings = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listListings(req.query) });
    } catch (e) {
      next(e);
    }
  };

  updateListing = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.updateListing({ listingId: req.params.listingId, patch: req.body }) });
    } catch (e) {
      next(e);
    }
  };

  createListing = async (req, res, next) => {
    try {
      res.status(201).json({ data: await this.adminService.createListing(req.body) });
    } catch (e) {
      next(e);
    }
  };

  deleteListing = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.deleteListing({ listingId: req.params.listingId }) });
    } catch (e) {
      next(e);
    }
  };

  listTransactions = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listTransactions(req.query) });
    } catch (e) {
      next(e);
    }
  };

  getPlatformWallet = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.getPlatformWallet() });
    } catch (e) {
      next(e);
    }
  };

  listPlatformWalletTransactions = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listPlatformWalletTransactions(req.query) });
    } catch (e) {
      next(e);
    }
  };

  getPlatformRevenueByType = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.getPlatformRevenueByType() });
    } catch (e) {
      next(e);
    }
  };

  platformWithdraw = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.adminService.platformWithdraw({
          adminUserId: req.user.id,
          amount: req.body.amount,
          phone: req.body.phone,
          type: req.body.type,
          note: req.body.note
        })
      });
    } catch (e) {
      next(e);
    }
  };

  listWallets = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listWallets() });
    } catch (e) {
      next(e);
    }
  };

  listWithdrawals = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listWithdrawals() });
    } catch (e) {
      next(e);
    }
  };

  approveWithdrawal = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.adminService.approveWithdrawal({
          adminUserId: req.user.id,
          withdrawalRequestId: req.params.withdrawalRequestId,
          note: req.body.note
        })
      });
    } catch (e) {
      next(e);
    }
  };

  rejectWithdrawal = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.adminService.rejectWithdrawal({
          adminUserId: req.user.id,
          withdrawalRequestId: req.params.withdrawalRequestId,
          note: req.body.note
        })
      });
    } catch (e) {
      next(e);
    }
  };

  markWithdrawalPaid = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.adminService.markWithdrawalPaid({
          adminUserId: req.user.id,
          withdrawalRequestId: req.params.withdrawalRequestId,
          note: req.body.note
        })
      });
    } catch (e) {
      next(e);
    }
  };

  listSubscriptions = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listSubscriptions() });
    } catch (e) {
      next(e);
    }
  };

  listReviews = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listReviews(req.query) });
    } catch (e) {
      next(e);
    }
  };

  updateReview = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.updateReview({ reviewId: req.params.reviewId, status: req.body.status }) });
    } catch (e) {
      next(e);
    }
  };

  listInquiries = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listInquiries(req.query) });
    } catch (e) {
      next(e);
    }
  };

  updateInquiry = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.updateInquiry({ inquiryId: req.params.inquiryId, status: req.body.status }) });
    } catch (e) {
      next(e);
    }
  };

  listOrders = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listOrders(req.query) });
    } catch (e) {
      next(e);
    }
  };

  updateOrder = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.updateOrder({ orderId: req.params.orderId, status: req.body.status }) });
    } catch (e) {
      next(e);
    }
  };

  listMedia = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listMedia(req.query) });
    } catch (e) {
      next(e);
    }
  };

  deleteMedia = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.deleteMedia({ mediaId: req.params.mediaId }) });
    } catch (e) {
      next(e);
    }
  };

  listAdmins = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.listAdmins() });
    } catch (e) {
      next(e);
    }
  };

  createAdmin = async (req, res, next) => {
    try {
      res.status(201).json({ data: await this.adminService.createAdmin(req.body) });
    } catch (e) {
      next(e);
    }
  };

  updateAdmin = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminService.updateAdmin({ adminId: req.params.adminId, patch: req.body }) });
    } catch (e) {
      next(e);
    }
  };
}
