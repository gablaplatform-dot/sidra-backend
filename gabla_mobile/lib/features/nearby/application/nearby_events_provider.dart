import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/network/network_providers.dart';
import '../domain/nearby_result.dart';

typedef NearbyEvent = ({Map<String, dynamic> post, double? distanceKm});

const nearbyEventDays = 30;

final _eventFeedProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, district) async {
      final api = ref.watch(apiClientProvider);
      final to = DateTime.now().toUtc().add(
        const Duration(days: nearbyEventDays),
      );
      const limit = 40;
      final events = <Map<String, dynamic>>[];
      for (var page = 1; ; page++) {
        final response = await api.get<Map<String, dynamic>>(
          '/events',
          query: {
            if (district != null) 'district': district,
            'to': to.toIso8601String(),
            'limit': limit,
            'page': page,
          },
        );
        final items = (response['items'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        events.addAll(items);
        final total = response['total'] as num?;
        if (items.length < limit || (total != null && events.length >= total)) {
          return events;
        }
      }
    });

final nearbyEventsProvider = Provider.autoDispose
    .family<AsyncValue<List<NearbyEvent>>, NearbyOrigin>((ref, origin) {
      final point = origin.point;
      return ref
          .watch(_eventFeedProvider(point == null ? origin.district : null))
          .whenData((events) {
            if (point == null) {
              return events
                  .take(8)
                  .map((post) => (post: post, distanceKm: null as double?))
                  .toList();
            }
            final nearby = <NearbyEvent>[];
            const distance = Distance(roundResult: false);
            for (final post in events) {
              final lat = double.tryParse('${post['lat']}');
              final lng = double.tryParse('${post['lng']}');
              if (lat == null ||
                  lng == null ||
                  !lat.isFinite ||
                  !lng.isFinite ||
                  lat.abs() > 90 ||
                  lng.abs() > 180) {
                continue;
              }
              final km = distance(point, LatLng(lat, lng)) / 1000;
              if (km <= origin.radiusKm) {
                nearby.add((post: post, distanceKm: km));
              }
            }
            nearby.sort((a, b) => a.distanceKm!.compareTo(b.distanceKm!));
            return nearby.take(8).toList();
          });
    });

void refreshNearbyEvents(WidgetRef ref, NearbyOrigin origin) {
  ref.invalidate(
    _eventFeedProvider(origin.point == null ? origin.district : null),
  );
}
