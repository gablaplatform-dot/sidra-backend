import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../domain/browse_query.dart';
import 'shop_providers.dart';

final commerceDeviceIdProvider = FutureProvider<String>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  final stored = prefs.getString('gabla_commerce_device');
  if (stored != null) return stored;
  final id =
      'flutter_${DateTime.now().microsecondsSinceEpoch}_${Random.secure().nextInt(1000000)}';
  await prefs.setString('gabla_commerce_device', id);
  return id;
});
final browseResultsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, BrowseQuery>((ref, query) {
      return ref.watch(shopRepositoryProvider).browse(query);
    });
final browseFacetsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, BrowseQuery>((ref, query) {
      return ref.watch(shopRepositoryProvider).facets(query);
    });
final productTreeProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) async =>
      (await ref.watch(apiClientProvider).getList('/product-categories'))
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
);
final audienceCatalogProvider = FutureProvider<Map<String, dynamic>>(
  (ref) => ref.watch(apiClientProvider).get('/audiences'),
);
final shopPromotionsProvider = FutureProvider<List<dynamic>>(
  (ref) => ref
      .watch(apiClientProvider)
      .getList('/promotions/featured', query: {'limit': 4}),
);
final shopAdsProvider = FutureProvider<List<dynamic>>((ref) {
  final district = ref
      .watch(sessionControllerProvider)
      .valueOrNull
      ?.user
      .district;
  return ref
      .watch(apiClientProvider)
      .getList(
        '/promotions/ads/nearby',
        query: {if (district != null) 'district': district},
      );
});
final forYouProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final device = await ref.watch(commerceDeviceIdProvider.future);
  final session = ref.watch(sessionControllerProvider).valueOrNull;
  if (session != null) {
    try {
      await api.post('/interest/claim', body: {'deviceId': device});
    } catch (_) {}
  }
  return api.get(
    '/interest/for-you',
    query: {
      'deviceId': device,
      'limit': 8,
      if (session?.user.district != null) 'district': session!.user.district,
    },
  );
});
Future<void> trackCommerce(WidgetRef ref, Map<String, dynamic> event) async {
  try {
    final api = ref.read(apiClientProvider);
    final device = await ref.read(commerceDeviceIdProvider.future);
    await api.post('/interest/events', body: {'deviceId': device, ...event});
  } catch (_) {}
}

Future<void> clearCommerceHistory(WidgetRef ref) async {
  final api = ref.read(apiClientProvider);
  final device = await ref.read(commerceDeviceIdProvider.future);
  await api.delete('/interest?deviceId=${Uri.encodeComponent(device)}');
  ref.invalidate(forYouProvider);
}

Map<String, dynamic>? findShopNode(List<dynamic> tree, String? id) {
  for (final value in tree) {
    final node = Map<String, dynamic>.from(value);
    if (node['id'] == id) return node;
    final found = findShopNode(node['children'] as List? ?? [], id);
    if (found != null) return found;
  }
  return null;
}

final commerceCategoryTreeProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
      (ref, kind) async =>
          (await ref
                  .watch(apiClientProvider)
                  .getList(
                    kind == 'service'
                        ? '/service-categories'
                        : '/product-categories',
                  ))
              .map((e) => Map<String, dynamic>.from(e))
              .toList(),
    );
