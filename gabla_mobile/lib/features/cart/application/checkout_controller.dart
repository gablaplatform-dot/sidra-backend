import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../orders/application/order_providers.dart';
import '../../orders/domain/order.dart';
import '../../orders/domain/order_input.dart';
import 'cart_controller.dart';

class CheckoutResult {
  const CheckoutResult({
    required this.succeeded,
    required this.failedProviderNames,
    this.succeededProviderIds = const [],
    this.failureReasons = const {},
  });

  final List<Order> succeeded;
  final List<String> failedProviderNames;
  final List<String> succeededProviderIds;
  final Map<String, String> failureReasons;

  bool get allSucceeded => failedProviderNames.isEmpty;
}

/// Places one order per seller in [ProviderOrderGroup.providerId] and clears
/// the succeeded items from the cart, same as the per-provider loop in
/// `Cart.jsx` - a failure for one seller never blocks the others, and failed
/// items are simply left in the cart for the buyer to retry.
class CheckoutController
    extends AutoDisposeNotifier<AsyncValue<CheckoutResult?>> {
  @override
  AsyncValue<CheckoutResult?> build() => const AsyncData(null);

  Future<void> submit({
    required List<ProviderOrderGroup> groups,
    bool clearCart = true,
    required String paymentMethod,
    required String name,
    required String phone,
    String? notes,
    FulfillmentInput? fulfillment,
  }) async {
    if (state.isLoading || groups.isEmpty) return;
    final keepAlive = ref.keepAlive();
    state = const AsyncLoading();
    final repo = ref.read(orderRepositoryProvider);
    final succeeded = <Order>[];
    final failed = <String>[];
    final succeededIds = <String>[];
    final reasons = <String, String>{};

    for (final group in groups) {
      try {
        final order = await repo.createOrder(
          providerId: group.providerId,
          items: group.items,
          paymentMethod: paymentMethod,
          customerName: name,
          customerPhone: phone,
          notes: notes,
          fulfillment: fulfillment,
        );
        succeeded.add(order);
        succeededIds.add(group.providerId);
        if (clearCart)
          for (final item in group.items) {
            ref.read(cartControllerProvider.notifier).remove(item.listingId);
          }
      } catch (error) {
        failed.add(group.providerName);
        reasons[group.providerName] = error.toString();
      }
    }

    state = AsyncData(
      CheckoutResult(
        succeeded: succeeded,
        failedProviderNames: failed,
        succeededProviderIds: succeededIds,
        failureReasons: reasons,
      ),
    );
    keepAlive.close();
  }

  void reset() => state = const AsyncData(null);
}

final checkoutControllerProvider =
    NotifierProvider.autoDispose<
      CheckoutController,
      AsyncValue<CheckoutResult?>
    >(CheckoutController.new);
