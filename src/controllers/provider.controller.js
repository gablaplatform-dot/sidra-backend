export class ProviderController {
  constructor({ providerService }) {
    this.providerService = providerService;
  }

  adminCreateProvider = async (req, res, next) => {
    try {
      const result = await this.providerService.adminCreateProvider(req.body);
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getOnboardingInfo = async (req, res, next) => {
    try {
      const result = await this.providerService.getOnboardingInfo({ token: req.params.token });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  completeOnboarding = async (req, res, next) => {
    try {
      const result = await this.providerService.completeOnboarding({
        token: req.params.token,
        password: req.body.password,
        profile: req.body.profile
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  linkGoogleAccount = async (req, res, next) => {
    try {
      const result = await this.providerService.linkGoogleAccount({
        onboardingToken: req.params.token,
        idToken: req.body.idToken
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateMyProfile = async (req, res, next) => {
    try {
      const result = await this.providerService.updateMyProviderProfile({
        actorUserId: req.user.id,
        updates: req.body
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getMyProfile = async (req, res, next) => {
    try {
      const result = await this.providerService.getMyProviderProfile({
        actorUserId: req.user.id
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminSetApproval = async (req, res, next) => {
    try {
      const result = await this.providerService.adminSetApproval({
        providerId: req.params.providerId,
        approved: req.body.approved
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminResendInvitation = async (req, res, next) => {
    try {
      const result = await this.providerService.resendInvitation({ providerId: req.params.providerId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminResendGoogleLink = async (req, res, next) => {
    try {
      const result = await this.providerService.resendGoogleLink({ providerId: req.params.providerId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  requestGoogleLink = async (req, res, next) => {
    try {
      const result = await this.providerService.requestGoogleLink({ email: req.body.email });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listPublicProviders = async (req, res, next) => {
    try {
      const result = await this.providerService.listPublicProviders(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getPublicProviderProfile = async (req, res, next) => {
    try {
      const result = await this.providerService.getProviderProfile({ providerId: req.params.providerId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getProviderContact = async (req, res, next) => {
    try {
      const result = await this.providerService.getProviderContactForUser({
        actorUserId: req.user.id,
        providerId: req.params.providerId
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getUnlockedContact = async (req, res, next) => {
    try {
      const result = await this.providerService.getUnlockedContactByProof({
        providerId: req.params.providerId,
        unlockId: req.query.unlockId
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
