import 'package:flutter/material.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/presentation/workspace_form.dart';
import 'bus_design_widgets.dart';

Map<String, dynamic> emptyBusRoute() => {
  'originName': '',
  'destinationName': '',
  'boardingPoint': '',
  'dropoffPoint': '',
  'durationMinutes': 180,
  'ticketTypes': <Map<String, dynamic>>[
    {'name': 'Standard', 'price': 0},
  ],
  'departures': <Map<String, dynamic>>[
    {
      'departureTime': '07:00',
      'daysOfWeek': [0, 1, 2, 3, 4, 5, 6],
    },
  ],
  'stops': <Map<String, dynamic>>[],
};
String? validateBusRoute(Map<String, dynamic> route) {
  if ('${route['originName'] ?? ''}'.trim().isEmpty ||
      '${route['destinationName'] ?? ''}'.trim().isEmpty)
    return 'Choose an origin and a destination.';
  if ('${route['originName']}'.toLowerCase() ==
      '${route['destinationName']}'.toLowerCase())
    return 'Departure and destination must differ.';
  if ((route['durationMinutes'] as num? ?? 0) < 10)
    return 'Enter a journey duration of at least 10 minutes.';
  final tickets = route['ticketTypes'] as List? ?? [],
      departures = route['departures'] as List? ?? [];
  if (tickets.isEmpty || departures.isEmpty)
    return 'Add at least one ticket type and departure.';
  for (final ticket in tickets) {
    if ('${ticket['name'] ?? ''}'.trim().isEmpty ||
        (num.tryParse('${ticket['price']}') ?? -1) < 0)
      return 'Check your ticket names and prices.';
  }
  for (final departure in departures) {
    if (!RegExp(
          r'^([01]\d|2[0-3]):[0-5]\d$',
        ).hasMatch('${departure['departureTime']}') ||
        (departure['daysOfWeek'] as List? ?? []).isEmpty)
      return 'Choose a valid departure time and operating days.';
  }
  return null;
}

Map<String, dynamic> busRoutePayload(
  Map<String, dynamic> route, {
  bool full = true,
}) => {
  for (final key in [
    'name',
    'originName',
    'destinationName',
    'boardingPoint',
    'dropoffPoint',
    'durationMinutes',
    'distanceKm',
    'busTypeId',
    'stops',
  ])
    if (route[key] != null) key: route[key],
  if (full)
    'ticketTypes': [
      for (final t in route['ticketTypes'] as List? ?? [])
        {
          for (final k in ['name', 'price', 'description'])
            if (t[k] != null) k: t[k],
        },
    ],
  if (full)
    'departures': [
      for (final d in route['departures'] as List? ?? [])
        {
          for (final k in [
            'name',
            'departureTime',
            'daysOfWeek',
            'startDate',
            'endDate',
            'seats',
          ])
            if (d[k] != null) k: d[k],
        },
    ],
};

