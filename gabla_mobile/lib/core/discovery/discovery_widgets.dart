import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../motion/design_transitions.dart';
import '../theme/app_theme_style.dart';
import '../theme/font_group.dart';
import '../../features/provider/domain/provider_summary.dart';
import '../../features/shop/domain/product.dart';
import '../../features/shop/presentation/commerce_widgets.dart';
import '../utils/money.dart';

class DiscoveryHeader extends ConsumerWidget {
  const DiscoveryHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.eyebrow = 'GABLA / DISCOVER',
    this.artwork = 'services',
    this.child,
  });
  final String title, subtitle, eyebrow, artwork;
  final Widget? child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = commerceStyle(ref), c = Theme.of(context).colorScheme;
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: TextStyle(
            fontSize: 9,
            letterSpacing: 2,
            color: style == AppThemeStyle.discover ? Colors.white70 : c.primary,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          title,
          style: AppTypography.of(context).display(
            size: style == AppThemeStyle.editorial ? 38 : 32,
            color: style == AppThemeStyle.discover ? Colors.white : c.onSurface,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            height: 1.5,
            color: style == AppThemeStyle.discover
                ? Colors.white70
                : c.onSurfaceVariant,
          ),
        ),
      ],
    );
    final image = Image.asset('assets/artwork/$artwork.png', fit: BoxFit.cover);
    return DesignEntrance(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          switch (style) {
            AppThemeStyle.discover => ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: Stack(
                children: [
                  SizedBox(height: 270, width: double.infinity, child: image),
                  const Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.black87, Colors.transparent],
                        ),
                      ),
                    ),
                  ),
                  Padding(padding: const EdgeInsets.all(24), child: words),
                ],
              ),
            ),
            AppThemeStyle.editorial => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                words,
                const Divider(height: 28),
                ClipRRect(
                  borderRadius: BorderRadius.circular(5),
                  child: SizedBox(height: 140, child: image),
                ),
              ],
            ),
            AppThemeStyle.cinematic => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                words,
                const SizedBox(height: 22),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(height: 180, child: image),
                ),
              ],
            ),
            AppThemeStyle.orbit => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                words,
                const SizedBox(height: 18),
                Center(
                  child: ClipOval(
                    child: SizedBox(width: 240, height: 170, child: image),
                  ),
                ),
              ],
            ),
            _ => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: SizedBox(height: 170, child: image),
                ),
                const SizedBox(height: 22),
                words,
              ],
            ),
          },
          if (child != null)
            Padding(padding: const EdgeInsets.only(top: 20), child: child!),
        ],
      ),
    );
  }
}

class ProviderDiscoveryCard extends ConsumerWidget {
  const ProviderDiscoveryCard({super.key, required this.provider});
  final ProviderSummary provider;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: InkWell(
      onTap: () => context.push('/provider/${provider.id}'),
      borderRadius: BorderRadius.circular(commerceRadius(commerceStyle(ref))),
      child: CommercePanel(
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                width: 64,
                height: 64,
                child: provider.logoUrl != null
                    ? CommerceImage(provider.logoUrl)
                    : ColoredBox(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        child: Center(
                          child: Text(
                            provider.businessName.isEmpty
                                ? 'G'
                                : provider.businessName[0],
                            style: const TextStyle(fontSize: 26),
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    provider.businessName,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (provider.district != null)
                    Text(
                      provider.district!,
                      style: const TextStyle(fontSize: 12),
                    ),
                  Text(
                    provider.ratingCount > 0
                        ? '★ ${provider.rating?.toStringAsFixed(1) ?? '—'} · ${provider.ratingCount} reviews'
                        : 'New on Gabla',
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.north_east, size: 18),
          ],
        ),
      ),
    ),
  );
}

class ListingDiscoveryCard extends ConsumerWidget {
  const ListingDiscoveryCard({super.key, required this.product});
  final Product product;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: InkWell(
      onTap: () => context.push('/shop/product/${product.id}'),
      borderRadius: BorderRadius.circular(commerceRadius(commerceStyle(ref))),
      child: CommercePanel(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                width: 80,
                height: 90,
                child: CommerceImage(product.imageUrl),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (product.providerName != null)
                    Text(
                      product.providerName!,
                      style: const TextStyle(fontSize: 11),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    product.price > 0
                        ? '${formatUgx(product.price)}${product.bookable ? ' / ${product.booking?.unit.name ?? 'booking'}' : ''}'
                        : 'Ask for a quote',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  if (product.bookable)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text(
                        'Book online',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
