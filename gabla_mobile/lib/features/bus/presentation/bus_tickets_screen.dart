import 'bus_pickup_button.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/widgets/page_band.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../application/bus_providers.dart';
import '../domain/bus_booking.dart';

final busPassengerMessagesProvider = FutureProvider<List<dynamic>>(
  (ref) => ref.watch(apiClientProvider).getList('/bus/my-messages'),
);
String busBookingTime(DateTime time) =>
    '${DateFormat('EEE, d MMM · HH:mm').format(time.toUtc().add(const Duration(hours: 3)))} EAT';
String busDepartureCountdown(DateTime at, DateTime now) {
  final d = at.difference(now);
  if (d.isNegative) return 'Departure time reached';
  if (d.inDays > 0) return '${d.inDays}d ${d.inHours % 24}h until departure';
  if (d.inHours > 0)
    return '${d.inHours}h ${d.inMinutes % 60}m until departure';
  return '${d.inMinutes}m ${d.inSeconds % 60}s until departure';
}

class BusTicketsScreen extends ConsumerStatefulWidget {
  const BusTicketsScreen({super.key});
  @override
  ConsumerState<BusTicketsScreen> createState() => _BusTicketsScreenState();
}

class _BusTicketsScreenState extends ConsumerState<BusTicketsScreen> {
  bool _past = false;
  Timer? _clock;
  int _ticks = 0;
  String? _busy;
  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _ticks++);
      if (_ticks % 30 == 0 && ref.read(isSignedInProvider))
        ref.invalidate(myBusBookingsProvider);
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  Future<void> _cancel(BusBooking b) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this journey?'),
        content: Text(
          'Cancel ${b.seatCount} ticket(s) for ${b.origin} to ${b.destination}? Gabla will arrange a refund to the mobile money number used for payment.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep booking'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() => _busy = b.id);
    try {
      await ref.read(busRepositoryProvider).cancelBooking(b.id);
      ref.invalidate(myBusBookingsProvider);
      ref.invalidate(myTicketsProvider);
      for (final t in b.tickets) {
        ref.invalidate(ticketDetailProvider(t.ticketNumber));
      }
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Booking cancelled. Your refund is pending.'),
          ),
        );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (!ref.watch(isSignedInProvider))
      return Scaffold(
        appBar: AppBar(title: const Text('My bookings')),
        body: Center(
          child: FilledButton(
            onPressed: () => context.push('/login?next=%2Fbus%2Ftickets'),
            child: const Text('Sign in to see your bookings'),
          ),
        ),
      );
    final data = ref.watch(myBusBookingsProvider),
        messages = ref.watch(busPassengerMessagesProvider).valueOrNull ?? [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('My bus bookings'),
        actions: [
          IconButton(
            tooltip: 'Refresh bookings',
            onPressed: () => ref.invalidate(myBusBookingsProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            color: cs.primaryContainer,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'YOUR JOURNEYS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tickets, times & travel updates',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 14),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Upcoming')),
                    ButtonSegment(value: true, label: Text('Past & cancelled')),
                  ],
                  selected: {_past},
                  onSelectionChanged: (v) => setState(() => _past = v.first),
                ),
              ],
            ),
          ),
          if (messages.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.campaign_outlined),
              title: Text('${messages.length} journey updates'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => showModalBottomSheet(
                context: context,
                useSafeArea: true,
                showDragHandle: true,
                builder: (_) => ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    for (final m in messages)
                      ListTile(
                        title: Text('${m['title']}'),
                        subtitle: Text('${m['message']}'),
                      ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: AsyncValueView(
              value: data,
              onRetry: () => ref.invalidate(myBusBookingsProvider),
              data: (context, all) {
                final items = all.where((b) => b.past == _past).toList()
                  ..sort(
                    (a, b) => _past
                        ? b.departureAt.compareTo(a.departureAt)
                        : a.departureAt.compareTo(b.departureAt),
                  );
                if (items.isEmpty)
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.confirmation_number_outlined,
                          size: 44,
                          color: cs.primary,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _past ? 'No past bookings' : 'No upcoming bookings',
                        ),
                        TextButton(
                          onPressed: () => context.push('/bus'),
                          child: const Text('Find a bus'),
                        ),
                      ],
                    ),
                  );
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(myBusBookingsProvider);
                    await ref.read(myBusBookingsProvider.future);
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    itemBuilder: (_, i) => DesignEntrance(
                      index: i,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: _card(items[i]),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(BusBooking b) {
    final cs = Theme.of(context).colorScheme, now = DateTime.now().toUtc();
    final canCancel = b.cancellableAt(now);
    final status = b.status == 'confirmed'
        ? (b.tripStatus == 'completed'
              ? 'Completed'
              : b.tripStatus == 'departed'
              ? 'Departed'
              : 'Paid')
        : b.status.replaceAll('_', ' ');
    return MobilityPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.directions_bus_outlined, color: cs.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  b.company,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Chip(
                  label: Text(status, maxLines: 2),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(b.reference, style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 16),
          Text(
            '${b.origin} → ${b.destination}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(busBookingTime(b.departureAt)),
          if (b.delayMinutes > 0)
            Text(
              'Departure adjusted · ${b.delayMinutes} min delay',
              style: TextStyle(color: cs.error),
            ),
          const SizedBox(height: 16),
          PageBand(
            color: cs.secondaryContainer,
            borderRadius: BorderRadius.circular(8),
            padding: const EdgeInsets.all(14),
            children: [
              Row(
                children: [
                  Icon(
                    Icons.schedule,
                    size: 19,
                    color: cs.onSecondaryContainer,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      b.tripStatus == 'scheduled' && b.status == 'confirmed'
                          ? busDepartureCountdown(b.departureAt, now)
                          : status,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: cs.onSecondaryContainer,
                      ),
                    ),
                  ),
                ],
              ),
              if (b.boardingPoint.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 9),
                  child: Text(
                    'Board at ${b.boardingPoint}',
                    style: TextStyle(
                      fontSize: 12,
                      color: cs.onSecondaryContainer,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${b.seatCount} ticket(s) · ${b.passenger}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              Text(
                'UGX ${NumberFormat('#,##0').format(b.total)}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          if (b.boardingPoint.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: BusPickupButton(
                name: b.boardingPoint,
                latitude: b.boardingLat,
                longitude: b.boardingLng,
              ),
            ),
          if (b.status == 'confirmed')
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  ['bus_confirmed', 'handed_over'].contains(b.operationStatus)
                      ? Icons.verified_outlined
                      : Icons.support_agent_outlined,
                  color: cs.primary,
                ),
                title: Text(
                  ['bus_confirmed', 'handed_over'].contains(b.operationStatus)
                      ? 'Bus availability confirmed'
                      : b.operationStatus == 'needs_attention'
                      ? 'Gabla is following up your bus'
                      : 'Gabla is checking bus availability',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'Your departure time, ticket and travel updates are kept here.',
                  style: TextStyle(fontSize: 11),
                ),
              ),
            ),
          if (b.status == 'confirmed') ...[
            const Divider(height: 30),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  canCancel
                      ? Icons.event_available_outlined
                      : Icons.lock_clock_outlined,
                  size: 20,
                  color: cs.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        canCancel
                            ? 'Cancellation available'
                            : 'Cancellation period closed',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        canCancel
                            ? 'Cancel before ${busBookingTime(b.cancellationClosesAt!)}.'
                            : 'This booking is non-refundable unless Gabla or the bus company cancels the trip.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (canCancel)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _busy == null ? () => _cancel(b) : null,
                  child: Text(_busy == b.id ? 'Cancelling…' : 'Cancel booking'),
                ),
              ),
          ],
          if (b.status == 'refund_due')
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text(
                'Refund pending · Gabla will return your payment to the number you paid from.',
                style: TextStyle(color: cs.error, fontSize: 12),
              ),
            ),
          if (b.refundStatus == 'refunded')
            const Padding(
              padding: EdgeInsets.only(top: 14),
              child: Text('Refund recorded by Gabla.'),
            ),
          if (b.tickets.isNotEmpty) ...[
            const Divider(height: 28),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final t in b.tickets)
                  OutlinedButton.icon(
                    onPressed: () => context.push(
                      '/bus/tickets/${Uri.encodeComponent(t.ticketNumber)}',
                    ),
                    icon: const Icon(Icons.qr_code_2, size: 18),
                    label: Text('Ticket · ${t.seatLabel}'),
                  ),
              ],
            ),
          ],
          if (b.status == 'pending_payment')
            const Padding(
              padding: EdgeInsets.only(top: 14),
              child: Text(
                'Waiting for payment confirmation. Refresh after approving the mobile money prompt.',
              ),
            ),
        ],
      ),
    );
  }
}
