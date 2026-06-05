export class StorageController {
  constructor({ storageService }) {
    this.storageService = storageService;
  }

  createUploadUrl = async (req, res, next) => {
    try {
      const result = await this.storageService.createUploadUrl({
        actorUserId: req.user.id,
        role: req.user.role,
        contentType: req.body.contentType,
        folder: req.body.folder,
        filename: req.body.filename
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  registerAsset = async (req, res, next) => {
    try {
      const result = await this.storageService.registerAsset({
        actorUserId: req.user.id,
        role: req.user.role,
        ...req.body
      });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
