export class SearchController {
  constructor({ searchService }) {
    this.searchService = searchService;
  }

  search = async (req, res, next) => {
    try {
      const result = await this.searchService.search(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
