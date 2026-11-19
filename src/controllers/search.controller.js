export class SearchController {
  constructor({ searchService, aiSearchService }) {
    this.searchService = searchService;
    this.aiSearchService = aiSearchService;
  }

  imageSearch = async (req, res, next) => {
    try {
      const result = await this.aiSearchService.describeImage({ buffer: req.body, contentType: req.headers["content-type"]?.split(";")[0] });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  search = async (req, res, next) => {
    try {
      const result = await this.searchService.search(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
