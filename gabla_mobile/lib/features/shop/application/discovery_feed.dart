import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/browse_query.dart';
import '../domain/product.dart';
import 'shop_providers.dart';

class DiscoveryFeedState {
  const DiscoveryFeedState({
    this.items = const [],
    this.loading = true,
    this.hasMore = true,
    this.page = 0,
    this.error,
  });
  final List<Product> items;
  final bool loading, hasMore;
  final int page;
  final Object? error;
}

class DiscoveryFeed
    extends AutoDisposeFamilyNotifier<DiscoveryFeedState, BrowseQuery> {
  late BrowseQuery _query;
  bool _alive = true;

  @override
  DiscoveryFeedState build(BrowseQuery arg) {
    _query = arg;
    _alive = true;
    ref.onDispose(() => _alive = false);
    unawaited(Future.microtask(() => _load(1)));
    return const DiscoveryFeedState();
  }

  Future<void> loadMore() async {
    if (state.loading || !state.hasMore) return;
    await _load(state.page + 1);
  }

  Future<void> _load(int page) async {
    if (!_alive) return;
    state = DiscoveryFeedState(items: state.items, page: state.page);
    try {
      final data = await ref
          .read(shopRepositoryProvider)
          .browse(_query.copyWith(page: page));
      if (!_alive) return;
      final batch = (data['items'] as List? ?? [])
          .whereType<Map>()
          .map((raw) => Product.fromJson(Map<String, dynamic>.from(raw)))
          .toList();
      final ids = state.items.map((p) => p.id).toSet();
      final items = [...state.items, ...batch.where((p) => ids.add(p.id))];
      final total = (data['total'] as num?)?.toInt();
      state = DiscoveryFeedState(
        items: items,
        loading: false,
        page: page,
        hasMore:
            batch.isNotEmpty &&
            (total == null ? batch.length >= 24 : page * 24 < total),
      );
    } catch (error) {
      if (!_alive) return;
      state = DiscoveryFeedState(
        items: state.items,
        page: state.page,
        loading: false,
        hasMore: state.hasMore,
        error: error,
      );
    }
  }
}

final discoveryFeedProvider = NotifierProvider.autoDispose
    .family<DiscoveryFeed, DiscoveryFeedState, BrowseQuery>(DiscoveryFeed.new);
