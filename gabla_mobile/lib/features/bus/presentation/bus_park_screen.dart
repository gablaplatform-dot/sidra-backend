import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/location/google_route_map.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../ride/domain/ride_location.dart';
import '../application/bus_providers.dart';

final _parkProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, slug) => ref.watch(busRepositoryProvider).fetchPark(slug),
);

class BusParkScreen extends ConsumerWidget {
  const BusParkScreen({super.key, required this.slug});
  final String slug;
  @override
  Widget build(BuildContext context, WidgetRef ref) => AsyncValueView(
    value: ref.watch(_parkProvider(slug)),
    onRetry: () => ref.invalidate(_parkProvider(slug)),
    data: (context, p) => MobilityLayout(
      bus: true,
      title: '${p['companyName'] ?? 'Bus company'}',
      subtitle: [
        p['parkName'],
        p['parkDistrict'],
      ].whereType<String>().join(' · '),
      scene: p['parkLat'] != null && p['parkLng'] != null
          ? GoogleRouteMap(
              fromLabel: 'Bus park',
              from: RideLocation(
                lat: double.parse('${p['parkLat']}'),
                lng: double.parse('${p['parkLng']}'),
                address: '${p['parkAddress'] ?? p['parkName'] ?? ''}',
              ),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (p['description'] != null)
            Text('${p['description']}', style: const TextStyle(height: 1.5)),
          if (p['parkAddress'] != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.location_on_outlined),
              title: Text('${p['parkAddress']}'),
            ),
          if (p['contactPhone'] != null)
            OutlinedButton.icon(
              onPressed: () =>
                  launchUrl(Uri(scheme: 'tel', path: '${p['contactPhone']}')),
              icon: const Icon(Icons.phone_outlined),
              label: const Text('Call company'),
            ),
          const SizedBox(height: 20),
          Text(
            'Explore their routes',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          for (final r in p['routes'] as List? ?? [])
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${r['originName']} → ${r['destinationName']}'),
              subtitle: Text('${r['boardingPoint'] ?? p['parkName'] ?? ''}'),
              trailing: const Icon(Icons.arrow_forward),
              onTap: () => context.push(
                '/bus/search',
                extra: BusSearchQuery(
                  date: DateFormat('yyyy-MM-dd').format(
                    DateTime.now().toUtc().add(const Duration(hours: 3)),
                  ),
                  from: '${r['originName']}',
                  to: '${r['destinationName']}',
                  operatorSlug: slug,
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
