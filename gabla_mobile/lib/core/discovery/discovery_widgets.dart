import '../widgets/feature_visual.dart';
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
    this.eyebrow = '',
    this.artwork = 'services',
    this.showArtwork = true,
    this.child,
  });
  final String title, subtitle, eyebrow, artwork;
  final bool showArtwork;
  final Widget? child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = commerceStyle(ref), theme = Theme.of(context);
    final radius = switch (style) {
      AppThemeStyle.editorial => 0.0,
      AppThemeStyle.orbit => 4.0,
      AppThemeStyle.cinematic => 6.0,
      AppThemeStyle.gabla => 8.0,
      AppThemeStyle.discover => 12.0,
    };
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (eyebrow.isNotEmpty) ...[
          Text(
            eyebrow,
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 8),
        ],
        Text(
          title.replaceAll('\n', ' '),
          style: AppTypography.of(
            context,
          ).display(size: style == AppThemeStyle.editorial ? 30 : 27),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            height: 1.5,
          ),
        ),
      ],
    );
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: FeatureVisual(kind: artwork),
    );
    return DesignEntrance(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!showArtwork)
            words
          else
            switch (style) {
              AppThemeStyle.orbit => LayoutBuilder(
                builder: (context, constraints) {
                  if (constraints.maxWidth < 350 ||
                      MediaQuery.textScalerOf(context).scale(1) > 1.2) {
                    return words;
                  }
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: words),
                      const SizedBox(width: 16),
                      SizedBox(width: 92, height: 112, child: image),
                    ],
                  );
                },
              ),
              AppThemeStyle.editorial => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [words, const Divider(height: 26)],
              ),
              AppThemeStyle.discover => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(height: 140, child: image),
                  const SizedBox(height: 16),
                  words,
                ],
              ),
              AppThemeStyle.cinematic => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  words,
                  const SizedBox(height: 16),
                  SizedBox(height: 150, child: image),
                ],
              ),
              AppThemeStyle.gabla => words,
            },
          if (child != null)
            Padding(padding: const EdgeInsets.only(top: 18), child: child!),
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
              borderRadius: BorderRadius.circular(6),
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
              borderRadius: BorderRadius.circular(6),
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
