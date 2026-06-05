export class EngagementController {
  constructor({ engagementService }) {
    this.engagementService = engagementService;
  }

  recordProfileVisit = async (req, res, next) => {
    try {
      res.status(201).json({
        data: await this.engagementService.recordProfileVisit({
          actorUserId: req.user?.id ?? null,
          providerId: req.params.providerId,
          userAgent: req.headers["user-agent"],
          ...req.body
        })
      });
    } catch (e) {
      next(e);
    }
  };

  recordContactEvent = async (req, res, next) => {
    try {
      res.status(201).json({
        data: await this.engagementService.recordContactEvent({
          actorUserId: req.user?.id ?? null,
          providerId: req.params.providerId,
          ...req.body
        })
      });
    } catch (e) {
      next(e);
    }
  };

  recordSearchEvent = async (req, res, next) => {
    try {
      res.status(201).json({
        data: await this.engagementService.recordSearchEvent({
          actorUserId: req.user?.id ?? null,
          ...req.body
        })
      });
    } catch (e) {
      next(e);
    }
  };

  listFavorites = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.engagementService.listFavorites({ actorUserId: req.user.id }) });
    } catch (e) {
      next(e);
    }
  };

  addFavorite = async (req, res, next) => {
    try {
      res.status(201).json({
        data: await this.engagementService.addFavorite({ actorUserId: req.user.id, providerId: req.params.providerId })
      });
    } catch (e) {
      next(e);
    }
  };

  removeFavorite = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.removeFavorite({ actorUserId: req.user.id, providerId: req.params.providerId })
      });
    } catch (e) {
      next(e);
    }
  };

  listProviderReviews = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.listProviderReviews({ providerId: req.params.providerId, ...req.query })
      });
    } catch (e) {
      next(e);
    }
  };

  createReview = async (req, res, next) => {
    try {
      res.status(201).json({
        data: await this.engagementService.createReview({
          actorUserId: req.user.id,
          providerId: req.params.providerId,
          ...req.body
        })
      });
    } catch (e) {
      next(e);
    }
  };

  createInquiry = async (req, res, next) => {
    try {
      res.status(201).json({ data: await this.engagementService.createInquiry(req.body) });
    } catch (e) {
      next(e);
    }
  };

  listProviderInquiries = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.listProviderInquiries({ actorUserId: req.user.id, ...req.query })
      });
    } catch (e) {
      next(e);
    }
  };

  updateProviderInquiry = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.updateProviderInquiry({
          actorUserId: req.user.id,
          inquiryId: req.params.inquiryId,
          status: req.body.status
        })
      });
    } catch (e) {
      next(e);
    }
  };

  createOrder = async (req, res, next) => {
    try {
      res.status(201).json({ data: await this.engagementService.createOrder({ actorUserId: req.user.id, ...req.body }) });
    } catch (e) {
      next(e);
    }
  };

  listProviderOrders = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.listProviderOrders({ actorUserId: req.user.id, ...req.query })
      });
    } catch (e) {
      next(e);
    }
  };

  updateProviderOrder = async (req, res, next) => {
    try {
      res.status(200).json({
        data: await this.engagementService.updateProviderOrder({
          actorUserId: req.user.id,
          orderId: req.params.orderId,
          status: req.body.status
        })
      });
    } catch (e) {
      next(e);
    }
  };
}
