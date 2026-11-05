import '../../../core/network/api_client.dart';
import '../../auth/domain/session.dart';
import '../domain/provider_invite.dart';

/// `/providers/onboarding/:token` - completing an admin-sent provider
/// invite. See `provider_invite.dart` for why this is token-gated rather
/// than self-serve.
class ProviderOnboardingRepository {
  ProviderOnboardingRepository(this._client);

  final ApiClient _client;

  Future<ProviderInvite> fetchInvite(String token) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/providers/onboarding/$token',
    );
    return ProviderInvite.fromJson(data);
  }

  Future<void> complete({
    required String token,
    required String businessName,
    String? description,
    required ProviderContactInfo contact,
    required ProviderLocationInfo location,
    String? categoryId,
  }) async {
    await _client.post<dynamic>(
      '/providers/onboarding/$token/complete',
      body: {
        'profile': {
          'businessName': businessName,
          if (description != null && description.isNotEmpty)
            'description': description,
          'contact': contact.toJson(),
          'location': location.toJson(),
          if (categoryId != null) 'categoryId': categoryId,
        },
      },
    );
  }

  Future<Session> linkGoogle(String token, String idToken) async {
    final data = await _client.post<Map<String, dynamic>>(
      '/providers/onboarding/$token/link-google',
      body: {'idToken': idToken},
    );
    return Session.fromJson(data);
  }
}
