import 'package:flutter/material.dart';
import '../../../core/sharing/share_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../cart/application/cart_controller.dart';
import '../../provider/presentation/provider_contact_panel.dart';
import '../application/shop_providers.dart';
import '../application/commerce_providers.dart';
import '../domain/product.dart';
import 'commerce_widgets.dart';
import 'product_gallery.dart';
import 'product_layout.dart';

final similarProductsProvider = FutureProvider.family<List<Product>, String>(
  (ref, id) => ref.watch(shopRepositoryProvider).similar(id),
);
final sellerProductsProvider = FutureProvider.family<List<Product>, String>(
  (ref, id) =>
      ref.watch(shopRepositoryProvider).fetchListings(providerId: id, limit: 7),
);

final sellerServicesProvider = FutureProvider.family<List<Product>, String>(
  (ref, id) => ref
      .watch(shopRepositoryProvider)
      .fetchListings(type: 'service', providerId: id, limit: 7),
);

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.listingId,
    this.heroTag,
    this.previewProduct,
  });
  final String listingId;
  final Object? heroTag;
  final Product? previewProduct;
  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) =>
          trackCommerce(ref, {'type': 'view', 'listingId': widget.listingId}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fetched = ref.watch(productDetailProvider(widget.listingId));
    final p =
        fetched.valueOrNull ??
        (fetched.isLoading ? widget.previewProduct : null);
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final tree = ref.watch(productTreeProvider).valueOrNull ?? [];
    if (p == null)
      return Scaffold(
        appBar: const CommerceAppBar(title: 'The details'),
        body: fetched.hasError
            ? CommerceEmpty(
                title: 'This find couldn’t be loaded',
                message: '${fetched.error}',
                action: 'Try again',
                onAction: () =>
                    ref.invalidate(productDetailProvider(widget.listingId)),
              )
            : const Padding(
                padding: EdgeInsets.all(20),
                child: CommerceLoading(),
              ),
      );
    final node = findShopNode(tree, p.categoryId);
    final fields = (node?['effectiveListingFields'] as List? ?? []).cast<Map>();
    final similar = ref.watch(similarProductsProvider(p.id));
    final seller = p.providerId == null
        ? const AsyncData<List<Product>>([])
        : ref.watch(
            p.type == 'service'
                ? sellerServicesProvider(p.providerId!)
                : sellerProductsProvider(p.providerId!),
          );
    void order(String method) => context.push(
      '/checkout?buy=${Uri.encodeComponent(p.id)}&payment=$method',
    );
    void primary() {
      if (p.type == 'service') {
        if (p.bookable) {
          context.push('/services/booking/${p.id}');
        } else if (p.providerId != null) {
          context.push('/provider/${p.providerId}');
        }
      } else {
        order(p.canPayOnline ? 'online' : 'cash');
      }
    }

    final title = CommerceTitle(
      p.name,
      subtitle: [
        if (p.district != null) p.district!,
        if (p.createdAt != null)
          'Posted ${p.createdAt!.day}/${p.createdAt!.month}/${p.createdAt!.year}',
      ].join(' · '),
    );
    final gallery = AspectRatio(
      aspectRatio: style == AppThemeStyle.cinematic
          ? .85
          : style == AppThemeStyle.editorial
          ? 1.08
          : 1,
      child: ProductGallery(
        images: p.images,
        heroTag: widget.heroTag,
        radius: commerceRadius(style),
        fraction: style == AppThemeStyle.discover ? .92 : 1,
      ),
    );
    return Scaffold(
      appBar: CommerceAppBar(
        title:
            node?['name']?.toString() ??
            (p.type == 'service' ? 'Service details' : 'A closer look'),
        actions: [
          IconButton(
            tooltip: 'Share this find',
            onPressed: () => shareGablaItem(
              context,
              type: p.type == 'service' ? 'service' : 'product',
              id: p.id,
              title: p.name,
            ),
            icon: const Icon(Icons.ios_share_outlined),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          decoration: BoxDecoration(
            color: c.surface,
            border: Border(top: BorderSide(color: c.outlineVariant)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  p.price > 0 ? formatUgx(p.price) : 'Contact for price',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: fetched.isLoading ? null : primary,
                child: Text(
                  p.type == 'service'
                      ? (p.bookable ? 'Check availability' : 'Contact provider')
                      : 'Order now',
                ),
              ),
            ],
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.symmetric(
          horizontal: style == AppThemeStyle.cinematic ? 12 : 20,
        ),
        children: [
          if (p.categoryId != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => context.push(
                  p.type == 'service'
                      ? '/services/c/${p.categoryId}'
                      : '/shop/${p.categoryId}',
                ),
                icon: const Icon(Icons.arrow_back, size: 14),
                label: Text(node?['name']?.toString() ?? 'Back to category'),
              ),
            ),
          if (style == AppThemeStyle.editorial) title,
          gallery,
          if (style != AppThemeStyle.editorial) title,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  p.price > 0
                      ? '${formatUgx(p.price)}${p.bookable ? ' / ${p.booking?.unit.name ?? 'booking'}' : ''}'
                      : 'Contact for price',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (p.isOnSale)
                Chip(
                  label: Text(
                    p.discountPercent == null
                        ? 'On sale'
                        : '−${p.discountPercent}%',
                  ),
                ),
            ],
          ),
          if (p.isOnSale)
            Text(
              'Was ${formatUgx(p.originalPrice)} · Save ${formatUgx(p.originalPrice! - p.price)}',
              style: TextStyle(color: c.primary, fontSize: 12),
            ),
          const SizedBox(height: 18),
          if (p.type == 'product')
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: fetched.isLoading
                      ? null
                      : () {
                          ref.read(cartControllerProvider.notifier).add(p.id);
                          trackCommerce(ref, {
                            'type': 'cart',
                            'listingId': p.id,
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Added to your shopping bag'),
                            ),
                          );
                        },
                  icon: const Icon(Icons.add_shopping_cart, size: 18),
                  label: const Text('Add to bag'),
                ),
                if (p.canPayOnline)
                  OutlinedButton(
                    onPressed: fetched.isLoading ? null : () => order('cash'),
                    child: const Text('Pay on delivery'),
                  ),
              ],
            ),
          const SizedBox(height: 12),
          Text(
            p.type == 'service'
                ? 'Arrange service details directly with the provider.'
                : 'No payment is collected when placing an order. Pay online after the seller accepts, or pay cash on pickup / delivery.',
            style: TextStyle(
              color: c.onSurfaceVariant,
              fontSize: 12,
              height: 1.5,
            ),
          ),
          if (p.description?.isNotEmpty ?? false) ...[
            const CommerceTitle('The details'),
            Text(p.description!, style: const TextStyle(height: 1.6)),
          ],
          if (p.customFields.isNotEmpty) ...[
            const CommerceTitle('Specifications'),
            CommercePanel(
              child: CommerceAttributes(values: p.customFields, fields: fields),
            ),
          ],
          if (p.providerId != null) ...[
            CommerceTitle(
              'Meet your seller',
              action: () => context.push('/provider/${p.providerId}'),
              label: 'Visit shop',
            ),
            ProviderContactPanel(providerId: p.providerId!),
          ],
          const CommerceTitle('Shop with confidence'),
          const Text(
            'Inspect items before paying cash. Confirm the price, condition, and delivery arrangements with the seller. Keep payments and order records together on Gabla.',
            style: TextStyle(fontSize: 12, height: 1.5),
          ),
          if (similar.valueOrNull?.isNotEmpty ?? false) ...[
            CommerceTitle(
              p.type == 'service' ? 'Similar services' : 'You might also like',
            ),
            ProductLayout(items: similar.valueOrNull!),
          ],
          if (seller.valueOrNull?.any((s) => s.id != p.id) ?? false) ...[
            CommerceTitle(
              'More from this seller',
              action: () => context.push('/provider/${p.providerId}'),
              label: 'Visit shop',
            ),
            ProductLayout(
              items: seller.valueOrNull!
                  .where((s) => s.id != p.id)
                  .take(6)
                  .toList(),
            ),
          ],
          const SizedBox(height: 28),
        ],
      ),
    );
  }
}
