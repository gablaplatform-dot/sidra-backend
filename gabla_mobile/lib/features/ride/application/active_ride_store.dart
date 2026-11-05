import 'package:shared_preferences/shared_preferences.dart';

/// Persists the in-progress trip id so a ride survives an app restart.
/// Mirrors `public_app/src/lib/activeRide.js` (`gabla_active_ride_trip`).
class ActiveRideStore {
  static const _key = 'gabla_active_ride_trip';

  Future<String?> get() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }

  Future<void> set(String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, tripId);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
