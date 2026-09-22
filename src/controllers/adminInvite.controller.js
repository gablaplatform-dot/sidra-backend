export class AdminInviteController {
  constructor({ adminInviteService }) {
    this.adminInviteService = adminInviteService;
  }

  list = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminInviteService.listInvites() });
    } catch (e) {
      next(e);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.adminInviteService.createInvite({ ...req.body, invitedById: req.user.id });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  resend = async (req, res, next) => {
    try {
      const result = await this.adminInviteService.resendInvite({ inviteId: req.params.inviteId, actorId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  revoke = async (req, res, next) => {
    try {
      const result = await this.adminInviteService.revokeInvite({ inviteId: req.params.inviteId, actorId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getInviteInfo = async (req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminInviteService.getInviteInfo({ token: req.params.token }) });
    } catch (e) {
      next(e);
    }
  };

  accept = async (req, res, next) => {
    try {
      const result = await this.adminInviteService.acceptInvite({ token: req.params.token, password: req.body.password });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
