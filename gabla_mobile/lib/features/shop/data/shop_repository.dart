import '../../../core/network/api_client.dart';
import '../../categories/domain/category.dart';
import '../domain/product.dart';
import '../domain/browse_query.dart';

/// Browsing endpoints for the shop: categories and listings of type
/// `product`. See the `/product-categories`, `/listings` family of calls
/// scattered across `public_app/src/pages/Shop*.jsx`.
class ShopRepository {
  ShopRepository(this._client);

  final ApiClient _client;

  Future<List<Category>> fetchRootCategories({int limit = 60}) async {
    final data = await _client.getList(
      '/product-categories/roots',
      query: {'limit': limit},
    );
    return data
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Product>> fetchListings({
    String type = 'product',
    String? categoryId,
    String? providerId,
    String query = '',
    String? sort,
    int limit = 20,
    int page = 1,
  }) async {
    final data = await _client.getList(
      '/listings',
      query: {
        'type': type,
        if (categoryId != null)
          (type == 'service' ? 'serviceCategoryId' : 'productCategoryId'):
              categoryId,
        if (providerId != null) 'providerId': providerId,
        if (query.isNotEmpty) 'q': query,
        if (sort != null) 'sort': sort,
        'limit': limit,
        'page': page,
      },
    );
    return data
        .map((e) => Product.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Product>> fetchNewArrivals({int limit = 12}) async =>
      (await _client.getList(
        '/listings/new-arrivals',
        query: {'limit': limit, 'type': 'product'},
      )).map((e) => Product.fromJson(Map<String, dynamic>.from(e))).toList();

  Future<List<Product>> fetchBestSellers({int limit = 12}) async =>
      (await _client.getList(
        '/listings/best-sellers',
        query: {'limit': limit, 'type': 'product'},
      )).map((e) => Product.fromJson(Map<String, dynamic>.from(e))).toList();

  Future<Map<String, dynamic>> browse(BrowseQuery query) =>
      _client.get('/listings', query: query.parameters);
  Future<Map<String, dynamic>> facets(BrowseQuery query) =>
      _client.get('/listings/facets', query: query.filters);
  Future<List<Product>> similar(String id) async => (await _client.getList(
    '/listings/${Uri.encodeComponent(id)}/similar',
    query: {'limit': 8},
  )).map((e) => Product.fromJson(Map<String, dynamic>.from(e))).toList();
  Future<Product> fetchListing(String id) async {
    final data = await _client.get<Map<String, dynamic>>('/listings/$id');
    return Product.fromJson(data);
  }
}
