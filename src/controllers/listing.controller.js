export class ListingController {
  constructor({ listingService }) {
    this.listingService = listingService;
  }

  create = async (req, res, next) => {
    try {
      const result = await this.listingService.createListing({ actorUserId: req.user.id, ...req.body });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  update = async (req, res, next) => {
    try {
      const result = await this.listingService.updateListing({
        actorUserId: req.user.id,
        listingId: req.params.listingId,
        updates: req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.listingService.deleteListing({
        actorUserId: req.user.id,
        listingId: req.params.listingId
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMine = async (req, res, next) => {
    try {
      const result = await this.listingService.listMine({
        actorUserId: req.user.id,
        ...req.query
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listByProvider = async (req, res, next) => {
    try {
      const result = await this.listingService.listByProvider({
        providerId: req.params.providerId,
        ...req.query
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  publicList = async (req, res, next) => {
    try {
      const result = await this.listingService.publicList(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getPublicListing = async (req, res, next) => {
    try {
      const result = await this.listingService.getPublicListing({ listingId: req.params.listingId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
