import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the signed-in session (access token + user) on-device, the same
/// role `lib/session.js` plays in the web app.
class SecureSessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _sessionKey = 'gabla_session';

  final FlutterSecureStorage _storage;

  Future<Map<String, dynamic>?> read() async {
    final raw = await _storage.read(key: _sessionKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> write(Map<String, dynamic> session) =>
      _storage.write(key: _sessionKey, value: jsonEncode(session));

  Future<void> clear() => _storage.delete(key: _sessionKey);
}
