import '../../../core/network/api_client.dart';
import '../domain/nearby_result.dart';

class NearbyRepository {
  NearbyRepository(this.client);
  final ApiClient client;
  Future<NearbyResponse> search({
    required String query,
    required NearbyOrigin origin,
    String? type,
  }) async {
    final json = await client.get<Map<String, dynamic>>(
      '/listings/nearby-map',
      query: {
        'q': query.trim(),
        'limit': 40,
        ...origin.query,
        if (type != null) 'type': type,
      },
    );
    return NearbyResponse.fromJson(json);
  }
}
