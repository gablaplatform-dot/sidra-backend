import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/font_group.dart';
import '../../../core/theme/style_tokens.dart';
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
    return Scaffold(body: SafeArea(child: Column(children: [_header(), Expanded(child: body)])));
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: _roundIconButton(
              icon: Icons.arrow_back_ios_new_rounded,
              tooltip: 'Back',
              onTap: () =>
                  context.canPop() ? context.pop() : context.go('/home'),
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                'Bookings & appointments',
                style: AppTypography.of(context).display(size: 18),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          SizedBox(
            width: 40,
            child: _roundIconButton(
              icon: Icons.refresh_rounded,
              tooltip: 'Refresh',
              onTap: () => ref.invalidate(providerBookingsProvider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _roundIconButton({
    required IconData icon,
    required VoidCallback onTap,
    String? tooltip,
  }) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: colors.surface,
        shape: BoxShape.circle,
        border: Border.all(color: colors.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        type: MaterialType.transparency,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Tooltip(
            message: tooltip ?? '',
            child: Icon(icon, size: 17, color: colors.onSurface),
          ),
        ),
      ),
    );
  }

  Widget _body(List<ProviderBooking> items) {
    final theme = Theme.of(context);
    final tokens = theme.extension<StyleTokens>();
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
      final colors = theme.colorScheme;
      return ListView(
        children: [
          const SizedBox(height: 100),
          Center(
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: colors.primary.withValues(alpha: .1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.event_available_rounded,
                size: 34,
                color: colors.primary,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Center(
            child: Text(
              'No bookings yet',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Publish a bookable or appointment service to start receiving requests.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
      children: [
        if (pending.isNotEmpty) ...[
          _sectionHeader('Needs a response', tokens),
          const SizedBox(height: 12),
          for (final b in pending) _card(b, highlight: true),
          const SizedBox(height: 24),
        ],
        _sectionHeader('Schedule', tokens),
        const SizedBox(height: 12),
        _dayStrip(counts),
        const SizedBox(height: 16),
        if (onSelectedDay.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: Center(
              child: Text(
                'No bookings on ${_friendlyDate(_selectedDay)}.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          )
        else
          for (final b in onSelectedDay) _card(b),
      ],
    );
  }

  Widget _sectionHeader(String title, StyleTokens? tokens) => Text(
    title,
    style:
        tokens?.sectionTitleStyle ?? Theme.of(context).textTheme.titleMedium,
  );

  Widget _dayStrip(Map<String, int> counts) {
    final days = List.generate(14, (i) => eatToday().add(Duration(days: i)));
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: 9),
        itemBuilder: (context, i) {
          final d = days[i];
          final key = bookingDate(d);
          final selected = key == bookingDate(_selectedDay);
          final count = counts[key] ?? 0;
          final colors = Theme.of(context).colorScheme;
          return SizedBox(
            width: 54,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: colors.primary.withValues(alpha: .35),
                          blurRadius: 16,
                          offset: const Offset(0, 7),
                        ),
                      ]
                    : null,
              ),
              child: Material(
                color: selected ? colors.primary : colors.surface,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => setState(() => _selectedDay = d),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: selected
                          ? null
                          : Border.all(color: colors.outlineVariant),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _weekdayAbbr(d.weekday),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: .3,
                            color: selected
                                ? colors.onPrimary.withValues(alpha: .75)
                                : colors.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${d.day}',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: selected ? colors.onPrimary : colors.onSurface,
                          ),
                        ),
                        Container(
                          margin: const EdgeInsets.only(top: 3),
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
            ),
          );
        },
      ),
    );
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  Widget _card(ProviderBooking b, {bool highlight = false}) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final tokens = theme.extension<StyleTokens>();
    final radius = tokens?.cardRadius ?? 18.0;
    final pillRadius = tokens?.pillRadius ?? 999.0;
    final floating = tokens?.cardStyle == CardVisualStyle.floating;
    final tag = _statusTag(b.status);
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlight
            ? colors.primaryContainer.withValues(alpha: .2)
            : colors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: floating
            ? null
            : Border.all(color: colors.outlineVariant.withValues(alpha: .7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: floating ? .08 : .035),
            blurRadius: floating ? 24 : 12,
            offset: Offset(0, floating ? 12 : 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: colors.primary.withValues(alpha: .12),
                child: Text(
                  _initials(b.customer.name),
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: colors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.listingName,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule_rounded,
                          size: 13,
                          color: colors.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            _when(b),
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
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
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.call_outlined,
                size: 14,
                color: colors.onSurfaceVariant,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${b.customer.name} · ${b.customer.phone}',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ],
          ),
          if (b.customer.notes case final notes? when notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.sticky_note_2_outlined,
                    size: 14,
                    color: colors.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      notes,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontStyle: FontStyle.italic,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (b.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  for (final it in b.items)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        it.price == null || it.price == 0
                            ? it.name
                            : '${it.name} · ${formatUgx(it.price)}',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: colors.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 14),
          Divider(height: 1, color: colors.outlineVariant.withValues(alpha: .6)),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                formatUgx(b.total),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              if (b.status == BookingStatus.confirmed) ...[
                TextButton(
                  onPressed: () => _act(b, 'cancel', title: 'Cancel booking'),
                  style: TextButton.styleFrom(foregroundColor: colors.error),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                if (b.canComplete) ...[
                  const SizedBox(width: 6),
                  FilledButton.tonal(
                    onPressed: () =>
                        _act(b, 'complete', title: 'Mark as completed?'),
                    style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(pillRadius),
                      ),
                    ),
                    child: const Text(
                      'Mark complete',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ],
          ),
          if (b.status == BookingStatus.pending) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _act(
                      b,
                      'decline',
                      title: 'Decline this request?',
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.error,
                      side: BorderSide(
                        color: colors.error.withValues(alpha: .45),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(pillRadius),
                      ),
                    ),
                    child: const Text(
                      'Decline',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () =>
                        _act(b, 'accept', title: 'Approve this request?'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      elevation: 6,
                      shadowColor: colors.primary.withValues(alpha: .5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(pillRadius),
                      ),
                    ),
                    child: const Text(
                      'Approve',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
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
