import '../../../core/network/api_client.dart';
import '../domain/provider_summary.dart';

class ProviderRepository {
  ProviderRepository(this._client);

  final ApiClient _client;

  Future<List<ProviderSummary>> fetchTopRated({int limit = 12}) async {
    final data = await _client.getList(
      '/providers',
      query: {'sort': 'top-rated', 'limit': limit},
    );
    return data
        .map((e) => ProviderSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ProviderSummary>> fetchByCategory(String categoryId) async {
    final data = await _client.getList(
      '/providers',
      query: {'categoryId': categoryId},
    );
    return data
        .map((e) => ProviderSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> fetchById(String providerId) =>
      _client.get<Map<String, dynamic>>('/providers/$providerId');

  Future<List<String>> fetchDistricts() async {
    final data = await _client.getList('/providers/districts');
    return data.cast<String>();
  }
}
