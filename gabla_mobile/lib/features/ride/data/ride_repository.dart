import '../../../core/network/api_client.dart';
import '../domain/ride_estimate.dart';
import '../domain/ride_location.dart';
import '../domain/ride_trip.dart';

/// `/rides/*` - mirrors `public_app/src/pages/Ride.jsx`.
class RideRepository {
  RideRepository(this._client);

  final ApiClient _client;

  Future<RideEstimate> estimate({
    required String vehicleType,
    required RideLocation pickup,
    required RideLocation dropoff,
  }) async {
    final data = await _client.post<Map<String, dynamic>>('/rides/estimate', body: {
      'vehicleType': vehicleType,
      'pickup': pickup.toJson(),
      'dropoff': dropoff.toJson(),
    });
    return RideEstimate.fromJson(data);
  }

  Future<RideTrip> createTrip({
    required String vehicleType,
    required RideLocation pickup,
    required RideLocation dropoff,
    required String paymentMethod,
    String? phone,
  }) async {
    final data = await _client.post<Map<String, dynamic>>('/rides/trips', body: {
      'vehicleType': vehicleType,
      'pickup': pickup.toJson(),
      'dropoff': dropoff.toJson(),
      'paymentMethod': paymentMethod,
      if (paymentMethod == 'mobile_money' && phone != null) 'phone': phone,
    });
    return RideTrip.fromJson(data);
  }

  Future<RideTrip> fetchTrip(String tripId) async {
    final data = await _client.get<Map<String, dynamic>>('/rides/trips/$tripId');
    return RideTrip.fromJson(data);
  }

  Future<RideTrip> confirmTrip(String tripId) async {
    final data = await _client.post<Map<String, dynamic>>('/rides/trips/$tripId/confirm');
    return RideTrip.fromJson(data);
  }

  Future<void> cancelTrip(String tripId) async {
    await _client.post<dynamic>('/rides/trips/$tripId/cancel', body: const {});
  }
}
