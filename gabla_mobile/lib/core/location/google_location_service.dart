import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/ride/domain/ride_location.dart';

final googleLocationServiceProvider = Provider<GoogleLocationService>(
  (ref) => const GoogleLocationService(),
);

class PlaceSuggestion {
  const PlaceSuggestion({required this.id, required this.label});
  final String id, label;
}

class GoogleRoadRoute {
  const GoogleRoadRoute({
    required this.polyline,
    required this.distanceMeters,
    required this.duration,
  });
  final String polyline, duration;
  final int distanceMeters;
}

class GoogleLocationService {
  const GoogleLocationService();
  static const _channel = MethodChannel('gabla/google_location');
  Future<RideLocation> geocode(String query) async => RideLocation.fromJson(
    Map<String, dynamic>.from(
      await _channel.invokeMapMethod('geocode', {'query': query}) ?? {},
    ),
  );
  Future<RideLocation> reverse(double lat, double lng) async =>
      RideLocation.fromJson(
        Map<String, dynamic>.from(
          await _channel.invokeMapMethod('reverse', {'lat': lat, 'lng': lng}) ??
              {},
        ),
      );
  Future<List<PlaceSuggestion>> suggestions(
    String query,
    String session,
  ) async =>
      (await _channel.invokeListMethod('autocomplete', {
                'query': query,
                'session': session,
              }) ??
              [])
          .map((e) {
            final p = Map<String, dynamic>.from(e);
            return PlaceSuggestion(id: p['id'], label: p['label']);
          })
          .toList();
  Future<RideLocation> place(String id, String session) async =>
      RideLocation.fromJson(
        Map<String, dynamic>.from(
          await _channel.invokeMapMethod('place', {
                'id': id,
                'session': session,
              }) ??
              {},
        ),
      );
  Future<GoogleRoadRoute> route(RideLocation from, RideLocation to) async {
    final p =
        await _channel.invokeMapMethod('route', {
          'fromLat': from.lat,
          'fromLng': from.lng,
          'toLat': to.lat,
          'toLng': to.lng,
        }) ??
        {};
    return GoogleRoadRoute(
      polyline: p['polyline'] as String? ?? '',
      distanceMeters: p['distanceMeters'] as int? ?? 0,
      duration: p['duration'] as String? ?? '',
    );
  }
}
