import 'package:flutter/material.dart';
import '../../../core/sharing/share_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/page_band.dart';
import '../../../core/motion/design_transitions.dart';
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

    if (p.type == 'service') {
      return _ServiceDetailBody(
        product: p,
        busy: fetched.isLoading,
        categoryName: node?['name']?.toString(),
        heroTag: widget.heroTag,
        onPrimary: primary,
      );
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
    Widget section(
      List<Widget> children, {
      Color? color,
      double elevation = 2,
      EdgeInsets padding = const EdgeInsets.fromLTRB(14, 4, 14, 16),
    }) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DesignEntrance(
        child: PageBand(
          color: color ?? c.surface,
          elevation: elevation,
          borderRadius: BorderRadius.circular(commerceRadius(style)),
          padding: padding,
          children: children,
        ),
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
        child: Material(
          color: c.surface,
          elevation: 8,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
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
                        ? (p.bookable ? 'Book now' : 'Contact provider')
                        : 'Order now',
                  ),
                ),
              ],
            ),
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
          const SizedBox(height: 8),
          section(
            [if (style == AppThemeStyle.editorial) title, gallery],
            color: c.surfaceContainerLow,
            elevation: 3,
            padding: EdgeInsets.zero,
          ),
          section(
            [
              if (style != AppThemeStyle.editorial) title,
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      p.price > 0
                          ? '${formatUgx(p.price)}${p.bookable ? ' / ${p.booking?.unit.name ?? 'booking'}' : ''}'
                          : 'Contact for price',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
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
                              ref
                                  .read(cartControllerProvider.notifier)
                                  .add(p.id);
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
                        onPressed: fetched.isLoading
                            ? null
                            : () => order('cash'),
                        child: const Text('Pay on delivery'),
                      ),
                  ],
                ),
              const SizedBox(height: 12),
              Text(
                p.type == 'service'
                    ? (p.bookable
                          ? 'Choose an available date and time to book.'
                          : 'Arrange service details directly with the provider.')
                    : (p.canPayOnline
                          ? 'Pay online after the seller accepts, or pay cash on pickup or delivery.'
                          : 'Pay cash on pickup or delivery.'),
                style: TextStyle(
                  color: c.onSurfaceVariant,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
            color: Color.lerp(c.surface, c.primary, .085),
            elevation: 4,
          ),
          if ((p.description?.isNotEmpty ?? false) || p.customFields.isNotEmpty)
            section([
              if (p.description?.isNotEmpty ?? false) ...[
                const CommerceTitle('Description'),
                Text(p.description!, style: const TextStyle(height: 1.6)),
              ],
              if (p.customFields.isNotEmpty) ...[
                const CommerceTitle('Specifications'),
                CommerceAttributes(values: p.customFields, fields: fields),
              ],
            ]),
          if (p.providerId != null)
            section([
              CommerceTitle(
                p.providerName ?? 'Seller',
                action: () => context.push('/provider/${p.providerId}'),
                label: 'Visit shop',
              ),
              ProviderContactPanel(providerId: p.providerId!),
            ], color: c.surfaceContainerLow),
          if (p.type == 'product')
            section(
              [
                const CommerceTitle('Buying on Gabla'),
                const Text(
                  'Inspect the item before paying cash. Confirm the condition and delivery arrangements with the seller.',
                  style: TextStyle(height: 1.5),
                ),
              ],
              color: c.surfaceContainerLow,
              elevation: 0,
            ),
          if (similar.valueOrNull?.isNotEmpty ?? false)
            section(
              [
                CommerceTitle(
                  p.type == 'service'
                      ? 'Similar services'
                      : 'You might also like',
                ),
                ProductLayout(items: similar.valueOrNull!),
              ],
              elevation: 0,
              padding: EdgeInsets.zero,
            ),
          if (seller.valueOrNull?.any((s) => s.id != p.id) ?? false)
            section(
              [
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
              elevation: 0,
              padding: EdgeInsets.zero,
            ),
          const SizedBox(height: 28),
        ],
      ),
    );
  }
}

