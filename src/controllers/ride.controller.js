export class RideController {
  constructor({ rideService }) {
    this.rideService = rideService;
  }

  estimateFare = async (req, res, next) => {
    try {
      const result = await this.rideService.estimateFare({
        vehicleType: req.body.vehicleType,
        pickup: req.body.pickup,
        dropoff: req.body.dropoff
      });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  registerDriver = async (req, res, next) => {
    try {
      const result = await this.rideService.registerDriver({ actorUserId: req.user.id, ...req.body });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getMyDriverProfile = async (req, res, next) => {
    try {
      const result = await this.rideService.getMyDriverProfile({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateMyDriverProfile = async (req, res, next) => {
    try {
      const result = await this.rideService.updateMyDriverProfile({ actorUserId: req.user.id, updates: req.body });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  setOnlineStatus = async (req, res, next) => {
    try {
      const result = await this.rideService.setOnlineStatus({ actorUserId: req.user.id, isOnline: req.body.isOnline });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateLocation = async (req, res, next) => {
    try {
      const result = await this.rideService.updateLocation({ actorUserId: req.user.id, lat: req.body.lat, lng: req.body.lng });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMyTripsAsDriver = async (req, res, next) => {
    try {
      const result = await this.rideService.listMyTripsAsDriver({ actorUserId: req.user.id, ...req.query });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getMyRideWallet = async (req, res, next) => {
    try {
      const result = await this.rideService.getMyRideWallet({ actorUserId: req.user.id });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  requestTrip = async (req, res, next) => {
    try {
      const result = await this.rideService.requestTrip({ actorUserId: req.user.id, ...req.body });
      res.status(201).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getTripStatus = async (req, res, next) => {
    try {
      const result = await this.rideService.getTripStatus({ actorUserId: req.user.id, tripId: req.params.tripId });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  listMyTripsAsRider = async (req, res, next) => {
    try {
      const result = await this.rideService.listMyTripsAsRider({ actorUserId: req.user.id, ...req.query });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  cancelTrip = async (req, res, next) => {
    try {
      const result = await this.rideService.cancelTrip({ actorUserId: req.user.id, tripId: req.params.tripId, reason: req.body.reason });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  respondToTripOffer = async (req, res, next) => {
    try {
      const result = await this.rideService.respondToTripOffer({ actorUserId: req.user.id, tripId: req.params.tripId, accept: req.body.accept });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  updateTripStatus = async (req, res, next) => {
    try {
      const result = await this.rideService.updateTripStatus({ actorUserId: req.user.id, tripId: req.params.tripId, status: req.body.status });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminListDrivers = async (req, res, next) => {
    try {
      const result = await this.rideService.adminListDrivers(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminSetDriverApproval = async (req, res, next) => {
    try {
      const result = await this.rideService.adminSetDriverApproval({ driverId: req.params.driverId, approved: req.body.approved });
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminListTrips = async (req, res, next) => {
    try {
      const result = await this.rideService.adminListTrips(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  getRideSettings = async (_req, res, next) => {
    try {
      const result = await this.rideService.getRideSettingsList();
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };

  adminUpsertRideSettings = async (req, res, next) => {
    try {
      const result = await this.rideService.adminUpsertRideSettings(req.body);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}
