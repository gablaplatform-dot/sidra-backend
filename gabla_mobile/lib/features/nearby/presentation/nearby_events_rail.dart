import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/page_band.dart';
import '../../community/presentation/community_screens.dart' show eventDate;
import '../application/nearby_events_provider.dart';
import '../domain/nearby_result.dart';

class NearbyEventsRail extends ConsumerWidget {
  const NearbyEventsRail({
    super.key,
    required this.origin,
    required this.style,
  });

  final NearbyOrigin origin;
  final AppThemeStyle style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(nearbyEventsProvider(origin));
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final color = switch (style) {
      AppThemeStyle.editorial => c.surface,
      AppThemeStyle.cinematic => c.surfaceContainerHigh,
      AppThemeStyle.orbit => Color.lerp(c.surface, c.secondary, .08)!,
      _ => Color.lerp(c.surface, c.primary, .08)!,
    };
    final scale = MediaQuery.textScalerOf(context).scale(1);
    final height =
        (MediaQuery.sizeOf(context).height * .18).clamp(88.0, 142.0) +
        (scale - 1).clamp(0.0, 1.0) * 38;
    return PageBand(
      color: color,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Nearby events',
                style: AppTypography.of(context).display(size: 19),
              ),
            ),
            TextButton(
              onPressed: () => context.push('/events'),
              child: const Text('All events'),
            ),
          ],
        ),
        events.when(
          loading: () => const LinearProgressIndicator(),
          error: (_, _) => Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: () => refreshNearbyEvents(ref, origin),
              icon: const Icon(Icons.refresh, size: 17),
              label: const Text('Retry nearby events'),
            ),
          ),
          data: (items) => items.isEmpty
              ? Text(
                  origin.point == null
                      ? 'No events in this district in the next $nearbyEventDays days.'
                      : 'No events within ${origin.radiusKm.round()} km in the next $nearbyEventDays days.',
                  style: theme.textTheme.bodySmall,
                )
              : SizedBox(
                  height: height,
                  child: ListView.separated(
                    key: ValueKey(origin.label),
                    scrollDirection: Axis.horizontal,
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, index) =>
                        _EventPoster(event: items[index], style: style),
                  ),
                ),
        ),
      ],
    );
  }
}

class _EventPoster extends StatelessWidget {
  const _EventPoster({required this.event, required this.style});

  final NearbyEvent event;
  final AppThemeStyle style;

  @override
  Widget build(BuildContext context) {
    final post = event.post;
    final id = post['id'];
    final title = post['title']?.toString() ?? 'Event';
    final date = eventDate(post);
    final km = event.distanceKm;
    final meta = km == null ? date : '$date · ${km.toStringAsFixed(1)} km';
    final media = (post['media'] as List? ?? []).whereType<Map>();
    final poster =
        media.where((item) => item['type'] == 'image').firstOrNull?['url']
            as String?;
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final radius = switch (style) {
      AppThemeStyle.editorial => 2.0,
      AppThemeStyle.orbit => 6.0,
      AppThemeStyle.cinematic => 8.0,
      AppThemeStyle.gabla => 12.0,
      AppThemeStyle.discover => 16.0,
    };
    final portrait =
        style == AppThemeStyle.editorial || style == AppThemeStyle.orbit;
    final width = switch (style) {
      AppThemeStyle.editorial => 170.0,
      AppThemeStyle.orbit => 192.0,
      AppThemeStyle.gabla => 202.0,
      AppThemeStyle.discover => 220.0,
      AppThemeStyle.cinematic => 244.0,
    };
    final placeholder = ColoredBox(
      color: c.secondaryContainer,
      child: Center(
        child: Icon(
          Icons.local_activity_outlined,
          color: c.onSecondaryContainer,
        ),
      ),
    );
    final image = poster == null || poster.isEmpty
        ? placeholder
        : Image.network(
            poster,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => placeholder,
          );

    Widget details(Color ink) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleSmall?.copyWith(
            color: ink,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          meta,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(color: ink),
        ),
      ],
    );

    void open() =>
        context.push('/events/p/${Uri.encodeComponent(id.toString())}');
    return Semantics(
      button: true,
      onTap: id == null ? null : open,
      label: '$title, $meta',
      excludeSemantics: true,
      child: Material(
        color: c.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: c.outlineVariant),
        ),
        child: SizedBox(
          width: width,
          child: InkWell(
            onTap: id == null ? null : open,
            child: portrait
                ? Row(
                    children: [
                      SizedBox(
                        width: 58,
                        height: double.infinity,
                        child: image,
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: details(c.onSurface),
                        ),
                      ),
                    ],
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      image,
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Colors.black87],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 12,
                        right: 12,
                        bottom: 10,
                        child: details(Colors.white),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
