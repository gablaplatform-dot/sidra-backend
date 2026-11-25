import '../../../core/network/api_client.dart';
import '../domain/video_ad.dart';

class VideoAdPage {
  const VideoAdPage({required this.items, required this.total});
  final List<VideoAd> items;
  final int total;
}

class VideoAdRepository {
  VideoAdRepository(this._client);
  final ApiClient _client;

  Future<VideoAdPage> fetchPage({
    String? q,
    String? categoryId,
    int page = 1,
    int limit = 8,
  }) async {
    final raw = await _client.get<Map<String, dynamic>>(
      '/promotions/ads/videos',
      query: {
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        if (categoryId != null) 'categoryId': categoryId,
        'page': page,
        'limit': limit,
      },
    );
    final items = (raw['items'] as List? ?? [])
        .map((v) => VideoAd.fromJson(Map<String, dynamic>.from(v as Map)))
        .toList();
    return VideoAdPage(items: items, total: raw['total'] as int? ?? items.length);
  }
}