class BusRouteEditor extends StatelessWidget {
  const BusRouteEditor({
    super.key,
    required this.value,
    required this.onChanged,
    this.busTypes = const [],
  });
  final Map<String, dynamic> value;
  final ValueChanged<Map<String, dynamic>> onChanged;
  final List<dynamic> busTypes;
  void _set(String key, dynamic v) => onChanged({...value, key: v});
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Route details', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 6),
      const Text(
        'Set the towns and boarding points passengers will see.',
        style: TextStyle(fontSize: 12, height: 1.4),
      ),
      const SizedBox(height: 14),
      for (final e in {
        'originName': 'Departure town',
        'destinationName': 'Destination town',
        'boardingPoint': 'Boarding point',
        'dropoffPoint': 'Drop-off point',
      }.entries)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextFormField(
            initialValue: '${value[e.key] ?? ''}',
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(labelText: e.value),
            onChanged: (v) => _set(e.key, v),
            validator: (v) =>
                ['originName', 'destinationName'].contains(e.key) &&
                    (v ?? '').trim().isEmpty
                ? 'Enter ${e.value.toLowerCase()}.'
                : null,
          ),
        ),
      TextFormField(
        initialValue: '${value['durationMinutes'] ?? 180}',
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Duration (minutes)'),
        onChanged: (v) => _set('durationMinutes', int.tryParse(v) ?? 0),
      ),
      if (busTypes.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: DropdownButtonFormField<String>(
            initialValue: busTypes.any((b) => b['id'] == value['busTypeId'])
                ? value['busTypeId']
                : null,
            decoration: const InputDecoration(labelText: 'Bus type'),
            items: [
              for (final b in busTypes)
                DropdownMenuItem(
                  value: '${b['id']}',
                  child: Text('${b['name']}'),
                ),
            ],
            onChanged: (v) => _set('busTypeId', v),
          ),
        ),
      CommerceTitle(
        'Ticket types',
        label: 'Add',
        action: () => _ticket(context),
      ),
      if ((value['ticketTypes'] as List? ?? []).isEmpty)
        const Text(
          'Add a ticket type and price before saving.',
          style: TextStyle(fontSize: 12),
        ),
      for (final ticket in value['ticketTypes'] as List? ?? [])
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('${ticket['name']}'),
          subtitle: Text('UGX ${ticket['price']}'),
          onTap: () => _ticket(context, Map<String, dynamic>.from(ticket)),
          trailing: IconButton(
            tooltip: 'Remove ticket type',
            icon: const Icon(Icons.remove_circle_outline),
            onPressed: () => _set(
              'ticketTypes',
              (value['ticketTypes'] as List).where((t) => t != ticket).toList(),
            ),
          ),
        ),
      CommerceTitle(
        'Departures',
        label: 'Add',
        action: () => _departure(context),
      ),
      const Text(
        'Times use East Africa Time (EAT). Select the days each departure runs.',
        style: TextStyle(fontSize: 12, height: 1.4),
      ),
      const SizedBox(height: 12),
      if ((value['departures'] as List? ?? []).isEmpty)
        const Text(
          'Add at least one departure before saving.',
          style: TextStyle(fontSize: 12),
        ),
      for (final departure in value['departures'] as List? ?? [])
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: BusPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${departure['departureTime']}',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Edit departure',
                      onPressed: () => _departure(
                        context,
                        Map<String, dynamic>.from(departure),
                      ),
                      icon: const Icon(Icons.edit_outlined),
                    ),
                    IconButton(
                      tooltip: 'Remove departure',
                      onPressed: () => _set(
                        'departures',
                        (value['departures'] as List)
                            .where((d) => d != departure)
                            .toList(),
                      ),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                  ],
                ),
                Wrap(
                  spacing: 4,
                  children: [
                    for (var day = 0; day < 7; day++)
                      FilterChip(
                        label: Text(
                          ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][day],
                        ),
                        selected: (departure['daysOfWeek'] as List? ?? [])
                            .contains(day),
                        onSelected: (selected) {
                          final next = Map<String, dynamic>.from(
                                departure as Map,
                              ),
                              days = <dynamic>{
                                ...?departure['daysOfWeek'] as List?,
                              };
                          if (selected) {
                            days.add(day);
                          } else {
                            days.remove(day);
                          }
                          next['daysOfWeek'] = days.toList()..sort();
                          _set('departures', [
                            for (final d in value['departures'] as List)
                              if (d == departure) next else d,
                          ]);
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      CommerceTitle(
        'Stops along the way',
        label: 'Add',
        action: () => showWorkspaceForm(
          context,
          title: 'Add a stop',
          fields: const [
            WorkspaceField('name', 'Stop name', required: true),
            WorkspaceField(
              'offsetMinutes',
              'Minutes from departure',
              type: 'number',
              value: 0,
            ),
          ],
          save: (v) async => _set('stops', [...?value['stops'] as List?, v]),
        ),
      ),
      if ((value['stops'] as List? ?? []).isEmpty)
        const Text(
          'Optional: add intermediate stops for this route.',
          style: TextStyle(fontSize: 12),
        ),
      for (final stop in value['stops'] as List? ?? [])
        ListTile(
          title: Text('${stop['name']}'),
          subtitle: Text(
            '${stop['offsetMinutes'] ?? 0} minutes from departure',
          ),
          trailing: IconButton(
            tooltip: 'Remove stop',
            icon: const Icon(Icons.close),
            onPressed: () => _set(
              'stops',
              (value['stops'] as List).where((s) => s != stop).toList(),
            ),
          ),
        ),
    ],
  );
  Future<void> _ticket(
    BuildContext context, [
    Map<String, dynamic>? old,
  ]) async {
    await showWorkspaceForm(
      context,
      title: old == null ? 'Add ticket type' : 'Edit ticket type',
      fields: [
        WorkspaceField(
          'name',
          'Ticket name',
          value: old?['name'],
          required: true,
        ),
        WorkspaceField(
          'price',
          'Price (UGX)',
          type: 'number',
          value: old?['price'],
          required: true,
        ),
        WorkspaceField(
          'description',
          'Description',
          value: old?['description'],
        ),
      ],
      save: (v) async {
        if ((v['price'] as num? ?? -1) < 0)
          throw StateError('Enter a valid ticket price.');
        _set('ticketTypes', [
          for (final t in value['ticketTypes'] as List? ?? [])
            if (old != null && t['id'] == old['id'] && t['name'] == old['name'])
              {...old, ...v}
            else
              t,
          if (old == null) v,
        ]);
      },
    );
  }

  Future<void> _departure(
    BuildContext context, [
    Map<String, dynamic>? old,
  ]) async {
    await showWorkspaceForm(
      context,
      title: 'Departure details',
      fields: [
        WorkspaceField(
          'departureTime',
          'Time in EAT (HH:mm)',
          required: true,
          value: old?['departureTime'] ?? '07:00',
        ),
        WorkspaceField(
          'name',
          'Departure label (optional)',
          value: old?['name'],
        ),
        WorkspaceField(
          'seats',
          'Seats (optional)',
          type: 'number',
          value: old?['seats'],
        ),
      ],
      save: (v) async {
        if (!RegExp(
          r'^([01]\d|2[0-3]):[0-5]\d$',
        ).hasMatch('${v['departureTime']}'))
          throw StateError('Enter a time such as 07:30.');
        final next = {
          ...?old,
          ...{
            for (final e in v.entries)
              if (e.value != null) e.key: e.value,
          },
          'daysOfWeek': old?['daysOfWeek'] ?? [0, 1, 2, 3, 4, 5, 6],
        };
        _set('departures', [
          for (final d in value['departures'] as List? ?? [])
            if (old != null &&
                d['id'] == old['id'] &&
                d['departureTime'] == old['departureTime'])
              next
            else
              d,
          if (old == null) next,
        ]);
      },
    );
  }
}
