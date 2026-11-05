import '../../../core/network/api_client.dart';
import '../domain/category.dart';

/// The general directory tree (`/categories`) that drives the home screen's
/// "browse by category" section, and the service-only tree (`/service-categories`)
/// used by the Services section. Distinct from the shop's own
/// `/product-categories` (see `ShopRepository`) and a provider's own
/// `/shop-categories`.
class CategoryRepository {
  CategoryRepository(this._client);

  final ApiClient _client;

  Future<List<Category>> fetchDirectoryCategories() async {
    final items = await _client.getList('/categories');
    return items
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Category>> fetchServiceCategories() async {
    final items = await _client.getList('/service-categories');
    return items
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