/// A photo-forward, single-item detail layout for services - a square
/// hero, name/description/price read top to bottom, a light preview of the
/// listing's own add-on items (the real picker lives on the booking
/// screen), and a save + primary-action bar pinned to the bottom. Kept
/// deliberately simpler than the product detail layout above (no seller
/// panel, no "more from this seller" rails): a service is booked, not
/// compared against a shelf of similar goods.
class _ServiceDetailBody extends ConsumerStatefulWidget {
  const _ServiceDetailBody({
    required this.product,
    required this.busy,
    required this.categoryName,
    required this.heroTag,
    required this.onPrimary,
  });
  final Product product;
  final bool busy;
  final String? categoryName;
  final Object? heroTag;
  final VoidCallback onPrimary;
  @override
  ConsumerState<_ServiceDetailBody> createState() => _ServiceDetailBodyState();
}

class _ServiceDetailBodyState extends ConsumerState<_ServiceDetailBody> {
  bool _saved = false;

  Widget _circleIcon(
    IconData icon,
    VoidCallback? onTap, {
    String? tooltip,
    Color? iconColor,
  }) {
    final c = Theme.of(context).colorScheme;
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: c.surface,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        type: MaterialType.transparency,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Tooltip(
            message: tooltip ?? '',
            child: Icon(icon, size: 19, color: iconColor ?? c.onSurface),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final radius = commerceRadius(style);
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(
                children: [
                  _circleIcon(
                    Icons.arrow_back_rounded,
                    () => Navigator.of(context).maybePop(),
                    tooltip: 'Back',
                  ),
                  const Spacer(),
                  _circleIcon(
                    Icons.ios_share_outlined,
                    () => shareGablaItem(
                      context,
                      type: 'service',
                      id: p.id,
                      title: p.name,
                    ),
                    tooltip: 'Share this service',
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(radius),
                    child: AspectRatio(
                      aspectRatio: 1,
                      child: ProductGallery(
                        images: p.images,
                        heroTag: widget.heroTag,
                        radius: radius,
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  if (widget.categoryName != null || p.district != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        [
                          widget.categoryName,
                          p.district,
                        ].whereType<String>().join(' · ').toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: .8,
                          color: c.primary,
                        ),
                      ),
                    ),
                  Text(
                    p.name,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (p.description?.isNotEmpty ?? false)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(
                        p.description!,
                        style: TextStyle(
                          height: 1.6,
                          color: c.onSurfaceVariant,
                        ),
                      ),
                    ),
                  const SizedBox(height: 18),
                  Text(
                    p.price > 0
                        ? '${formatUgx(p.price)}${p.bookable ? ' / ${p.booking?.unit.name ?? 'booking'}' : ''}'
                        : 'Contact for price',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: c.primary,
                    ),
                  ),
                  if (p.items.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text(
                      'Add-ons available when you book',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: c.onSurface,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final item in p.items)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: c.outlineVariant),
                            ),
                            child: Text(
                              item.required
                                  ? item.name
                                  : item.price != null && item.price! > 0
                                  ? '${item.name} · ${formatUgx(item.price!)}'
                                  : item.name,
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                  if (!p.bookable)
                    Padding(
                      padding: const EdgeInsets.only(top: 22),
                      child: Text(
                        'Arrange service details directly with the provider.',
                        style: TextStyle(
                          color: c.onSurfaceVariant,
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
          child: Row(
            children: [
              _circleIcon(
                _saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                () => setState(() => _saved = !_saved),
                tooltip: _saved ? 'Saved' : 'Save',
                iconColor: _saved ? Colors.redAccent : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: FilledButton(
                  onPressed: widget.busy ? null : widget.onPrimary,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: Text(
                    p.bookable ? 'Book now' : 'Contact provider',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
