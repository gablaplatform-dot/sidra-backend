import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../workspace/presentation/workspace_form.dart';
import '../application/service_providers.dart';
import '../domain/booking.dart';
import '../domain/booking_selection.dart';
import '../domain/provider_booking.dart';

/// The provider's "Bookings & appointments" desk: urgent requests first, then
/// a day strip to browse everything else by date, with approve/decline (and
/// cancel/complete) actions - one screen for both reservation-style bookings
/// (night/day/hour) and slot-based appointments. See `ProfileBookingsTab.jsx`
/// for the web equivalent this mirrors.
class ProviderBookingsScreen extends ConsumerStatefulWidget {
  const ProviderBookingsScreen({super.key, this.embedded = false});
  final bool embedded;
  @override
  ConsumerState<ProviderBookingsScreen> createState() =>
      _ProviderBookingsScreenState();
}

class _ProviderBookingsScreenState
    extends ConsumerState<ProviderBookingsScreen> {
  late DateTime _selectedDay = eatToday();

  Future<void> _act(ProviderBooking b, String action, {String? title}) async {
    final needsNote = action == 'decline' || action == 'cancel';
    Future<void> run(String? note) async {
      try {
        await ref.read(bookingRepositoryProvider).respond(b.id, action, note: note);
        ref.invalidate(providerBookingsProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(title ?? 'Booking updated.')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('$e')));
        }
      }
    }

    if (needsNote) {
      await showWorkspaceForm(
        context,
        title: title ?? 'Update booking',
        action: action == 'decline' ? 'Decline' : 'Cancel',
        fields: const [
          WorkspaceField('note', 'Note to customer (optional)', type: 'long'),
        ],
        save: (v) => run(v['note'] as String?),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title ?? 'Confirm'),
        content: Text(
          action == 'accept'
              ? 'Approve this request? The guest will be notified.'
              : 'Mark this booking as completed?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed == true) await run(null);
  }

  bool _onDay(ProviderBooking b, String day) {
    final end = b.endDate ?? b.startDate;
    return day.compareTo(b.startDate) >= 0 && day.compareTo(end) <= 0;
  }

  @override
  Widget build(BuildContext context) {
    final bookings = ref.watch(providerBookingsProvider);
    final body = AsyncValueView(
      value: bookings,
      data: (context, items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(providerBookingsProvider);
          await ref.read(providerBookingsProvider.future);
        },
        child: _body(items),
      ),
    );
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Bookings & appointments')),
      body: body,
    );
  }

  Widget _body(List<ProviderBooking> items) {
    final pending = items.where((b) => b.status == BookingStatus.pending).toList()
      ..sort((a, b) => a.startDate.compareTo(b.startDate));
    final rest = items.where((b) => b.status != BookingStatus.pending).toList();
    final selectedDay = bookingDate(_selectedDay);
    final onSelectedDay = rest.where((b) => _onDay(b, selectedDay)).toList()
      ..sort((a, b) => (a.startTime ?? '').compareTo(b.startTime ?? ''));
    final counts = <String, int>{};
    for (final b in rest) {
      counts[b.startDate] = (counts[b.startDate] ?? 0) + 1;
    }

    if (items.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Icon(Icons.event_available_outlined, size: 48, color: Colors.grey),
          SizedBox(height: 12),
          Center(child: Text('No bookings yet')),
          SizedBox(height: 4),
          Center(
            child: Text(
              'Publish a bookable or appointment service to start receiving requests.',
              textAlign: TextAlign.center,
            ),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        if (pending.isNotEmpty) ...[
          Text('Needs a response', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          for (final b in pending) _card(b, highlight: true),
          const SizedBox(height: 22),
        ],
        Text('Schedule', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        _dayStrip(counts),
        const SizedBox(height: 14),
        if (onSelectedDay.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No bookings on ${_friendlyDate(_selectedDay)}.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          )
        else
          for (final b in onSelectedDay) _card(b),
      ],
    );
  }

  Widget _dayStrip(Map<String, int> counts) {
    final days = List.generate(14, (i) => eatToday().add(Duration(days: i)));
    return SizedBox(
      height: 74,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final d = days[i];
          final key = bookingDate(d);
          final selected = key == bookingDate(_selectedDay);
          final count = counts[key] ?? 0;
          final colors = Theme.of(context).colorScheme;
          return SizedBox(
            width: 52,
            child: Material(
              color: selected ? colors.primary : colors.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => setState(() => _selectedDay = d),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _weekdayAbbr(d.weekday),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? colors.onPrimary.withValues(alpha: .75)
                              : colors.onSurfaceVariant,
                        ),
                      ),
                      Text(
                        '${d.day}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: selected ? colors.onPrimary : colors.onSurface,
                        ),
                      ),
                      Container(
                        margin: const EdgeInsets.only(top: 2),
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: count > 0
                              ? (selected ? colors.onPrimary : colors.primary)
                              : Colors.transparent,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _card(ProviderBooking b, {bool highlight = false}) {
    final colors = Theme.of(context).colorScheme;
    final tag = _statusTag(b.status);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      color: highlight ? colors.primaryContainer.withValues(alpha: .25) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        b.listingName,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        _when(b),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: tag.$1,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    tag.$2,
                    style: TextStyle(
                      color: tag.$3,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('${b.customer.name} · ${b.customer.phone}'),
            if (b.customer.notes case final notes? when notes.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  notes,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
                ),
              ),
            if (b.items.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final it in b.items)
                      Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text(
                          it.price == null || it.price == 0
                              ? it.name
                              : '${it.name} · ${formatUgx(it.price)}',
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 6),
            Text(
              formatUgx(b.total),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            if (b.status == BookingStatus.pending) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _act(
                        b,
                        'decline',
                        title: 'Decline this request?',
                      ),
                      child: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () =>
                          _act(b, 'accept', title: 'Approve this request?'),
                      child: const Text('Approve'),
                    ),
                  ),
                ],
              ),
            ] else if (b.status == BookingStatus.confirmed) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  TextButton(
                    onPressed: () => _act(b, 'cancel', title: 'Cancel booking'),
                    child: const Text('Cancel'),
                  ),
                  if (b.canComplete) ...[
                    const Spacer(),
                    FilledButton.tonal(
                      onPressed: () =>
                          _act(b, 'complete', title: 'Mark as completed?'),
                      child: const Text('Mark complete'),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _when(ProviderBooking b) {
    final date = b.endDate != null && b.endDate != b.startDate
        ? '${_friendlyDateString(b.startDate)} → ${_friendlyDateString(b.endDate!)}'
        : _friendlyDateString(b.startDate);
    if (b.startTime == null) return date;
    return '$date · ${b.startTime}${b.endTime != null ? ' - ${b.endTime}' : ''}';
  }

  (Color, String, Color) _statusTag(BookingStatus status) {
    final colors = Theme.of(context).colorScheme;
    return switch (status) {
      BookingStatus.pending => (
        const Color(0xFFFEF3C7),
        'Requested',
        const Color(0xFF92400E),
      ),
      BookingStatus.confirmed => (
        const Color(0xFFDCFCE7),
        'Confirmed',
        const Color(0xFF166534),
      ),
      BookingStatus.completed => (
        colors.surfaceContainerHighest,
        'Completed',
        colors.onSurfaceVariant,
      ),
      BookingStatus.declined => (
        const Color(0xFFFFE4E6),
        'Declined',
        const Color(0xFF9F1239),
      ),
      BookingStatus.cancelled => (
        const Color(0xFFFFE4E6),
        'Cancelled',
        const Color(0xFF9F1239),
      ),
      BookingStatus.expired => (
        colors.surfaceContainerHighest,
        'Expired',
        colors.onSurfaceVariant,
      ),
    };
  }

  String _weekdayAbbr(int weekday) =>
      const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday - 1];

  String _friendlyDate(DateTime d) => _friendlyDateString(bookingDate(d));

  String _friendlyDateString(String ymd) {
    final parts = ymd.split('-');
    if (parts.length != 3) return ymd;
    final d = DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]}';
  }
}
