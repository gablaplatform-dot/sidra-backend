export class ProductCategoryController {
  constructor({ productCategoryService }) {
    this.productCategoryService = productCategoryService;
  }

  createCategory = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.createCategory(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  createSubcategory = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.createSubcategory(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  createMine = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.createFromProvider({ actorUserId: req.user.id, ...req.body });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateCategory = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.updateCategory({ id: req.params.categoryId, ...req.body });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  deleteCategory = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.deleteCategory({ id: req.params.categoryId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  reorderCategories = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.reorderCategories(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listNested = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.getNestedCategories();
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listRoots = async (req, res, next) => {
    try {
      const result = await this.productCategoryService.listRoots(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
