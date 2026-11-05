import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/network_providers.dart';
import '../../categories/domain/category.dart';
import '../../provider/domain/provider_summary.dart';
import '../../shop/domain/product.dart';

class SearchResult {
  const SearchResult({
    this.categories = const [],
    this.providers = const [],
    this.listings = const [],
  });
  factory SearchResult.fromJson(Map<String, dynamic> j) => SearchResult(
    categories: (j['categories'] as List? ?? [])
        .map((v) => Category.fromJson(Map<String, dynamic>.from(v)))
        .toList(),
    providers: (j['providers'] as List? ?? [])
        .map((v) => ProviderSummary.fromJson(Map<String, dynamic>.from(v)))
        .toList(),
    listings: (j['listings'] as List? ?? [])
        .map((v) => Product.fromJson(Map<String, dynamic>.from(v)))
        .toList(),
  );
  final List<Category> categories;
  final List<ProviderSummary> providers;
  final List<Product> listings;
  bool get isEmpty =>
      categories.isEmpty && providers.isEmpty && listings.isEmpty;
}

final searchResultsProvider = FutureProvider.autoDispose
    .family<SearchResult, String>((ref, query) async {
      if (query.trim().isEmpty) return const SearchResult();
      final data = await ref
          .watch(apiClientProvider)
          .get<Map<String, dynamic>>('/search', query: {'q': query.trim()});
      return SearchResult.fromJson(data);
    });
