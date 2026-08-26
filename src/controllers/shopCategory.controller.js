export class ShopCategoryController {
  constructor({ shopCategoryService }) {
    this.shopCategoryService = shopCategoryService;
  }

  listMine = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.listMine({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listForProvider = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.listForProvider({ providerId: req.params.providerId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.create({
        actorUserId: req.user.id,
        name: req.body.name,
        parentId: req.body.parentId
      });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  update = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.update({
        actorUserId: req.user.id,
        id: req.params.shopCategoryId,
        name: req.body.name,
        parentId: req.body.parentId
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.remove({ actorUserId: req.user.id, id: req.params.shopCategoryId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  reorder = async (req, res, next) => {
    try {
      const result = await this.shopCategoryService.reorder({
        actorUserId: req.user.id,
        parentId: req.body.parentId,
        orderedIds: req.body.orderedIds
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
