import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/service_providers.dart';
import '../domain/booking.dart';
import '../domain/booking_config.dart';

class MyBookingsScreen extends ConsumerStatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  ConsumerState<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends ConsumerState<MyBookingsScreen> {
  String _filter = 'Upcoming';
  String? _busy;
  @override
  Widget build(BuildContext context) => CommerceScaffold(
    appBar: CommerceAppBar(
      title: 'My bookings',
      actions: [
        IconButton(
          tooltip: 'Refresh bookings',
          onPressed: () => ref.invalidate(myBookingsProvider),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final filter in ['Upcoming', 'Past', 'All'])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(filter),
                      selected: _filter == filter,
                      onSelected: (_) => setState(() => _filter = filter),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Expanded(
          child: AsyncValueView(
            value: ref.watch(myBookingsProvider),
            onRetry: () => ref.invalidate(myBookingsProvider),
            data: (context, all) {
              final items = all.where((b) {
                final terminal = [
                  BookingStatus.completed,
                  BookingStatus.cancelled,
                  BookingStatus.declined,
                  BookingStatus.expired,
                ].contains(b.status);
                return _filter == 'All' ||
                    (_filter == 'Past' ? terminal : !terminal);
              }).toList();
              if (items.isEmpty)
                return Center(
                  child: SingleChildScrollView(
                    child: CommerceEmpty(
                      title: all.isEmpty
                          ? 'No bookings yet'
                          : 'No bookings in this view',
                      message:
                          'Your stays, appointments and service bookings will appear here.',
                      icon: Icons.event_available_outlined,
                      action: 'Explore services',
                      onAction: () => context.push('/services'),
                    ),
                  ),
                );
              return ListView.builder(
                padding: const EdgeInsets.all(18),
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final b = items[i];
                  final color = b.status == BookingStatus.confirmed
                      ? Theme.of(context).colorScheme.primary
                      : b.status == BookingStatus.pending
                      ? Theme.of(context).colorScheme.tertiary
                      : Theme.of(context).colorScheme.onSurfaceVariant;
                  return DesignEntrance(
                    index: i,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: CommercePanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (b.providerName?.isNotEmpty == true)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Text(
                                  b.providerName!,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelMedium,
                                ),
                              ),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    b.listing?.name ?? 'Service booking',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleLarge,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Chip(
                                  label: Text(b.status.name),
                                  backgroundColor: color.withValues(alpha: .12),
                                ),
                              ],
                            ),
                            if (b.reference != null)
                              Text(
                                b.reference!,
                                style: const TextStyle(fontSize: 11),
                              ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                const Icon(
                                  Icons.calendar_month_outlined,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    '${b.startDate}${b.endDate != null ? ' → ${b.endDate}' : ''}',
                                  ),
                                ),
                              ],
                            ),
                            if (b.startTime != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  '${b.startTime} – ${b.endTime ?? '—'}',
                                ),
                              ),
                            const SizedBox(height: 12),
                            Text(
                              '${b.quantity} ${b.unit == BookingUnit.night ? (b.quantity == 1 ? 'room' : 'rooms') : (b.quantity == 1 ? 'space' : 'spaces')} · ${b.guests} ${b.guests == 1 ? 'guest' : 'guests'}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            const Divider(height: 28),
                            Text(
                              formatUgx(b.total),
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'Paid ${formatUgx(b.amountPaid)} · Due ${formatUgx(b.amountDue)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            if (b.payBy != null)
                              Text(
                                'Pay by ${b.payBy!.toUtc().add(const Duration(hours: 3)).toString().substring(0, 16)} EAT',
                                style: const TextStyle(fontSize: 12),
                              ),
                            for (final text in [
                              b.providerNote,
                              b.depositNote,
                              b.instructions,
                              b.policyText,
                              b.contact?.address,
                            ].whereType<String>())
                              if (text.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 10),
                                  child: Text(
                                    text,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      height: 1.5,
                                    ),
                                  ),
                                ),
                            if (b.contact?.phone != null)
                              TextButton.icon(
                                onPressed: () => launchUrl(
                                  Uri(scheme: 'tel', path: b.contact!.phone),
                                ),
                                icon: const Icon(Icons.phone_outlined),
                                label: const Text('Call provider'),
                              ),
                            if (b.canPay)
                              Padding(
                                padding: const EdgeInsets.only(top: 14),
                                child: FilledButton(
                                  onPressed: _busy == b.id
                                      ? null
                                      : () async {
                                          final result = await showCommercePayment(
                                            context,
                                            endpoint:
                                                '/payments/bookings/${b.id}/pay',
                                            amount: b.amountDue ?? 0,
                                            title: 'Pay booking',
                                          );
                                          if (result == true)
                                            ref.invalidate(myBookingsProvider);
                                        },
                                  child: Text('Pay ${formatUgx(b.amountDue)}'),
                                ),
                              ),
                            if (b.canCancel)
                              TextButton(
                                onPressed: _busy == b.id
                                    ? null
                                    : () => _cancel(b),
                                child: Text(
                                  _busy == b.id
                                      ? 'Cancelling…'
                                      : 'Cancel booking',
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
  Future<void> _cancel(Booking b) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cancel this booking?'),
        content: Text(
          b.policyText ??
              'Review the provider’s cancellation policy before continuing.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Keep booking'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() => _busy = b.id);
    try {
      await ref.read(bookingRepositoryProvider).cancel(b.id);
      ref.invalidate(myBookingsProvider);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }
}
