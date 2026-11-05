import '../../../core/network/api_client.dart';
import '../domain/session.dart';

/// Talks to the `/auth/*` endpoints. Mirrors `handleCredential` in
/// `public_app/src/pages/Login.jsx`.
class AuthRepository {
  AuthRepository(this._client);

  final ApiClient _client;

  Future<Session> signIn(
    String identifier,
    String password, {
    String? name,
    String? businessName,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      name == null
          ? '/auth/login'
          : businessName == null
          ? '/auth/register/user'
          : '/auth/register/provider',
      body: {
        identifier.contains('@') ? 'email' : 'phone': identifier.trim(),
        'password': password,
        if (name != null) 'name': name.trim(),
        if (businessName != null) 'businessName': businessName.trim(),
      },
    );
    return Session.fromJson(data);
  }

  Future<Session> signInWithGoogle(String idToken) async {
    final data = await _client.post<Map<String, dynamic>>(
      '/auth/google',
      body: {'idToken': idToken},
    );
    return Session.fromJson(data);
  }
}
