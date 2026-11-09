import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../settings/application/theme_controller.dart';
import '../domain/bus_trip.dart';

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
            Icon(Icons.directions_bus_outlined, size: 20, color: c.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                trip.companyName ?? 'Bus operator',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            if (trip.seatsAvailable != null)
              Text(
                '${trip.seatsAvailable} left',
                style: TextStyle(fontSize: 11, color: c.primary),
              ),
          ],
        ),
        const SizedBox(height: 22),
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
                        : 'Direct route',
                    style: TextStyle(fontSize: 10, color: c.onSurfaceVariant),
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
                    formatUgx(trip.price),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            IconButton.filledTonal(
              tooltip: 'View trip',
              onPressed: () => context.push('/bus/trip/${trip.id}'),
              icon: const Icon(Icons.arrow_forward),
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
          borderRadius: BorderRadius.circular(24),
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
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                  child: Image.asset(
                    'assets/artwork/bus.jpg',
                    height: 100,
                    fit: BoxFit.cover,
                  ),
                ),
                MobilityPanel(radius: 8, child: content),
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
            AppThemeStyle.orbit => MobilityPanel(radius: 34, child: content),
            _ => MobilityPanel(child: content),
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
