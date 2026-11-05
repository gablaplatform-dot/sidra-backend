import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/motion/artwork_hero.dart';
import '../../../../core/motion/design_transitions.dart';
import '../../../../core/theme/app_theme_style.dart';
import '../../../../core/utils/money.dart';
import '../../../cart/application/cart_controller.dart';
import '../../application/commerce_providers.dart';
import '../../domain/product.dart';
import '../../domain/product_navigation.dart';
import '../commerce_widgets.dart';

class ProductCard extends ConsumerStatefulWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
    this.listView = false,
  });
  final Product product;
  final ValueChanged<ProductNavigation> onTap;
  final bool listView;
  @override
  ConsumerState<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends ConsumerState<ProductCard> {
  final Object _heroTag = Object();
  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final inCart = ref.watch(cartControllerProvider).containsKey(p.id);
    final radius = commerceRadius(style);
    final open = () =>
        widget.onTap(ProductNavigation(product: p, heroTag: _heroTag));
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ArtworkHero(tag: _heroTag, child: CommerceImage(p.imageUrl)),
          if (p.isOnSale || p.isNew)
            Positioned(
              left: 9,
              top: 9,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: p.isOnSale ? c.primary : c.surface,
                  borderRadius: BorderRadius.circular(
                    style == AppThemeStyle.editorial ? 0 : 10,
                  ),
                ),
                child: Text(
                  p.isOnSale
                      ? '${p.discountPercent != null ? '-${p.discountPercent}%' : 'Sale'}'
                      : 'New',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: p.isOnSale ? c.onPrimary : c.onSurface,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    final info = Padding(
      padding: EdgeInsets.fromLTRB(widget.listView ? 14 : 2, 12, 2, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (p.providerName != null)
            Text(
              p.providerName!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: c.onSurfaceVariant),
            ),
          const SizedBox(height: 4),
          Text(
            p.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontSize: 14, height: 1.2),
          ),
          const SizedBox(height: 7),
          Text(
            p.price > 0 ? formatUgx(p.price) : 'Contact for price',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          if (p.isOnSale)
            Text(
              formatUgx(p.originalPrice),
              style: TextStyle(
                fontSize: 12,
                color: c.onSurfaceVariant,
                decoration: TextDecoration.lineThrough,
              ),
            ),
          if (p.district != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                p.district!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, color: c.onSurfaceVariant),
              ),
            ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.tonal(
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: const Size(48, 48),
              ),
              onPressed: p.type == 'product'
                  ? () {
                      ref.read(cartControllerProvider.notifier).add(p.id);
                      trackCommerce(ref, {'type': 'cart', 'listingId': p.id});
                    }
                  : open,
              child: AnimatedSwitcher(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 250),
                child: Text(
                  p.type == 'service'
                      ? (p.bookable ? 'View availability' : 'View service')
                      : inCart
                      ? 'Add another'
                      : 'Add to cart',
                  key: ValueKey(inCart),
                  style: const TextStyle(fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ],
      ),
    );
    return DesignEntrance(
      child: Semantics(
        button: true,
        label: 'View ${p.name}',
        child: Material(
          color: style == AppThemeStyle.discover || style == AppThemeStyle.orbit
              ? c.surfaceContainerLow
              : Colors.transparent,
          borderRadius: BorderRadius.circular(radius),
          child: InkWell(
            borderRadius: BorderRadius.circular(radius),
            onTap: open,
            child: Padding(
              padding: EdgeInsets.all(
                style == AppThemeStyle.discover || style == AppThemeStyle.orbit
                    ? 8
                    : 0,
              ),
              child: widget.listView
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 110, height: 160, child: image),
                        Expanded(child: info),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(child: image),
                        info,
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
