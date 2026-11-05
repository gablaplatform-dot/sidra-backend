import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../application/bus_providers.dart';
import 'bus_design_widgets.dart';

class BusHomeScreen extends ConsumerStatefulWidget {
  const BusHomeScreen({super.key});
  @override
  ConsumerState<BusHomeScreen> createState() => _BusHomeScreenState();
}

class _BusHomeScreenState extends ConsumerState<BusHomeScreen> {
  String _from = '', _to = '';
  DateTime _date = DateUtils.dateOnly(
    DateTime.now().toUtc().add(const Duration(hours: 3)),
  );
  void _search([String? from, String? to]) {
    final a = (from ?? _from).trim(), b = (to ?? _to).trim();
    if (a.isEmpty || b.isEmpty || a.toLowerCase() == b.toLowerCase()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Choose two different towns.')),
      );
      return;
    }
    context.push(
      '/bus/search',
      extra: BusSearchQuery(
        date: DateFormat('yyyy-MM-dd').format(_date),
        from: a,
        to: b,
      ),
    );
  }

  Future<void> _town(bool origin) async {
    final placesState = ref.read(busPlacesProvider);
    final places = placesState.valueOrNull;
    final options =
        (places?[origin ? 'origins' : 'destinations'] as List? ?? [])
            .map((p) => '$p')
            .toList();
    final value = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _TownPicker(
        title: origin ? 'Leaving from' : 'Travelling to',
        options: options,
        notice: placesState.hasError
            ? 'Town suggestions could not load. You can still type a town.'
            : placesState.isLoading
            ? 'Town suggestions are loading. You can also type a town.'
            : null,
      ),
    );
    if (value != null && mounted)
      setState(() {
        if (origin) {
          _from = value;
        } else {
          _to = value;
        }
      });
  }

  @override
  Widget build(BuildContext context) {
    final routes = ref.watch(popularRoutesProvider);
    ref.watch(busPlacesProvider);
    return MobilityLayout(
      bus: true,
      scene: const SizedBox(height: 112, child: BusScene()),
      title: 'Find a bus',
      subtitle: 'Choose your towns and date to compare departures.',
      actions: [
        IconButton(
          tooltip: 'My tickets',
          onPressed: () => context.push('/bus/tickets'),
          icon: const Icon(Icons.confirmation_number_outlined),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BusJourneyField(
            label: 'From',
            value: _from.isEmpty ? 'Departure town' : _from,
            icon: Icons.trip_origin,
            onTap: () => _town(true),
          ),
          SizedBox(
            height: 48,
            child: Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                tooltip: 'Swap towns',
                onPressed: () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    final v = _from;
                    _from = _to;
                    _to = v;
                  });
                },
                icon: const Icon(Icons.swap_vert),
              ),
            ),
          ),
          BusJourneyField(
            label: 'To',
            value: _to.isEmpty ? 'Destination town' : _to,
            icon: Icons.location_on_outlined,
            onTap: () => _town(false),
          ),
          const SizedBox(height: 12),
          BusJourneyField(
            label: 'Departure',
            value: DateFormat('EEE, d MMM yyyy').format(_date),
            icon: Icons.calendar_today_outlined,
            onTap: () async {
              final today = DateUtils.dateOnly(
                DateTime.now().toUtc().add(const Duration(hours: 3)),
              );
              final d = await showDatePicker(
                context: context,
                initialDate: _date.isBefore(today) ? today : _date,
                firstDate: today,
                lastDate: today.add(const Duration(days: 180)),
              );
              if (d != null && mounted) setState(() => _date = d);
            },
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            children: [
              for (var i = 0; i < 3; i++)
                ChoiceChip(
                  selected: DateUtils.isSameDay(
                    _date,
                    DateTime.now().toUtc().add(Duration(hours: 3, days: i)),
                  ),
                  label: Text(
                    i == 0
                        ? 'Today'
                        : i == 1
                        ? 'Tomorrow'
                        : 'In 2 days',
                  ),
                  onSelected: (_) => setState(
                    () => _date = DateUtils.dateOnly(
                      DateTime.now().toUtc().add(Duration(hours: 3, days: i)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => _search(),
            icon: const Icon(Icons.search),
            label: const Padding(
              padding: EdgeInsets.all(14),
              child: Text('Search buses'),
            ),
          ),
        ],
      ),
      footer: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MobilitySection(
            title: 'Popular routes',
            child: AsyncValueView(
              value: routes,
              onRetry: () => ref.invalidate(popularRoutesProvider),
              data: (context, items) => items.isEmpty
                  ? const Text('Choose your towns above to find a departure.')
                  : Column(
                      children: [
                        for (var i = 0; i < items.length; i++)
                          DesignEntrance(
                            index: i,
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Material(
                                color: Theme.of(
                                  context,
                                ).colorScheme.surfaceContainerLow,
                                shape: Theme.of(context).cardTheme.shape,
                                child: InkWell(
                                  customBorder: Theme.of(
                                    context,
                                  ).cardTheme.shape,
                                  onTap: () => _search(
                                    items[i].originName,
                                    items[i].destinationName,
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        CircleAvatar(
                                          child: Text(
                                            items[i].destinationName.isEmpty
                                                ? '→'
                                                : items[i].destinationName
                                                      .substring(0, 1),
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '${items[i].originName} → ${items[i].destinationName}',
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              Text(
                                                items[i].price > 0
                                                    ? 'From ${formatUgx(items[i].price)}'
                                                    : 'View departures',
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Icon(Icons.north_east, size: 18),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => context.push('/bus/parks'),
            icon: const Icon(Icons.location_city_outlined),
            label: const Text('Bus companies & parks'),
          ),
        ],
      ),
    );
  }
}

class _TownPicker extends StatefulWidget {
  const _TownPicker({required this.title, required this.options, this.notice});
  final String title;
  final List<String> options;
  final String? notice;
  @override
  State<_TownPicker> createState() => _TownPickerState();
}

class _TownPickerState extends State<_TownPicker> {
  String _query = '';
  @override
  Widget build(BuildContext context) {
    final results = widget.options
        .where((p) => p.toLowerCase().contains(_query.toLowerCase()))
        .toList();
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        22,
        22,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .65,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            TextField(
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Search a town',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
              onSubmitted: (v) {
                if (v.trim().isNotEmpty) Navigator.pop(context, v.trim());
              },
            ),
            const SizedBox(height: 12),
            if (widget.notice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  widget.notice!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            Expanded(
              child: ListView(
                children: [
                  for (final p in results)
                    ListTile(
                      leading: const Icon(Icons.location_on_outlined),
                      title: Text(p),
                      onTap: () => Navigator.pop(context, p),
                    ),
                  if (_query.trim().isNotEmpty &&
                      !results.contains(_query.trim()))
                    ListTile(
                      title: Text('Search for “${_query.trim()}”'),
                      trailing: const Icon(Icons.arrow_forward),
                      onTap: () => Navigator.pop(context, _query.trim()),
                    ),
                  if (results.isEmpty && _query.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: Text('Type your departure or destination town.'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
