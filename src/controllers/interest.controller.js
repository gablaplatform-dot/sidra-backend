export class InterestController {
  constructor({ interestService }) {
    this.interestService = interestService;
  }

  // Signed-in shoppers are identified by their account (optional auth), anonymous ones by device id.
  _actor(req, deviceId) {
    return { userId: req.user?.id ?? null, deviceId: deviceId ?? null };
  }

  track = async (req, res, next) => {
    try {
      const { deviceId, ...event } = req.body;
      const result = await this.interestService.track({ ...this._actor(req, deviceId), ...event });
      res.status(202).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  forYou = async (req, res, next) => {
    try {
      const { deviceId, ...options } = req.query;
      const result = await this.interestService.forYou({ ...this._actor(req, deviceId), ...options });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  claim = async (req, res, next) => {
    try {
      const result = await this.interestService.claim({ userId: req.user.id, deviceId: req.body.deviceId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  clear = async (req, res, next) => {
    try {
      const result = await this.interestService.clear(this._actor(req, req.query.deviceId));
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
