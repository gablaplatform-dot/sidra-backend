import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../categories/domain/category.dart';
import '../data/shop_repository.dart';
import '../domain/product.dart';

final shopRepositoryProvider =
    Provider<ShopRepository>((ref) => ShopRepository(ref.watch(apiClientProvider)));

final rootCategoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(shopRepositoryProvider).fetchRootCategories();
});

final newArrivalsProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(shopRepositoryProvider).fetchNewArrivals();
});

final bestSellersProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(shopRepositoryProvider).fetchBestSellers();
});

/// Listings for one category (`/shop/:categoryId`) - re-fetches whenever the
/// category changes since the family key is part of the provider's identity.
final categoryListingsProvider =
    FutureProvider.family<List<Product>, String>((ref, categoryId) {
  return ref.watch(shopRepositoryProvider).fetchListings(categoryId: categoryId);
});

final productDetailProvider =
    FutureProvider.family<Product, String>((ref, listingId) {
  return ref.watch(shopRepositoryProvider).fetchListing(listingId);
});

/// Backs `/shop/new-arrivals`, `/shop/best-sellers`, `/shop/all`.
final shopCollectionProvider =
    FutureProvider.family<List<Product>, String>((ref, collection) {
  final repo = ref.watch(shopRepositoryProvider);
  switch (collection) {
    case 'new':
      return repo.fetchNewArrivals(limit: 40);
    case 'bestsellers':
      return repo.fetchBestSellers(limit: 40);
    default:
      return repo.fetchListings(limit: 40);
  }
});
