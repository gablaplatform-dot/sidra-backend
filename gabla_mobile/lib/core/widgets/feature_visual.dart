import 'package:flutter/material.dart';

/// Theme-aware Material symbols for destinations, never synthetic photography.
IconData featureIcon(String kind) => switch (kind) {
  'shop' || 'product' => Icons.shopping_bag_outlined,
  'services' || 'service' => Icons.handyman_outlined,
  'bus' => Icons.directions_bus_outlined,
  'ride' => Icons.local_taxi_outlined,
  'jobs' || 'job' => Icons.work_outline,
  'events' || 'event' => Icons.local_activity_outlined,
  'nearby' => Icons.location_on_outlined,
  _ => Icons.grid_view_outlined,
};

class FeatureVisual extends StatelessWidget {
  const FeatureVisual({super.key, required this.kind, this.emphasized = false});
  final String kind;
  final bool emphasized;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return ExcludeSemantics(
      child: ColoredBox(
        color: emphasized ? c.primary : c.surfaceContainerLow,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final side = constraints.biggest.shortestSide;
            final size = side.isFinite ? (side * .43).clamp(24.0, 68.0) : 48.0;
            return Center(
              child: Icon(
                featureIcon(kind),
                size: size,
                color: emphasized ? c.onPrimary : c.primary,
              ),
            );
          },
        ),
      ),
    );
  }
}
