import '../../../core/utils/parsing.dart';
import 'ride_location.dart';

/// A trip stops progressing once it reaches one of these - polling and the
/// stored "active ride" both stop here. Mirrors `TERMINAL_STATUSES` in
/// `public_app/src/pages/Ride.jsx`.
const terminalRideStatuses = {
  'completed',
  'cancelled_by_rider',
  'cancelled_by_driver',
  'no_drivers_found',
};

/// A trip can still be called off by the rider in these statuses - mirrors
/// `CANCELLABLE_STATUSES`.
const cancellableRideStatuses = {'searching', 'matched', 'arrived'};

class RideDriver {
  const RideDriver({
    this.lat,
    this.lng,
    this.name,
    this.phone,
    this.vehicleModel,
    this.licensePlate,
    this.ratingAvg,
  });

  factory RideDriver.fromJson(Map<String, dynamic> json) {
    final contact = json['contact'] as Map<String, dynamic>?;
    return RideDriver(
      lat: asNum(json['lat'])?.toDouble(),
      lng: asNum(json['lng'])?.toDouble(),
      name: contact?['name'] as String?,
      phone: contact?['phone'] as String?,
      vehicleModel: json['vehicleModel'] as String?,
      licensePlate: json['licensePlate'] as String?,
      ratingAvg: asNum(json['ratingAvg'])?.toDouble(),
    );
  }

  final double? lat;
  final double? lng;
  final String? name;
  final String? phone;
  final String? vehicleModel;
  final String? licensePlate;
  final double? ratingAvg;
}

/// A ride-hailing trip, from `/rides/estimate` through to completion.
/// Mirrors the trip object shape used throughout `Ride.jsx`.
class RideTrip {
  const RideTrip({
    required this.id,
    required this.status,
    required this.vehicleType,
    this.estimatedFare,
    this.estimatedDistanceKm,
    this.estimatedDurationMin,
    this.finalFare,
    this.driver,
    this.routePolyline,
    this.pickup,
    this.dropoff,
  });

  factory RideTrip.fromJson(Map<String, dynamic> json) => RideTrip(
    id: json['id'] as String,
    pickup: json['pickup'] is Map
        ? RideLocation.fromJson(Map<String, dynamic>.from(json['pickup']))
        : null,
    dropoff: json['dropoff'] is Map
        ? RideLocation.fromJson(Map<String, dynamic>.from(json['dropoff']))
        : null,
    status: json['status'] as String? ?? 'searching',
    vehicleType: json['vehicleType'] as String? ?? 'car',
    estimatedFare: asNum(json['estimatedFare'])?.toDouble(),
    estimatedDistanceKm: asNum(json['estimatedDistanceKm'])?.toDouble(),
    estimatedDurationMin: asInt(json['estimatedDurationMin']),
    finalFare: asNum(json['finalFare'])?.toDouble(),
    driver: json['driver'] != null
        ? RideDriver.fromJson(json['driver'] as Map<String, dynamic>)
        : null,
    routePolyline: json['routePolyline'] as String?,
  );

  final String id;
  final String status;
  final String vehicleType;
  final double? estimatedFare;
  final double? estimatedDistanceKm;
  final int? estimatedDurationMin;
  final double? finalFare;
  final RideDriver? driver;
  final String? routePolyline;
  final RideLocation? pickup, dropoff;

  bool get isTerminal => terminalRideStatuses.contains(status);
  bool get isCancellable => cancellableRideStatuses.contains(status);
}
