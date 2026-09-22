export class AdminRoleController {
  constructor({ adminRoleService }) {
    this.adminRoleService = adminRoleService;
  }

  list = async (_req, res, next) => {
    try {
      res.status(200).json({ data: await this.adminRoleService.list() });
    } catch (e) {
      next(e);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.adminRoleService.create({ ...req.body, actorId: req.user.id });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  update = async (req, res, next) => {
    try {
      const result = await this.adminRoleService.update({ roleId: req.params.roleId, patch: req.body, actorId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  remove = async (req, res, next) => {
    try {
      const result = await this.adminRoleService.remove({ roleId: req.params.roleId, actorId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
