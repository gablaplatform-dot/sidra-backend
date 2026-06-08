export class CategoryController {
  constructor({ categoryService }) {
    this.categoryService = categoryService;
  }

  createCategory = async (req, res, next) => {
    try {
      const result = await this.categoryService.createCategory(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  createSubcategory = async (req, res, next) => {
    try {
      const result = await this.categoryService.createSubcategory(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateCategory = async (req, res, next) => {
    try {
      const result = await this.categoryService.updateCategory({
        id: req.params.categoryId,
        ...req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  deleteCategory = async (req, res, next) => {
    try {
      const result = await this.categoryService.deleteCategory({ id: req.params.categoryId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  reorderCategories = async (req, res, next) => {
    try {
      const result = await this.categoryService.reorderCategories(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listNested = async (_req, res, next) => {
    try {
      const result = await this.categoryService.getNestedCategories();
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
