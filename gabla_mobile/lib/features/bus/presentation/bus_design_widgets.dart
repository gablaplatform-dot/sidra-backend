import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/utils/money.dart';
import '../../settings/application/theme_controller.dart';
import '../domain/bus_trip.dart';
import '../../../core/widgets/feature_visual.dart';

/// Icon-only decoration: never implies a particular operator, fleet or route.
class BusScene extends ConsumerWidget {
  const BusScene({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    final c = Theme.of(context).colorScheme;
    return ExcludeSemantics(
      child: ColoredBox(
        color: c.surfaceContainerLow,
        child: Center(
          child: switch (style) {
            AppThemeStyle.editorial => Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.trip_origin, color: c.primary, size: 20),
                SizedBox(width: 48, child: Divider(color: c.outlineVariant)),
                Icon(featureIcon('bus'), color: c.primary, size: 64),
                SizedBox(width: 48, child: Divider(color: c.outlineVariant)),
                Icon(Icons.location_on_outlined, color: c.primary, size: 20),
              ],
            ),
            AppThemeStyle.orbit => Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: c.primary.withValues(alpha: .3),
                  width: 2,
                ),
              ),
              child: Icon(featureIcon('bus'), color: c.primary, size: 56),
            ),
            AppThemeStyle.cinematic => Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: c.primary, width: 3)),
              ),
              child: Icon(featureIcon('bus'), color: c.primary, size: 64),
            ),
            AppThemeStyle.discover => Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.route_outlined,
                  color: c.primary.withValues(alpha: .5),
                  size: 36,
                ),
                const SizedBox(width: 20),
                Icon(featureIcon('bus'), color: c.primary, size: 76),
              ],
            ),
            AppThemeStyle.gabla => Icon(
              featureIcon('bus'),
              color: c.primary,
              size: 72,
            ),
          },
        ),
      ),
    );
  }
}

/// Bus-owned surfaces follow the user's global corner tokens.
class BusPanel extends ConsumerWidget {
  const BusPanel({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = Theme.of(context).colorScheme;
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surfaceContainerLow,
        borderRadius: BorderRadius.circular(
          Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8,
        ),
        border: Border.all(
          color: style == AppThemeStyle.editorial ? c.onSurface : c.outlineVariant,
          width: style == AppThemeStyle.editorial ? 1.5 : 1,
        ),
      ),
      child: child,
    );
  }
}

/// A compact route control; it keeps the field label visible after selection.
class BusJourneyField extends StatelessWidget {
  const BusJourneyField({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });
  final String label, value;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Material(
      color: c.surfaceContainerLow,
      shape: Theme.of(context).cardTheme.shape,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(icon, size: 20, color: c.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      value,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.expand_more, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class BusJourneyCard extends ConsumerWidget {
  const BusJourneyCard({super.key, required this.trip, this.index = 0});
  final BusTrip trip;
  final int index;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    final c = Theme.of(context).colorScheme;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(featureIcon('bus'), size: 20, color: c.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                trip.companyName ?? 'Bus operator',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            if (trip.seatsAvailable != null)
              Text(
                '${trip.seatsAvailable} seats left',
                style: TextStyle(fontSize: 11, color: c.primary),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _station(
                context,
                DateFormat('HH:mm').format(trip.departAtEat),
                trip.originName,
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  const Icon(Icons.east, size: 19),
                  const SizedBox(height: 5),
                  Text(
                    trip.durationMinutes > 0
                        ? '${trip.durationMinutes ~/ 60}h ${trip.durationMinutes % 60}m'
                        : 'Duration unavailable',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _station(
                context,
                trip.durationMinutes > 0
                    ? DateFormat('HH:mm').format(trip.arriveAtEat)
                    : '—',
                trip.destinationName,
              ),
            ),
          ],
        ),
        if (trip.delayMinutes > 0)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'Delayed ${trip.delayMinutes} min',
              style: TextStyle(color: c.error, fontSize: 12),
            ),
          ),
        const SizedBox(height: 18),
        Divider(color: c.outlineVariant),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trip.busTypeName ?? 'Coach',
                    style: const TextStyle(fontSize: 11),
                  ),
                  Text(
                    'From ${formatUgx(trip.price)}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => context.push('/bus/trip/${trip.id}'),
              child: Text(trip.bookable ? 'View tickets' : 'View trip'),
            ),
          ],
        ),
        if (trip.amenities.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              trip.amenities.join(' · '),
              style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
            ),
          ),
      ],
    );
    return DesignEntrance(
      index: index,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: InkWell(
          onTap: () => context.push('/bus/trip/${trip.id}'),
          customBorder: Theme.of(context).cardTheme.shape,
          child: switch (style) {
            AppThemeStyle.editorial => Container(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 6),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: c.onSurface, width: 2)),
              ),
              child: content,
            ),
            AppThemeStyle.discover => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Discovery keeps the travel rail without repeating a large
                // decorative coach image on every departure.
                Container(height: 3, color: c.primary),
                BusPanel(child: content),
              ],
            ),
            AppThemeStyle.cinematic => Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: c.primary, width: 3)),
                color: c.surfaceContainerHighest.withValues(alpha: .4),
              ),
              child: content,
            ),
            AppThemeStyle.orbit => BusPanel(child: content),
            _ => BusPanel(child: content),
          },
        ),
      ),
    );
  }

  Widget _station(BuildContext context, String time, String name) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        time,
        style: const TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w800,
          letterSpacing: -1,
        ),
      ),
      const SizedBox(height: 6),
      Text(name, style: const TextStyle(fontSize: 12), maxLines: 2),
    ],
  );
}
