export class PromotionController {
  constructor({ promotionService }) {
    this.promotionService = promotionService;
  }

  listAdmin = async (req, res, next) => {
    try {
      const result = await this.promotionService.listAdmin(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listFeatured = async (req, res, next) => {
    try {
      const result = await this.promotionService.listFeatured(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req, res, next) => {
    try {
      const result = await this.promotionService.getById({ id: req.params.promotionId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.promotionService.create(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  update = async (req, res, next) => {
    try {
      const result = await this.promotionService.update({
        id: req.params.promotionId,
        updates: req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.promotionService.remove({ id: req.params.promotionId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listNearbyAds = async (req, res, next) => {
    try {
      const result = await this.promotionService.listNearbyAds(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMine = async (req, res, next) => {
    try {
      const result = await this.promotionService.listMine({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  createMine = async (req, res, next) => {
    try {
      const result = await this.promotionService.createFromProvider({ actorUserId: req.user.id, ...req.body });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateMine = async (req, res, next) => {
    try {
      const result = await this.promotionService.updateMine({
        actorUserId: req.user.id,
        id: req.params.promotionId,
        updates: req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  deleteMine = async (req, res, next) => {
    try {
      const result = await this.promotionService.deleteMine({ actorUserId: req.user.id, id: req.params.promotionId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
