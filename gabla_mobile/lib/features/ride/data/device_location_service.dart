import 'dart:io';
import '../../../core/location/google_location_service.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../domain/ride_location.dart';

/// The one native capability this feature needs that nothing else in the
/// app does: the device's own GPS position, and turning an address string
/// into coordinates (or back). The web app gets this from the browser's
/// Geolocation API plus Google Places/Geocoder. Android uses the configured
/// Google location service; other platforms retain their native geocoder.
class DeviceLocationService {
  const DeviceLocationService();
  static const _google = GoogleLocationService();
  Future<RideLocation> currentLocation() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Location permission was denied.');
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError(
        'Turn on location services to use your current position.',
      );
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
    final address = await _reverseGeocode(
      position.latitude,
      position.longitude,
    );
    return RideLocation(
      lat: position.latitude,
      lng: position.longitude,
      address: address,
    );
  }

  Future<RideLocation> locationAt(double lat, double lng) async => RideLocation(
    lat: lat,
    lng: lng,
    address: await _reverseGeocode(lat, lng),
  );

  Future<RideLocation> geocodeAddress(String address) async {
    if (Platform.isAndroid) return _google.geocode(address);
    final results = await locationFromAddress(address);
    if (results.isEmpty) throw StateError('Could not find that address.');
    final first = results.first;
    return RideLocation(
      lat: first.latitude,
      lng: first.longitude,
      address: address,
    );
  }

  Future<String> _reverseGeocode(double lat, double lng) async {
    try {
      if (Platform.isAndroid) return (await _google.reverse(lat, lng)).address;
      final placemarks = await placemarkFromCoordinates(lat, lng);
      if (placemarks.isEmpty) return 'Current location';
      final p = placemarks.first;
      final parts = [
        p.street,
        p.locality,
        p.country,
      ].where((v) => v != null && v.isNotEmpty).join(', ');
      return parts.isEmpty ? 'Current location' : parts;
    } catch (_) {
      return 'Current location';
    }
  }
}
