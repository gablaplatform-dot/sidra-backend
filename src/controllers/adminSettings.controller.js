export class AdminSettingsController {
  constructor({ adminSettingsService }) {
    this.adminSettingsService = adminSettingsService;
  }

  getGlobal = async (_req, res, next) => {
    try {
      const result = await this.adminSettingsService.getGlobal();
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateGlobal = async (req, res, next) => {
    try {
      const result = await this.adminSettingsService.updateGlobal(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getProviderSettings = async (req, res, next) => {
    try {
      const result = await this.adminSettingsService.getProviderSettings({ providerId: req.params.providerId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateProviderOverrides = async (req, res, next) => {
    try {
      const result = await this.adminSettingsService.setProviderOverrides({
        providerId: req.params.providerId,
        overrides: req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}

