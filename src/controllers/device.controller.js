export class DeviceController {
  constructor({ pushService }) {
    this.pushService = pushService;
  }

  registerToken = async (req, res, next) => {
    try {
      await this.pushService.registerToken({ userId: req.user.id, token: req.body.token, platform: req.body.platform });
      res.status(200).json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  };

  unregisterToken = async (req, res, next) => {
    try {
      await this.pushService.unregisterToken({ token: req.body.token });
      res.status(200).json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  };
}
