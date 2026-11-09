import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/location/google_place_picker.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/workspace_form.dart';
import 'bus_route_editor.dart';

const _operatorSections = {
  'dashboard': 'Overview',
  'routes': 'Routes',
  'sessions': 'Departure schedules',
  'trips': 'Trips & passengers',
  'bookings': 'Bookings',
  'tickets': 'Verify a ticket',
  'customers': 'Customers',
  'announcements': 'Announcements',
  'payouts': 'Payouts',
  'profile': 'Company profile',
};

class BusOperatorPortalScreen extends ConsumerStatefulWidget {
  const BusOperatorPortalScreen({
    super.key,
    this.section = 'dashboard',
    this.tripId,
  });
  final String section;
  final String? tripId;
  @override
  ConsumerState<BusOperatorPortalScreen> createState() =>
      _BusOperatorPortalScreenState();
}

class _BusOperatorPortalScreenState
    extends ConsumerState<BusOperatorPortalScreen> {
  static const root = '/bus/operator';
  String get path => widget.tripId != null
      ? '$root/trips/${widget.tripId}'
      : '$root/${switch (widget.section) {
          'dashboard' || 'tickets' => 'stats',
          'sessions' => 'schedules',
          'profile' => 'me',
          _ => widget.section,
        }}';
  final _ticket = TextEditingController();
  Map<String, dynamic>? _verified;
  bool _busy = false;
  String? _error;
  @override
  void dispose() {
    _ticket.dispose();
    super.dispose();
  }

  void reload() => ref.invalidate(workspaceDataProvider(path));
  Future<void> run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (mounted) reload();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (ref
            .watch(sessionControllerProvider)
            .valueOrNull
            ?.user
            .roles
            .contains('bus_operator') !=
        true)
      return Scaffold(
        appBar: const CommerceAppBar(title: 'Operator workspace'),
        body: Center(
          child: CommerceEmpty(
            title: 'Your company workspace',
            message:
                'Sign in with the account registered for your bus company.',
            icon: Icons.directions_bus_outlined,
            action: 'Operator sign-in',
            onAction: () => context.push('/bus/operator/login'),
          ),
        ),
      );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.tripId == null
              ? _operatorSections[widget.section] ?? 'Operator workspace'
              : 'Trip manifest',
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            children: [
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Gabla for operators',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                ),
              ),
              for (final s in _operatorSections.entries)
                ListTile(
                  selected: s.key == widget.section,
                  title: Text(s.value),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/bus/operator/${s.key}');
                  },
                ),
              ListTile(
                title: const Text('Back to Gabla'),
                leading: const Icon(Icons.home_outlined),
                onTap: () => context.go('/home'),
              ),
            ],
          ),
        ),
      ),
      body: AsyncValueView(
        value: ref.watch(workspaceDataProvider(path)),
        onRetry: reload,
        data: (context, data) => ListView(
          padding: const EdgeInsets.all(18),
          children: [
            if (_busy) const LinearProgressIndicator(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (widget.tripId != null)
              ..._trip(Map<String, dynamic>.from(data))
            else
              ...switch (widget.section) {
                'dashboard' => _dashboard(Map<String, dynamic>.from(data)),
                'routes' => _routes(data),
                'sessions' => _schedules(data),
                'trips' => _trips(data),
                'bookings' => _bookings(data),
                'tickets' => _tickets(),
                'customers' => _customers(data),
                'announcements' => _announcements(data),
                'payouts' => _payouts(data),
                'profile' => _profile(Map<String, dynamic>.from(data)),
                _ => <Widget>[],
              },
          ],
        ),
      ),
    );
  }

  List<Widget> _dashboard(Map<String, dynamic> d) {
    final today = d['today'] as Map? ?? {}, month = d['month'] as Map? ?? {};
    return [
      Text(
        'Every journey\nstarts with you.',
        style: Theme.of(context).textTheme.headlineLarge,
      ),
      const SizedBox(height: 20),
      Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final e in [
            (
              formatUgx(num.tryParse('${today['revenue'] ?? 0}')),
              'Today’s revenue',
            ),
            ('${today['tickets'] ?? 0}', 'Tickets today'),
            ('${d['upcomingTrips'] ?? 0}', 'Upcoming trips'),
            (
              formatUgx(num.tryParse('${d['walletBalance'] ?? 0}')),
              'Wallet balance',
            ),
          ])
            SizedBox(
              width: (MediaQuery.sizeOf(context).width - 48) / 2,
              child: CommercePanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      e.$1,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(e.$2, style: const TextStyle(fontSize: 11)),
                  ],
                ),
              ),
            ),
        ],
      ),
      const CommerceTitle('This month'),
      CommercePanel(
        child: Text(
          '${month['tickets'] ?? 0} tickets · ${formatUgx(num.tryParse('${month['revenue'] ?? 0}'))} revenue',
        ),
      ),
      const CommerceTitle('Your workspace'),
      for (final section in _operatorSections.entries.where(
        (s) => s.key != 'dashboard',
      ))
        ListTile(
          title: Text(section.value),
          trailing: const Icon(Icons.arrow_forward),
          onTap: () => context.go('/bus/operator/${section.key}'),
        ),
    ];
  }

  List<Widget> _routes(dynamic d) => [
    FilledButton.icon(
      onPressed: () => _routeEditor(),
      icon: const Icon(Icons.add),
      label: const Text('Create a route'),
    ),
    const SizedBox(height: 18),
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'Where will you take them?',
        message: 'Create a route with ticket prices and departure times.',
        icon: Icons.route_outlined,
      ),
    for (final r in workspaceItems(d))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${r['originName']} → ${r['destinationName']}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text(
                '${r['durationMinutes'] ?? 0} minutes · ${r['isActive'] == false ? 'Inactive' : 'Active'}',
              ),
              Wrap(
                children: [
                  TextButton(
                    onPressed: () => _routeEditor(r),
                    child: const Text('Edit route & fares'),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => run(() async {
                            await ref
                                .read(apiClientProvider)
                                .patch(
                                  '$root/routes/${r['id']}',
                                  body: {'isActive': r['isActive'] == false},
                                );
                          }),
                    child: Text(
                      r['isActive'] == false ? 'Activate' : 'Pause route',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
  ];
  Future<void> _routeEditor([Map<String, dynamic>? old]) async {
    final types = await ref.read(apiClientProvider).getList('$root/types');
    if (!mounted) return;
    var draft = old == null
        ? emptyBusRoute()
        : {
            ...old,
            'departures': old['schedules'] ?? old['departures'] ?? [],
            'ticketTypes': old['ticketTypes'] ?? [],
          };
    if ((draft['departures'] as List).isEmpty)
      draft['departures'] = emptyBusRoute()['departures'];
    await showModalBottomSheet(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, update) {
          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * .85,
              child: ListView(
                padding: const EdgeInsets.all(22),
                children: [
                  Text(
                    old == null ? 'Create a route' : 'Edit your route',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 20),
                  BusRouteEditor(
                    value: draft,
                    busTypes: types,
                    onChanged: (v) => update(() => draft = v),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: () async {
                      final error = validateBusRoute(draft);
                      if (error != null) {
                        ScaffoldMessenger.of(
                          context,
                        ).showSnackBar(SnackBar(content: Text(error)));
                        return;
                      }
                      try {
                        final api = ref.read(apiClientProvider);
                        if (old == null) {
                          await api.post(
                            '$root/routes',
                            body: busRoutePayload(draft),
                          );
                        } else {
                          await api.patch(
                            '$root/routes/${old['id']}',
                            body: busRoutePayload(draft, full: false),
                          );
                          for (final t in draft['ticketTypes'] as List) {
                            final body = {
                              for (final k in ['name', 'price', 'description'])
                                if (t[k] != null) k: t[k],
                            };
                            if (t['id'] == null) {
                              await api.post(
                                '$root/routes/${old['id']}/ticket-types',
                                body: body,
                              );
                            } else {
                              await api.patch(
                                '$root/ticket-types/${t['id']}',
                                body: body,
                              );
                            }
                          }
                          for (final t in old['ticketTypes'] as List? ?? []) {
                            if (!(draft['ticketTypes'] as List).any(
                              (n) => n['id'] == t['id'],
                            ))
                              await api.patch(
                                '$root/ticket-types/${t['id']}',
                                body: {'isActive': false},
                              );
                          }
                          for (final d in draft['departures'] as List) {
                            final body = {
                              for (final k in [
                                'name',
                                'departureTime',
                                'daysOfWeek',
                                'seats',
                              ])
                                if (d[k] != null) k: d[k],
                            };
                            if (d['id'] == null) {
                              await api.post(
                                '$root/schedules',
                                body: {'routeId': old['id'], ...body},
                              );
                            } else {
                              await api.patch(
                                '$root/schedules/${d['id']}',
                                body: body,
                              );
                            }
                          }
                        }
                        reload();
                        if (sheetContext.mounted) Navigator.pop(sheetContext);
                      } catch (e) {
                        if (context.mounted)
                          ScaffoldMessenger.of(
                            context,
                          ).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    },
                    child: const Text('Save route'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _schedules(dynamic d) => [
    FilledButton.icon(
      onPressed: () => _scheduleForm(),
      icon: const Icon(Icons.add),
      label: const Text('Add departure schedule'),
    ),
    const SizedBox(height: 18),
    for (final s in workspaceItems(d))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${s['name'] ?? (s['route'] as Map?)?['name'] ?? 'Scheduled departure'}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text(
                '${s['departureTime']} · ${s['isActive'] == false ? 'Paused' : 'Active'}',
              ),
              Text(
                (s['daysOfWeek'] as List? ?? [])
                    .map(
                      (v) => [
                        'Sun',
                        'Mon',
                        'Tue',
                        'Wed',
                        'Thu',
                        'Fri',
                        'Sat',
                      ][(v as num).toInt()],
                    )
                    .join(' · '),
              ),
              Wrap(
                children: [
                  TextButton(
                    onPressed: () => _scheduleForm(s),
                    child: const Text('Edit'),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => run(() async {
                            await ref
                                .read(apiClientProvider)
                                .patch(
                                  '$root/schedules/${s['id']}',
                                  body: {'isActive': s['isActive'] == false},
                                );
                          }),
                    child: Text(s['isActive'] == false ? 'Resume' : 'Pause'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'A timetable that works for you',
        message: 'Create a schedule for a route to generate future trips.',
        icon: Icons.schedule_outlined,
      ),
  ];
  Future<void> _scheduleForm([Map<String, dynamic>? old]) async {
    final routes = await ref.read(apiClientProvider).getList('$root/routes');
    if (!mounted) return;
    await showWorkspaceForm(
      context,
      title: 'Departure schedule',
      fields: [
        if (old == null)
          WorkspaceField(
            'routeId',
            'Route',
            required: true,
            options: routes.map((r) => '${r['id']}').toList(),
            labels: {
              for (final r in routes)
                '${r['id']}': '${r['originName']} → ${r['destinationName']}',
            },
          ),
        WorkspaceField('name', 'Schedule label', value: old?['name']),
        WorkspaceField(
          'departureTime',
          'Departure time (HH:mm)',
          required: true,
          value: old?['departureTime'] ?? '07:00',
        ),
        WorkspaceField(
          'seats',
          'Seats (optional)',
          type: 'number',
          value: old?['seats'],
        ),
        WorkspaceField(
          'startDate',
          'Starts (YYYY-MM-DD)',
          value:
              old?['startDate']?.toString().substring(0, 10) ??
              DateFormat(
                'yyyy-MM-dd',
              ).format(DateTime.now().toUtc().add(const Duration(hours: 3))),
        ),
      ],
      save: (v) async {
        final body = {
          for (final e in v.entries)
            if (e.value != null && e.value != '') e.key: e.value,
        };
        if (old == null) {
          await ref
              .read(apiClientProvider)
              .post(
                '$root/schedules',
                body: {
                  ...body,
                  'daysOfWeek': [0, 1, 2, 3, 4, 5, 6],
                },
              );
        } else {
          await ref
              .read(apiClientProvider)
              .patch('$root/schedules/${old['id']}', body: body);
        }
        reload();
      },
    );
  }

  List<Widget> _trips(dynamic d) => [
    FilledButton.icon(
      onPressed: _newTrip,
      icon: const Icon(Icons.add),
      label: const Text('Schedule a one-off trip'),
    ),
    const SizedBox(height: 18),
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'Your next departure awaits',
        message: 'Scheduled and one-off departures will appear here.',
        icon: Icons.directions_bus_outlined,
      ),
    for (final t in workspaceItems(d))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: InkWell(
          onTap: () => context.push('/bus/operator/trips/${t['id']}'),
          child: CommercePanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${(t['route'] as Map?)?['originName']} → ${(t['route'] as Map?)?['destinationName']}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(_date(t['departureAt'])),
                Text(
                  '${t['status']} · ${t['seatsTaken'] ?? 0}/${t['seats'] ?? '—'} seats',
                ),
                const SizedBox(height: 10),
                const Text('Open passenger manifest →'),
              ],
            ),
          ),
        ),
      ),
  ];
  Future<void> _newTrip() async {
    final routes = await ref.read(apiClientProvider).getList('$root/routes');
    if (!mounted) return;
    await showWorkspaceForm(
      context,
      title: 'One-off trip',
      fields: [
        WorkspaceField(
          'routeId',
          'Route',
          required: true,
          options: routes.map((r) => '${r['id']}').toList(),
          labels: {
            for (final r in routes)
              '${r['id']}': '${r['originName']} → ${r['destinationName']}',
          },
        ),
        WorkspaceField(
          'date',
          'Departure date (YYYY-MM-DD)',
          required: true,
          value: DateFormat(
            'yyyy-MM-dd',
          ).format(DateTime.now().toUtc().add(const Duration(hours: 3))),
        ),
        const WorkspaceField(
          'time',
          'Departure time (HH:mm)',
          required: true,
          value: '07:00',
        ),
        const WorkspaceField('seats', 'Seats (optional)', type: 'number'),
      ],
      save: (v) async {
        await ref
            .read(apiClientProvider)
            .post(
              '$root/trips',
              body: {
                for (final e in v.entries)
                  if (e.value != null) e.key: e.value,
              },
            );
        reload();
      },
    );
  }

  List<Widget> _trip(Map<String, dynamic> t) => [
    Text(
      '${(t['route'] as Map?)?['originName']} → ${(t['route'] as Map?)?['destinationName']}',
      style: Theme.of(context).textTheme.headlineLarge,
    ),
    const SizedBox(height: 12),
    Text('${_date(t['departureAt'])} · ${t['status']}'),
    const SizedBox(height: 18),
    Wrap(
      spacing: 8,
      children: [
        if (t['status'] == 'scheduled') ...[
          OutlinedButton(
            onPressed: () => showWorkspaceForm(
              context,
              title: 'Update departure delay',
              fields: [
                WorkspaceField(
                  'delayMinutes',
                  'Delay (minutes)',
                  required: true,
                  type: 'number',
                  value: t['delayMinutes'] ?? 0,
                ),
                const WorkspaceField(
                  'note',
                  'Note to passengers',
                  type: 'long',
                ),
              ],
              save: (v) async {
                await ref
                    .read(apiClientProvider)
                    .post('$root/trips/${t['id']}/delay', body: v);
                reload();
              },
            ),
            child: const Text('Set delay'),
          ),
          OutlinedButton(
            onPressed: () => showWorkspaceForm(
              context,
              title: 'Cancel this trip',
              action: 'Confirm cancellation',
              fields: const [
                WorkspaceField(
                  'reason',
                  'Reason for cancellation',
                  required: true,
                  type: 'long',
                ),
              ],
              save: (v) async {
                await ref
                    .read(apiClientProvider)
                    .post('$root/trips/${t['id']}/cancel', body: v);
                reload();
              },
            ),
            child: const Text('Cancel trip'),
          ),
          FilledButton(
            onPressed: _busy
                ? null
                : () => run(() async {
                    await ref
                        .read(apiClientProvider)
                        .post(
                          '$root/trips/${t['id']}/status',
                          body: {'status': 'departed'},
                        );
                  }),
            child: const Text('Mark departed'),
          ),
        ],
        if (t['status'] == 'departed')
          FilledButton(
            onPressed: _busy
                ? null
                : () => run(() async {
                    await ref
                        .read(apiClientProvider)
                        .post(
                          '$root/trips/${t['id']}/status',
                          body: {'status': 'completed'},
                        );
                  }),
            child: const Text('Complete trip'),
          ),
      ],
    ),
    const CommerceTitle('Passenger manifest'),
    for (final p in t['passengers'] as List? ?? [])
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(child: Text('${p['seatNumber'] ?? '—'}')),
        title: Text('${p['passengerName']}'),
        subtitle: Text('${p['ticketNumber']} · ${p['status']}'),
        trailing: p['status'] == 'used'
            ? const Icon(Icons.check_circle_outline)
            : IconButton(
                tooltip: 'Check in passenger',
                icon: const Icon(Icons.how_to_reg_outlined),
                onPressed: _busy
                    ? null
                    : () => run(() async {
                        await ref
                            .read(apiClientProvider)
                            .post(
                              '$root/tickets/check-in',
                              body: {'ticketNumber': p['ticketNumber']},
                            );
                      }),
              ),
      ),
  ];
  List<Widget> _bookings(dynamic d) => [
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'Welcome your next passenger',
        message: 'Confirmed bookings and passenger details will appear here.',
        icon: Icons.confirmation_number_outlined,
      ),
    for (final b in workspaceItems(d))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${b['passengerName']}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('${b['reference']} · ${b['status']}'),
              Text('${b['passengerPhone'] ?? ''}'),
              Text(formatUgx(num.tryParse('${b['total']}'))),
              for (final t in b['tickets'] as List? ?? [])
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.confirmation_number_outlined),
                  title: Text('${t['ticketNumber']}'),
                  subtitle: Text('${t['status']}'),
                ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _tickets() => [
    Text(
      'A smooth start\nto every journey.',
      style: Theme.of(context).textTheme.headlineLarge,
    ),
    const SizedBox(height: 14),
    const Text(
      'Enter the ticket number to verify it before the passenger boards.',
    ),
    const SizedBox(height: 24),
    TextField(
      controller: _ticket,
      textCapitalization: TextCapitalization.characters,
      decoration: const InputDecoration(
        labelText: 'Ticket number',
        prefixIcon: Icon(Icons.confirmation_number_outlined),
      ),
    ),
    const SizedBox(height: 16),
    FilledButton(
      onPressed: _busy ? null : () => _verify(false),
      child: const Text('Verify ticket'),
    ),
    if (_verified != null)
      CommercePanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(
              _verified!['valid'] == true
                  ? Icons.check_circle_outline
                  : Icons.info_outline,
              size: 48,
            ),
            const SizedBox(height: 14),
            Text(
              '${_verified!['message']}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (_verified!['ticket'] is Map)
              Text(
                '${(_verified!['ticket'] as Map)['passengerName'] ?? ''} · Seat ${(_verified!['ticket'] as Map)['seatNumber'] ?? '—'}',
              ),
            if (_verified!['valid'] == true && _verified!['checkedIn'] != true)
              FilledButton(
                onPressed: _busy ? null : () => _verify(true),
                child: const Text('Check in passenger'),
              ),
          ],
        ),
      ),
  ];
  Future<void> _verify(bool checkIn) async {
    if (_ticket.text.trim().isEmpty) return;
    await run(() async {
      final value = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>(
            '$root/tickets/${checkIn ? 'check-in' : 'verify'}',
            body: {'ticketNumber': _ticket.text.trim().toUpperCase()},
          );
      if (mounted) setState(() => _verified = value);
    });
  }

  List<Widget> _customers(dynamic d) => [
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'A growing travel community',
        message: 'Your passengers and their journey history will appear here.',
        icon: Icons.people_outline,
      ),
    for (final c in workspaceItems(d))
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const CircleAvatar(child: Icon(Icons.person_outline)),
        title: Text('${c['name']}'),
        subtitle: Text('${c['phone']} · ${c['bookings']} bookings'),
        trailing: Text(formatUgx(num.tryParse('${c['spent']}'))),
      ),
  ];
  List<Widget> _announcements(dynamic d) => [
    FilledButton.icon(
      onPressed: () => showWorkspaceForm(
        context,
        title: 'New passenger announcement',
        action: 'Send announcement',
        fields: const [
          WorkspaceField('title', 'Headline', required: true),
          WorkspaceField(
            'message',
            'Message to passengers',
            required: true,
            type: 'long',
          ),
          WorkspaceField(
            'kind',
            'Message type',
            options: ['notice', 'promotion'],
            value: 'notice',
          ),
          WorkspaceField(
            'audience',
            'Recipients',
            options: ['all', 'upcoming'],
            value: 'upcoming',
          ),
        ],
        save: (v) async {
          await ref
              .read(apiClientProvider)
              .post('$root/announcements', body: v);
          reload();
        },
      ),
      icon: const Icon(Icons.campaign_outlined),
      label: const Text('Create announcement'),
    ),
    const SizedBox(height: 16),
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'Keep passengers in the loop',
        message: 'Share departure notices and company updates here.',
        icon: Icons.campaign_outlined,
      ),
    for (final a in workspaceItems(d))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${a['title']}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('${a['message']}'),
              Text(
                '${a['audience'] ?? ''}',
                style: const TextStyle(fontSize: 11),
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _payouts(dynamic d) => [
    FilledButton.icon(
      onPressed: () => showWorkspaceForm(
        context,
        title: 'Request company payout',
        action: 'Request payout',
        fields: const [
          WorkspaceField(
            'amount',
            'Amount (UGX)',
            required: true,
            type: 'number',
          ),
          WorkspaceField('phone', 'Mobile money number', required: true),
        ],
        save: (v) async {
          await ref.read(apiClientProvider).post('$root/payouts', body: v);
          reload();
        },
      ),
      icon: const Icon(Icons.account_balance_wallet_outlined),
      label: const Text('Request payout'),
    ),
    const SizedBox(height: 18),
    if (workspaceItems(d).isEmpty)
      const CommerceEmpty(
        title: 'Your earnings, clearly tracked',
        message: 'Payout requests and their status will appear here.',
        icon: Icons.payments_outlined,
      ),
    for (final p in workspaceItems(d))
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(formatUgx(num.tryParse('${p['amount']}'))),
        subtitle: Text('${p['phone']}'),
        trailing: Text('${p['status']}'),
      ),
  ];
  List<Widget> _profile(Map<String, dynamic> p) => [
    Text(
      '${p['companyName']}',
      style: Theme.of(context).textTheme.headlineLarge,
    ),
    const SizedBox(height: 12),
    Text('${p['parkName']} · ${p['parkDistrict']}'),
    const SizedBox(height: 20),
    FilledButton.icon(
      onPressed: () => showWorkspaceForm(
        context,
        title: 'Company profile',
        fields: [
          for (final e in {
            'companyName': 'Company name',
            'description': 'Description',
            'contactPhone': 'Phone',
            'whatsapp': 'WhatsApp',
            'parkName': 'Park name',
            'parkDistrict': 'Park district',
            'parkAddress': 'Park address',
          }.entries)
            WorkspaceField(e.key, e.value, value: p[e.key]),
        ],
        save: (v) async {
          await ref.read(apiClientProvider).patch('$root/me', body: v);
          reload();
        },
      ),
      icon: const Icon(Icons.edit_outlined),
      label: const Text('Edit company'),
    ),
    MediaUploadButton(
      video: false,
      folder: 'bus-operators',
        registerAsset: false,
      label: 'Update logo',
      onUploaded: (u) => run(() async {
        await ref
            .read(apiClientProvider)
            .patch('$root/me', body: {'logoUrl': u});
      }),
    ),
    MediaUploadButton(
      video: false,
      folder: 'bus-operators',
        registerAsset: false,
      label: 'Update cover photo',
      onUploaded: (u) => run(() async {
        await ref
            .read(apiClientProvider)
            .patch('$root/me', body: {'coverUrl': u});
      }),
    ),
    OutlinedButton.icon(
      onPressed: () async {
        final location = await pickGoogleLocation(
          context,
          title: 'Choose bus park location',
        );
        if (location != null)
          run(() async {
            await ref
                .read(apiClientProvider)
                .patch(
                  '$root/me',
                  body: {
                    'parkAddress': location.address,
                    'parkLat': location.lat,
                    'parkLng': location.lng,
                  },
                );
          });
      },
      icon: const Icon(Icons.map_outlined),
      label: const Text('Locate park on map'),
    ),
  ];
  String _date(dynamic value) {
    final date = DateTime.tryParse('$value');
    return date == null
        ? 'Departure time unavailable'
        : '${DateFormat('EEE, d MMM · HH:mm').format(date.toUtc().add(const Duration(hours: 3)))} EAT';
  }
}
