import 'package:shared_preferences/shared_preferences.dart';

/// Persists the driver's access token and cached user id/name across app restarts.
class SessionStore {
  static const _tokenKey = 'gabla_driver_token';
  static const _userIdKey = 'gabla_driver_user_id';
  static const _userNameKey = 'gabla_driver_user_name';

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> save({required String token, required String userId, required String userName}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userIdKey, userId);
    await prefs.setString(_userNameKey, userName);
  }

  /// Swaps in a freshly-minted token without touching the cached user id/name - used when an
  /// action (like completing driver registration) changes the account's role server-side, since
  /// the previously-issued token still carries the old role and would be rejected by role-gated
  /// endpoints until replaced.
  Future<void> updateToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<String?> getUserName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userNameKey);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_userNameKey);
  }
}
