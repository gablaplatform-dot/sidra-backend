import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

export class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  registerUser = async (req, res, next) => {
    try {
      const result = await this.authService.registerUser(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  registerProvider = async (req, res, next) => {
    try {
      if (!env.allowProviderSelfRegister) {
        throw new AppError({
          message: "Provider self registration is disabled",
          statusCode: 403,
          code: "PROVIDER_SELF_REGISTER_DISABLED"
        });
      }
      const result = await this.authService.registerProvider(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  login = async (req, res, next) => {
    try {
      const result = await this.authService.login(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  googleLogin = async (req, res, next) => {
    try {
      const result = await this.authService.loginWithGoogle(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  me = async (req, res, next) => {
    try {
      const result = await this.authService.getMe({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateMe = async (req, res, next) => {
    try {
      const result = await this.authService.updateMe({ actorUserId: req.user.id, patch: req.body });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  bootstrapAdmin = async (req, res, next) => {
    try {
      const result = await this.authService.bootstrapAdmin(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
