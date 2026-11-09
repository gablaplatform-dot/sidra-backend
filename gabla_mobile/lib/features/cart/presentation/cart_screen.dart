import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../shop/domain/product.dart';
import '../../shop/application/shop_providers.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/cart_controller.dart';

final cartProductsProvider = FutureProvider<Map<String, Product>>((ref) async {
  final cart = ref.watch(cartControllerProvider);
  final products = await Future.wait([
    for (final id in cart.keys) ref.watch(productDetailProvider(id).future),
  ]);
  return {for (final p in products) p.id: p};
});

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartControllerProvider);
    final products = ref.watch(cartProductsProvider);
    final style = commerceStyle(ref);
    final total = products.valueOrNull?.entries.fold<double>(
      0,
      (sum, e) => sum + e.value.price * (cart[e.key] ?? 0),
    );
    final bySeller = <String, List<Product>>{};
    for (final p in products.valueOrNull?.values ?? <Product>[]) {
      bySeller.putIfAbsent(p.providerId ?? 'unavailable', () => []).add(p);
    }
    return Scaffold(
      appBar: CommerceAppBar(
        title: style == AppThemeStyle.editorial
            ? 'The shopping list'
            : 'Your shopping bag',
        actions: [
          if (cart.isNotEmpty)
            IconButton(
              tooltip: 'Empty bag',
              onPressed: () async {
                final clear = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Empty your bag?'),
                    content: const Text('All items will be removed.'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Keep items'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Empty bag'),
                      ),
                    ],
                  ),
                );
                if (clear == true)
                  ref.read(cartControllerProvider.notifier).clear();
              },
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${cart.values.fold(0, (n, v) => n + v)} items',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          Text(
                            total == null ? 'Calculating…' : formatUgx(total),
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed:
                          products.hasValue &&
                              bySeller.isNotEmpty &&
                              !bySeller.containsKey('unavailable')
                          ? () => context.push('/checkout')
                          : null,
                      icon: const Icon(Icons.arrow_forward, size: 18),
                      label: const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ),
      body: cart.isEmpty
          ? Center(
              child: CommerceEmpty(
                title: 'Room for a good find.',
                message:
                    'Save something you love. Your shopping bag stays here until you’re ready.',
                onAction: () => context.push('/shop'),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                CommerceTitle(
                  style == AppThemeStyle.orbit
                      ? 'In your orbit.'
                      : style == AppThemeStyle.cinematic
                      ? 'Your selected finds.'
                      : 'A few good choices.',
                  subtitle:
                      'Orders go directly to each seller. No payment is taken now.',
                ),
                products.when(
                  loading: () => const CommerceLoading(),
                  error: (e, _) => Column(
                    children: [
                      CommerceEmpty(
                        title: 'Some items need another look',
                        message:
                            'A listing may be unavailable. Retry or remove the item below.',
                        action: 'Retry listings',
                        onAction: () {
                          for (final id in cart.keys) {
                            ref.invalidate(productDetailProvider(id));
                          }
                          ref.invalidate(cartProductsProvider);
                        },
                      ),
                      for (final entry in cart.entries)
                        ListTile(
                          title: Text('Listing ${entry.key}'),
                          trailing: IconButton(
                            tooltip: 'Remove unavailable item',
                            onPressed: () => ref
                                .read(cartControllerProvider.notifier)
                                .remove(entry.key),
                            icon: const Icon(Icons.close),
                          ),
                        ),
                    ],
                  ),
                  data: (_) => Column(
                    children: [
                      for (final group in bySeller.values)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: CommercePanel(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                InkWell(
                                  onTap: group.first.providerId == null
                                      ? null
                                      : () => context.push(
                                          '/provider/${group.first.providerId}',
                                        ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.storefront_outlined,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 9),
                                      Expanded(
                                        child: Text(
                                          group.first.providerName ?? 'Seller',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.titleMedium,
                                        ),
                                      ),
                                      const Icon(Icons.north_east, size: 16),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 12),
                                for (final p in group) ...[
                                  const Divider(height: 20),
                                  _CartLine(
                                    product: p,
                                    quantity: cart[p.id] ?? 1,
                                    onQuantity: (q) => ref
                                        .read(cartControllerProvider.notifier)
                                        .setQuantity(p.id, q),
                                    onRemove: () => ref
                                        .read(cartControllerProvider.notifier)
                                        .remove(p.id),
                                    stacked: style == AppThemeStyle.discover,
                                  ),
                                ],
                                const Divider(height: 24),
                                Row(
                                  children: [
                                    const Expanded(
                                      child: Text(
                                        'Seller subtotal',
                                        style: TextStyle(fontSize: 12),
                                      ),
                                    ),
                                    Text(
                                      formatUgx(
                                        group.fold<double>(
                                          0,
                                          (n, p) =>
                                              n + p.price * (cart[p.id] ?? 0),
                                        ),
                                      ),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextButton.icon(
                  onPressed: () => context.push('/shop'),
                  icon: const Icon(Icons.arrow_back, size: 16),
                  label: const Text('Keep exploring'),
                ),
                const SizedBox(height: 20),
              ],
            ),
    );
  }
}

class _CartLine extends StatelessWidget {
  const _CartLine({
    required this.product,
    required this.quantity,
    required this.onQuantity,
    required this.onRemove,
    this.stacked = false,
  });
  final Product product;
  final int quantity;
  final ValueChanged<int> onQuantity;
  final VoidCallback onRemove;
  final bool stacked;
  @override
  Widget build(BuildContext context) {
    final info = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          product.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 6),
        Text(
          '${formatUgx(product.price)} each',
          style: const TextStyle(fontSize: 11),
        ),
        const SizedBox(height: 8),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            QuantityStepper(quantity: quantity, onChanged: onQuantity),
            IconButton(
              tooltip: 'Remove ${product.name}',
              onPressed: onRemove,
              icon: const Icon(Icons.delete_outline, size: 18),
            ),
          ],
        ),
        Text(
          formatUgx(product.price * quantity),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    );
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: stacked ? double.infinity : 84,
        height: stacked ? 160 : 106,
        child: CommerceImage(product.imageUrl),
      ),
    );
    return AnimatedSize(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 250),
      child: stacked
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [image, const SizedBox(height: 12), info],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () => context.push('/shop/product/${product.id}'),
                  child: image,
                ),
                const SizedBox(width: 14),
                Expanded(child: info),
              ],
            ),
    );
  }
}

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
  });
  final int quantity;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton(
        tooltip: 'Decrease quantity',
        visualDensity: VisualDensity.compact,
        onPressed: quantity > 1 ? () => onChanged(quantity - 1) : null,
        icon: const Icon(Icons.remove, size: 16),
      ),
      AnimatedSwitcher(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 180),
        child: Text(
          '$quantity',
          key: ValueKey(quantity),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      IconButton(
        tooltip: 'Increase quantity',
        visualDensity: VisualDensity.compact,
        onPressed: quantity < 99 ? () => onChanged(quantity + 1) : null,
        icon: const Icon(Icons.add, size: 16),
      ),
    ],
  );
}
