import 'bus_design_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../application/bus_providers.dart';
import '../../../core/network/network_providers.dart';

final busPassengerMessagesProvider = FutureProvider<List<dynamic>>(
  (ref) => ref.watch(apiClientProvider).getList('/bus/my-messages'),
);

class BusTicketsScreen extends ConsumerStatefulWidget {
  const BusTicketsScreen({super.key});
  @override
  ConsumerState<BusTicketsScreen> createState() => _BusTicketsScreenState();
}

class _BusTicketsScreenState extends ConsumerState<BusTicketsScreen> {
  bool _past = false;
  @override
  Widget build(BuildContext context) {
    if (!ref.watch(isSignedInProvider))
      return Scaffold(
        appBar: AppBar(title: const Text('My tickets')),
        body: Center(
          child: FilledButton(
            onPressed: () => context.push('/login?next=%2Fbus%2Ftickets'),
            child: const Text('Sign in to see your tickets'),
          ),
        ),
      );
    final tickets = ref.watch(myTicketsProvider);
    final messages = ref.watch(busPassengerMessagesProvider).valueOrNull ?? [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('My tickets'),
        actions: [
          IconButton(
            tooltip: 'Refresh tickets',
            onPressed: () => ref.invalidate(myTicketsProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          if (messages.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: ListTile(
                tileColor: Theme.of(context).colorScheme.primaryContainer,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8,
                  ),
                ),
                leading: const Icon(Icons.campaign_outlined),
                title: Text('${messages.length} updates from bus companies'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => showModalBottomSheet(
                  context: context,
                  useSafeArea: true,
                  showDragHandle: true,
                  builder: (_) => ListView(
                    padding: const EdgeInsets.all(22),
                    children: [
                      for (final m in messages)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${m['companyName'] ?? 'Your bus company'}',
                                style: const TextStyle(fontSize: 11),
                              ),
                              Text(
                                '${m['title']}',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 10),
                              Text('${m['message']}'),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('Upcoming')),
                ButtonSegment(value: true, label: Text('Past')),
              ],
              selected: {_past},
              onSelectionChanged: (v) => setState(() => _past = v.first),
            ),
          ),
          Expanded(
            child: AsyncValueView(
              value: tickets,
              onRetry: () => ref.invalidate(myTicketsProvider),
              data: (context, all) {
                final cut = DateTime.now().toUtc().subtract(
                  const Duration(hours: 6),
                );
                final items = all
                    .where(
                      (t) => _past
                          ? t.trip.departAt.isBefore(cut)
                          : !t.trip.departAt.isBefore(cut),
                    )
                    .toList();
                if (items.isEmpty)
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.confirmation_number_outlined,
                          size: 48,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _past
                              ? 'No past journeys yet'
                              : 'No upcoming tickets',
                        ),
                        TextButton(
                          onPressed: () => context.push('/bus'),
                          child: const Text('Find a bus'),
                        ),
                      ],
                    ),
                  );
                return ListView.builder(
                  padding: const EdgeInsets.all(18),
                  itemCount: items.length,
                  itemBuilder: (_, i) {
                    final t = items[i];
                    return DesignEntrance(
                      index: i,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: InkWell(
                          onTap: () => context.push(
                            '/bus/tickets/${Uri.encodeComponent(t.ticketNumber)}',
                          ),
                          child: BusPanel(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  t.companyName ?? 'Bus operator',
                                  style: const TextStyle(fontSize: 11),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  '${t.trip.originName} → ${t.trip.destinationName}',
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  '${DateFormat('EEE, d MMM · HH:mm').format(t.departAtEat)} EAT',
                                ),
                                const Divider(height: 28),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        'Seat ${t.seatLabel} · ${t.status.replaceAll('_', ' ')}',
                                      ),
                                    ),
                                    const Icon(Icons.qr_code_2),
                                  ],
                                ),
                              ],
                            ),
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
}
