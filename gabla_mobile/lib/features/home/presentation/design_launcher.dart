import '../../../core/widgets/feature_visual.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/artwork_hero.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';

const destinations = [
  (
    'Shop',
    'Browse products from sellers',
    Icons.shopping_bag_outlined,
    '/shop',
  ),
  (
    'Services',
    'Find businesses and book services',
    Icons.handyman_outlined,
    '/services',
  ),
  (
    'Bus tickets',
    'Search routes and available seats',
    Icons.directions_bus_outlined,
    '/bus',
  ),
  (
    'Get a ride',
    'Set your pickup and destination',
    Icons.local_taxi_outlined,
    '/ride',
  ),
  ('Jobs', 'Find vacancies and paid tasks', Icons.work_outline, '/jobs'),
  (
    'Events',
    'See events, venues and entrance prices',
    Icons.local_activity_outlined,
    '/events',
  ),
];
const serviceArtwork = ['shop', 'services', 'bus', 'ride', 'jobs', 'events'];

/// The same six destinations, arranged around a different hierarchy per design.
class DesignLauncher extends StatelessWidget {
  const DesignLauncher({super.key, required this.style});
  final AppThemeStyle style;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final radius = switch (style) {
      AppThemeStyle.editorial => 0.0,
      AppThemeStyle.orbit => 4.0,
      AppThemeStyle.cinematic => 6.0,
      AppThemeStyle.gabla => 8.0,
      AppThemeStyle.discover => 12.0,
    };
    Widget tile(int index, {bool wide = false, bool poster = false}) =>
        DesignEntrance(
          index: index,
          child: _DestinationTile(
            index: index,
            radius: radius,
            wide: wide,
            poster: poster,
          ),
        );
    final heading = Padding(
      padding: const EdgeInsets.fromLTRB(0, 22, 0, 16),
      child: Text(
        'What would you like to do?',
        style: AppTypography.of(context).display(
          size: style == AppThemeStyle.editorial ? 29 : 25,
          color: theme.colorScheme.onSurface,
        ),
      ),
    );
    Widget pair(int a, int b) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: tile(a)),
          const SizedBox(width: 12),
          Expanded(child: tile(b)),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        heading,
        switch (style) {
          AppThemeStyle.gabla => Column(
            children: [pair(0, 1), pair(3, 2), pair(4, 5)],
          ),
          AppThemeStyle.editorial => Column(
            children: [
              for (var i = 0; i < destinations.length; i++)
                _EditorialDestination(index: i),
            ],
          ),
          AppThemeStyle.discover => Column(
            children: [
              tile(0, wide: true, poster: true),
              const SizedBox(height: 12),
              pair(1, 5),
              for (final i in [3, 2, 4]) ...[
                tile(i, wide: true),
                const SizedBox(height: 10),
              ],
            ],
          ),
          AppThemeStyle.cinematic => Column(
            children: [
              tile(3, wide: true, poster: true),
              const SizedBox(height: 12),
              for (final i in [0, 1, 2, 4, 5]) ...[
                tile(i, wide: true),
                const SizedBox(height: 8),
              ],
            ],
          ),
          AppThemeStyle.orbit => Column(
            children: [
              pair(3, 2),
              tile(0, wide: true),
              const SizedBox(height: 10),
              tile(1, wide: true),
              const SizedBox(height: 12),
              pair(4, 5),
            ],
          ),
        },
      ],
    );
  }
}

class _DestinationTile extends StatelessWidget {
  const _DestinationTile({
    required this.index,
    required this.radius,
    this.wide = false,
    this.poster = false,
  });
  final int index;
  final double radius;
  final bool wide, poster;

  @override
  Widget build(BuildContext context) {
    final d = destinations[index], theme = Theme.of(context);
    final image = ArtworkHero(
      tag: 'service-artwork-$index',
      child: FeatureVisual(kind: serviceArtwork[index]),
    );
    final words = Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  d.$1,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Icon(Icons.arrow_forward, size: 16),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            d.$2,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
    return Semantics(
      button: true,
      child: Material(
        color: theme.colorScheme.surfaceContainerLow,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(
            color: theme.colorScheme.outlineVariant.withValues(alpha: .65),
          ),
        ),
        child: InkWell(
          onTap: () {
            HapticFeedback.selectionClick();
            context.push(d.$4);
          },
          child: poster
              ? Row(
                  children: [
                    SizedBox(width: 112, height: 140, child: image),
                    Expanded(child: words),
                  ],
                )
              : wide
              ? Row(
                  children: [
                    SizedBox(width: 80, height: 94, child: image),
                    Expanded(child: words),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(height: 96, child: image),
                    words,
                  ],
                ),
        ),
      ),
    );
  }
}

class _EditorialDestination extends StatelessWidget {
  const _EditorialDestination({required this.index});
  final int index;
  @override
  Widget build(BuildContext context) {
    final d = destinations[index], theme = Theme.of(context);
    return DesignEntrance(
      index: index,
      child: Column(
        children: [
          const Divider(height: 1),
          InkWell(
            onTap: () => context.push(d.$4),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    '0${index + 1}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d.$1,
                          style: AppTypography.of(context).display(size: 24),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          d.$2,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 64,
                    height: 64,
                    child: ArtworkHero(
                      tag: 'service-artwork-$index',
                      child: FeatureVisual(kind: serviceArtwork[index]),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Icon(Icons.north_east, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
