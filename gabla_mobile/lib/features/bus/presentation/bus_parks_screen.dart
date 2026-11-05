import 'bus_design_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/async_value_view.dart';
import '../application/bus_providers.dart';

class BusParksScreen extends ConsumerStatefulWidget {
  const BusParksScreen({super.key});
  @override
  ConsumerState<BusParksScreen> createState() => _BusParksScreenState();
}

class _BusParksScreenState extends ConsumerState<BusParksScreen> {
  String _query = '';
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Bus companies & parks')),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(18),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Company, park or district',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (v) => setState(() => _query = v.toLowerCase()),
          ),
        ),
        Expanded(
          child: AsyncValueView(
            value: ref.watch(busParksProvider),
            onRetry: () => ref.invalidate(busParksProvider),
            data: (context, all) {
              final items = all
                  .where(
                    (p) =>
                        '${p['companyName']} ${p['parkName']} ${p['parkDistrict']}'
                            .toLowerCase()
                            .contains(_query),
                  )
                  .toList();
              if (items.isEmpty)
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.directions_bus_outlined, size: 40),
                        const SizedBox(height: 12),
                        Text(
                          all.isEmpty
                              ? 'No bus companies available'
                              : 'No matching bus companies',
                          style: Theme.of(context).textTheme.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          all.isEmpty
                              ? 'Try again later to see companies and bus parks.'
                              : 'Try another company, park or district.',
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final p = items[i];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: InkWell(
                      onTap: () => context.push('/bus/parks/${p['slug']}'),
                      child: BusPanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.directions_bus_outlined),
                            const SizedBox(height: 12),
                            Text(
                              '${p['companyName'] ?? 'Bus company'}',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              [
                                p['parkName'],
                                p['parkDistrict'],
                              ].whereType<String>().join(' · '),
                            ),
                            if (p['destinations'] is List)
                              Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: Text(
                                  (p['destinations'] as List).join(' · '),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    ),
  );
}
