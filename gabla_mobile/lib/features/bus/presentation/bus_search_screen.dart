import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/widgets/async_value_view.dart';
import '../application/bus_providers.dart';
import 'bus_design_widgets.dart';

class BusSearchScreen extends ConsumerStatefulWidget {
  const BusSearchScreen({super.key, required this.query});
  final BusSearchQuery? query;
  @override
  ConsumerState<BusSearchScreen> createState() => _BusSearchScreenState();
}

class _BusSearchScreenState extends ConsumerState<BusSearchScreen> {
  String _sort = 'Departure', _time = 'All day', _company = 'All operators';
  bool _available = false;
  int _dayOffset = 0;
  @override
  Widget build(BuildContext context) {
    final q = widget.query;
    if (q == null)
      return Scaffold(
        appBar: AppBar(title: const Text('Find a bus')),
        body: Center(
          child: FilledButton(
            onPressed: () => context.go('/bus'),
            child: const Text('Choose your route'),
          ),
        ),
      );
    final day = DateTime.parse(q.date).add(Duration(days: _dayOffset));
    final current = BusSearchQuery(
      date: DateFormat('yyyy-MM-dd').format(day),
      from: q.from,
      to: q.to,
      operatorSlug: q.operatorSlug,
    );
    final result = ref.watch(busSearchResultsProvider(current));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Find your departure'),
        actions: [
          IconButton(
            tooltip: 'Design Studio',
            onPressed: () => context.push('/settings/appearance'),
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            child: MobilityPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${q.from} → ${q.to}',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${DateFormat('EEE, d MMM').format(day)} · East Africa Time',
                    style: const TextStyle(fontSize: 12),
                  ),
                  const SizedBox(height: 14),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (var i = 0; i < 5; i++)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              selected: i == _dayOffset,
                              label: Text(
                                DateFormat('EEE d').format(
                                  DateTime.parse(q.date).add(Duration(days: i)),
                                ),
                              ),
                              onSelected: (_) => setState(() => _dayOffset = i),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  PopupMenuButton<String>(
                    initialValue: _sort,
                    onSelected: (v) => setState(() => _sort = v),
                    itemBuilder: (_) => [
                      for (final s in ['Departure', 'Lowest price', 'Fastest'])
                        PopupMenuItem(value: s, child: Text(s)),
                    ],
                    child: Chip(
                      avatar: const Icon(Icons.sort, size: 18),
                      label: Text(_sort),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    initialValue: _time,
                    onSelected: (v) => setState(() => _time = v),
                    itemBuilder: (_) => [
                      for (final s in [
                        'All day',
                        'Morning',
                        'Afternoon',
                        'Evening',
                        'Night',
                      ])
                        PopupMenuItem(value: s, child: Text(s)),
                    ],
                    child: Chip(
                      avatar: const Icon(Icons.schedule, size: 18),
                      label: Text(_time),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    initialValue: _company,
                    onSelected: (v) => setState(() => _company = v),
                    itemBuilder: (_) => [
                      for (final s in {
                        'All operators',
                        ...?result.valueOrNull?.map(
                          (t) => t.companyName ?? 'Bus operator',
                        ),
                      })
                        PopupMenuItem(value: s, child: Text(s)),
                    ],
                    child: Chip(label: Text(_company)),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Available only'),
                    selected: _available,
                    onSelected: (v) => setState(() => _available = v),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: AsyncValueView(
              value: result,
              onRetry: () => ref.invalidate(busSearchResultsProvider(current)),
              data: (context, all) {
                final trips = all.where((t) {
                  if (_available && !t.bookable) return false;
                  if (_company != 'All operators' &&
                      (t.companyName ?? 'Bus operator') != _company)
                    return false;
                  final h = t.departAtEat.hour;
                  return switch (_time) {
                    'Morning' => h >= 5 && h < 12,
                    'Afternoon' => h >= 12 && h < 17,
                    'Evening' => h >= 17 && h < 21,
                    'Night' => h >= 21 || h < 5,
                    _ => true,
                  };
                }).toList();
                trips.sort(
                  (a, b) => switch (_sort) {
                    'Lowest price' => a.price.compareTo(b.price),
                    'Fastest' =>
                      (a.durationMinutes == 0 ? 999999 : a.durationMinutes)
                          .compareTo(
                            b.durationMinutes == 0 ? 999999 : b.durationMinutes,
                          ),
                    _ => a.departAt.compareTo(b.departAt),
                  },
                );
                if (trips.isEmpty)
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(26),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.directions_bus_outlined, size: 46),
                          const SizedBox(height: 14),
                          Text(
                            all.isEmpty
                                ? 'No departures on this date'
                                : 'No trips match these filters',
                            style: Theme.of(context).textTheme.titleLarge,
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Try another date or adjust your search.',
                            textAlign: TextAlign.center,
                          ),
                          TextButton(
                            onPressed: () => setState(() {
                              _time = 'All day';
                              _company = 'All operators';
                              _available = false;
                            }),
                            child: const Text('Clear filters'),
                          ),
                        ],
                      ),
                    ),
                  );
                return ListView.builder(
                  padding: const EdgeInsets.all(18),
                  itemCount: trips.length,
                  itemBuilder: (_, i) =>
                      BusJourneyCard(trip: trips[i], index: i),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
