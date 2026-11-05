import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/order_repository.dart';
import '../domain/order.dart';

final orderRepositoryProvider =
    Provider<OrderRepository>((ref) => OrderRepository(ref.watch(apiClientProvider)));

final myOrdersProvider = FutureProvider<List<Order>>((ref) {
  return ref.watch(orderRepositoryProvider).fetchMine();
});

final orderDetailProvider = FutureProvider.family<Order, String>((ref, orderId) {
  return ref.watch(orderRepositoryProvider).fetchById(orderId);
});
