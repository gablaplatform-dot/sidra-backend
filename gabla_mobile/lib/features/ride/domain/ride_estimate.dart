import '../../../core/utils/parsing.dart';

/// `POST /rides/estimate` response for one vehicle type.
class RideEstimate {
  const RideEstimate({required this.fare, this.distanceKm, this.durationMin});

  factory RideEstimate.fromJson(Map<String, dynamic> json) => RideEstimate(
        fare: asDouble(json['fare']),
        distanceKm: asNum(json['distanceKm'])?.toDouble(),
        durationMin: asInt(json['durationMin']),
      );

  final double fare;
  final double? distanceKm;
  final int? durationMin;
}
