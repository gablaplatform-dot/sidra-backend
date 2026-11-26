import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/discovery/discovery_widgets.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../provider/application/provider_providers.dart';
import '../../shop/application/shop_providers.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../application/booking_flow_controller.dart';
import '../application/service_providers.dart';
import '../domain/add_on.dart';
import '../domain/availability.dart';
import '../domain/booking.dart';
import '../domain/booking_config.dart';
import '../domain/booking_selection.dart';

class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({super.key, required this.listingId});
  final String listingId;
  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  DateTime? _date;
  late DateTime _month = DateTime(eatToday().year, eatToday().month);
  int _units = 1, _quantity = 1, _guests = 1;
  String? _time, _error;
  bool _details = false, _initialized = false;
  final Set<String> _addOns = {};
  bool _reminder = true;
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _phone = TextEditingController(),
      _email = TextEditingController(),
      _notes = TextEditingController();
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(bookingFlowControllerProvider, (previous, next) {
      if (next.hasError &&
          next.error is ApiException &&
          [
            'NOT_AVAILABLE',
            'DATES_BLOCKED',
          ].contains((next.error as ApiException).code)) {
        setState(() {
          _details = false;
          _date = null;
          _time = null;
          _error = 'Availability changed. Please choose new dates.';
        });
        ref.invalidate(availabilityRangeProvider);
        ref.invalidate(availabilityDayProvider);
      }
    });
    final product = ref.watch(productDetailProvider(widget.listingId));
    final flow = ref.watch(bookingFlowControllerProvider);
    final isAppointment =
        product.valueOrNull?.booking?.unit == BookingUnit.appointment;
    return Scaffold(
      appBar: isAppointment ? null : const CommerceAppBar(title: 'Book a service'),
      body: AsyncValueView(
        value: product,
        onRetry: () => ref.invalidate(productDetailProvider(widget.listingId)),
        data: (context, p) {
          if (!_initialized) {
            _units = p.booking?.minUnits ?? 1;
            _initialized = true;
            final user = ref.read(sessionControllerProvider).valueOrNull?.user;
            _name.text = user?.name ?? '';
            _phone.text = user?.phone ?? '';
            _email.text = user?.email ?? '';
            _addOns.addAll(
              p.items.where((it) => it.required).map((it) => it.name),
            );
          }
          if (flow.valueOrNull != null) {
            final confirmation = _confirmation(flow.valueOrNull!);
            return isAppointment
                ? SafeArea(
                    child: Column(
                      children: [
                        _apptHeader(),
                        Expanded(child: confirmation),
                      ],
                    ),
                  )
                : confirmation;
          }
          if (!p.bookable || p.booking == null)
            return CommerceEmpty(
              title: 'Arrange this with the provider',
              message: 'This listing does not offer online reservations.',
              action: 'View provider',
              onAction: () => context.push('/provider/${p.providerId}'),
              icon: Icons.support_agent,
            );
          return p.booking!.unit == BookingUnit.appointment
              ? _appointmentContent(p, flow.isLoading)
              : _content(p, flow.isLoading);
        },
      ),
    );
  }

  Future<void> _confirmAppointment(Product p) async {
    if (!ref.read(isSignedInProvider)) {
      context.push(
        '/login?next=${Uri.encodeComponent('/services/booking/${p.id}')}',
      );
      return;
    }
    final user = ref.read(sessionControllerProvider).valueOrNull?.user;
    await ref
        .read(bookingFlowControllerProvider.notifier)
        .submit(
          BookingSubmission(
            listingId: p.id,
            startDate: _date!,
            startTime: _time,
            quantity: 1,
            guests: 1,
            name: user?.name ?? '',
            phone: user?.phone ?? '',
            email: user?.email,
            selectedItems: _addOns.toList(),
            reminder: _reminder,
          ),
        );
  }

  /// A dedicated, photo-card-free booking flow for `unit == appointment`
  /// listings: a provider identity card, a rolling day strip, a 3-column
  /// slot grid, an optional add-ons checklist and a sticky confirm bar -
  /// deliberately not the generic night/day/hour counter form below, which
  /// still serves rentals, venues and hourly hires.
  Widget _appointmentContent(Product p, bool busy) {
    final config = p.booking!;
    final c = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<StyleTokens>();
    final radius = tokens?.cardRadius ?? 18.0;
    final pillRadius = tokens?.pillRadius ?? 999.0;
    final windowDays = math.min(config.advanceDays ?? 60, 60);
    final range = AvailabilityRangeQuery(
      listingId: widget.listingId,
      from: eatToday(),
      to: eatToday().add(Duration(days: windowDays)),
    );
    final availability = ref.watch(availabilityRangeProvider(range));
    final hourly = _date != null
        ? ref.watch(
            availabilityDayProvider(
              AvailabilityDayQuery(listingId: widget.listingId, date: _date!),
            ),
          )
        : null;
    final selection = evaluateBooking(
      config: config,
      start: _date,
      units: 1,
      quantity: 1,
      guests: 1,
      availability: availability.valueOrNull,
      startTime: _time,
      hourly: hourly?.valueOrNull,
    );
    final itemsByName = {for (final it in p.items) it.name: it};
    final extrasTotal = _addOns.fold<double>(
      0,
      (sum, name) => sum + (itemsByName[name]?.price ?? 0),
    );
    final days = List.generate(
      windowDays,
      (i) => eatToday().add(Duration(days: i)),
    );
    final slots = hourly?.valueOrNull?.slots ?? const [];
    final openSlots = slots.where((s) => s.isAvailable).length;

    return SafeArea(
      child: Column(
        children: [
          _apptHeader(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              children: [
                _apptProviderCard(p, radius),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      'Select date',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: c.onSurface,
                      ),
                    ),
                    Text(
                      DateFormat(
                        'MMMM yyyy',
                      ).format(_date ?? eatToday()),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: c.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 72,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    clipBehavior: Clip.none,
                    itemCount: days.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final d = days[i];
                      final key = bookingDate(d);
                      final known = availability.valueOrNull?.days[key];
                      final enabled = known?.isAvailable ?? true;
                      final selected =
                          _date != null && bookingDate(_date!) == key;
                      return _dayChip(
                        d,
                        selected: selected,
                        enabled: enabled,
                        onTap: enabled
                            ? () => setState(() {
                                _date = d;
                                _time = null;
                                _error = null;
                              })
                            : null,
                      );
                    },
                  ),
                ),
                if (_date != null) ...[
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Available slots',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: c.onSurface,
                        ),
                      ),
                      if (hourly?.hasValue == true)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: c.tertiaryContainer.withValues(alpha: .6),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '$openSlots open',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: c.onTertiaryContainer,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (hourly?.isLoading == true)
                    const LinearProgressIndicator()
                  else if (hourly?.hasError == true)
                    TextButton(
                      onPressed: () => ref.invalidate(
                        availabilityDayProvider(
                          AvailabilityDayQuery(
                            listingId: widget.listingId,
                            date: _date!,
                          ),
                        ),
                      ),
                      child: const Text('Couldn’t load slots · Retry'),
                    )
                  else if (slots.isEmpty)
                    Text(
                      'No times are available. Choose another date.',
                      style: TextStyle(color: c.onSurfaceVariant),
                    )
                  else
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 2.3,
                      children: [for (final s in slots) _slotButton(s)],
                    ),
                ],
                if (p.items.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  Text(
                    'Add extras',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: c.onSurface,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 2, bottom: 10),
                    child: Text(
                      "Provided with this service — tick what you'd like",
                      style: TextStyle(fontSize: 11.5, color: c.onSurfaceVariant),
                    ),
                  ),
                  for (final item in p.items) _addOnRow(item),
                ],
                const SizedBox(height: 20),
                InkWell(
                  borderRadius: BorderRadius.circular(radius),
                  onTap: () => setState(() => _reminder = !_reminder),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: c.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(radius),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.notifications_outlined,
                          size: 18,
                          color: c.onSurface,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Remind me 1 hour before',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: c.onSurface,
                            ),
                          ),
                        ),
                        Switch(
                          value: _reminder,
                          onChanged: (v) => setState(() => _reminder = v),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          _apptStickyBar(
            p,
            busy: busy,
            error: selection.error,
            flowError: ref.watch(bookingFlowControllerProvider).hasError
                ? '${ref.watch(bookingFlowControllerProvider).error}'
                : null,
            extrasTotal: extrasTotal,
            pillRadius: pillRadius,
          ),
        ],
      ),
    );
  }

  Widget _apptHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: _circleIcon(
              Icons.arrow_back_ios_new_rounded,
              () => context.canPop() ? context.pop() : context.go('/home'),
              tooltip: 'Back',
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                'Book Appointment',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const SizedBox(width: 40),
        ],
      ),
    );
  }

  Widget _circleIcon(IconData icon, VoidCallback onTap, {String? tooltip}) {
    final c = Theme.of(context).colorScheme;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: c.surface,
        shape: BoxShape.circle,
        border: Border.all(color: c.outlineVariant),
      ),
      child: Material(
        type: MaterialType.transparency,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Tooltip(
            message: tooltip ?? '',
            child: Icon(icon, size: 17, color: c.onSurface),
          ),
        ),
      ),
    );
  }

  Widget _apptProviderCard(Product p, double radius) {
    final c = Theme.of(context).colorScheme;
    final initial = p.providerName?.trim().isNotEmpty == true
        ? p.providerName!.trim()[0].toUpperCase()
        : 'G';
    final detail = p.providerId != null
        ? ref.watch(providerDetailProvider(p.providerId!)).valueOrNull
        : null;
    final rating = (detail?['ratingAvg'] as num?)?.toDouble();
    final ratingCount = (detail?['ratingCount'] as num?)?.toInt() ?? 0;
    return Container(
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 18),
      decoration: BoxDecoration(
        color: c.surfaceContainerLow,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [c.primary, c.primaryContainer],
              ),
            ),
            child: Text(
              initial,
              style: TextStyle(
                color: c.onPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.providerName ?? 'Provider',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (p.district != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      p.district!,
                      style: TextStyle(fontSize: 12, color: c.onSurfaceVariant),
                    ),
                  ),
                if (rating != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          size: 14,
                          color: Color(0xFFFACC15),
                        ),
                        const SizedBox(width: 3),
                        Text(
                          rating.toStringAsFixed(1),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (ratingCount > 0)
                          Text(
                            ' ($ratingCount)',
                            style: TextStyle(
                              fontSize: 12,
                              color: c.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dayChip(
    DateTime d, {
    required bool selected,
    required bool enabled,
    required VoidCallback? onTap,
  }) {
    final c = Theme.of(context).colorScheme;
    return SizedBox(
      width: 52,
      child: Material(
        color: selected ? c.primary : c.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: selected
                  ? null
                  : Border.all(
                      color: enabled
                          ? c.outlineVariant
                          : c.outlineVariant.withValues(alpha: .4),
                    ),
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
                        ? c.onPrimary.withValues(alpha: .75)
                        : enabled
                        ? c.onSurfaceVariant
                        : c.onSurfaceVariant.withValues(alpha: .4),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${d.day}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: selected
                        ? c.onPrimary
                        : enabled
                        ? c.onSurface
                        : c.onSurface.withValues(alpha: .35),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _weekdayAbbr(int weekday) =>
      const ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][weekday - 1];

  String _formatSlotLabel(String time) {
    final parts = time.split(':');
    final h = int.tryParse(parts.first) ?? 0;
    final m = int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0;
    return DateFormat('h:mm a').format(DateTime(2000, 1, 1, h, m));
  }

  Widget _slotButton(TimeSlot slot) {
    final c = Theme.of(context).colorScheme;
    final booked = !slot.isAvailable;
    final selected = !booked && _time == slot.time;
    return OutlinedButton(
      onPressed: booked
          ? null
          : () => setState(() {
              _time = slot.time;
              _error = null;
            }),
      style: OutlinedButton.styleFrom(
        backgroundColor: booked
            ? c.surfaceContainerHighest.withValues(alpha: .5)
            : selected
            ? c.primaryContainer.withValues(alpha: .45)
            : c.surface,
        side: BorderSide(color: selected ? c.primary : c.outlineVariant),
        padding: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: Text(
        _formatSlotLabel(slot.time),
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
          decoration: booked ? TextDecoration.lineThrough : null,
          color: booked
              ? c.onSurfaceVariant.withValues(alpha: .5)
              : selected
              ? c.primary
              : c.onSurface,
        ),
      ),
    );
  }

  Widget _addOnRow(AddOn item) {
    final c = Theme.of(context).colorScheme;
    final on = _addOns.contains(item.name);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: item.required
            ? null
            : () => setState(() {
                if (on) {
                  _addOns.remove(item.name);
                } else {
                  _addOns.add(item.name);
                }
              }),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: on ? c.primaryContainer.withValues(alpha: .18) : c.surface,
            border: Border.all(
              color: on ? c.primary.withValues(alpha: .5) : c.outlineVariant,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 19,
                height: 19,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: on ? c.primary : Colors.transparent,
                  border: Border.all(
                    color: on ? c.primary : c.outlineVariant,
                    width: 1.5,
                  ),
                ),
                child: on
                    ? Icon(Icons.check, size: 12, color: c.onPrimary)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                item.required
                    ? 'Required'
                    : (item.price != null && item.price! > 0
                          ? formatUgx(item.price!)
                          : 'Included'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: item.required ? c.onSurfaceVariant : c.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _apptStickyBar(
    Product p, {
    required bool busy,
    required String? error,
    required String? flowError,
    required double extrasTotal,
    required double pillRadius,
  }) {
    final c = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        14 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.outlineVariant)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                error,
                style: TextStyle(color: c.error, fontSize: 12),
              ),
            ),
          if (flowError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                flowError,
                style: TextStyle(color: c.error, fontSize: 12),
              ),
            ),
          if (extrasTotal > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Extras total',
                    style: TextStyle(fontSize: 12, color: c.onSurfaceVariant),
                  ),
                  Text(
                    formatUgx(extrasTotal),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: busy || error != null
                  ? null
                  : () => _confirmAppointment(p),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(pillRadius),
                ),
              ),
              child: Text(
                busy
                    ? 'Submitting…'
                    : p.bookingMode == 'instant'
                    ? 'Confirm Booking'
                    : 'Request Booking',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _content(Product p, bool busy) {
    final config = p.booking!, unit = config.unit;
    final range = AvailabilityRangeQuery(
      listingId: widget.listingId,
      from: _month,
      to: _month.add(const Duration(days: 62)),
    );
    final availability = ref.watch(availabilityRangeProvider(range));
    final hourly = unit == BookingUnit.hour && _date != null
        ? ref.watch(
            availabilityDayProvider(
              AvailabilityDayQuery(listingId: widget.listingId, date: _date!),
            ),
          )
        : null;
    final selection = evaluateBooking(
      config: config,
      start: _date,
      units: _units,
      quantity: _quantity,
      guests: _guests,
      availability: availability.valueOrNull,
      startTime: _time,
      hourly: hourly?.valueOrNull,
    );
    final total = p.price * _units * _quantity;
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        ListingDiscoveryCard(product: p),
        Row(
          children: [
            Expanded(
              child: Text(
                _details ? '2 / Your details' : '1 / Dates & guests',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            if (_details)
              TextButton(
                onPressed: busy ? null : () => setState(() => _details = false),
                child: const Text('Edit dates'),
              ),
          ],
        ),
        const SizedBox(height: 14),
        if (!_details) ...[
          CommercePanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _date == null
                      ? 'Choose your first day'
                      : DateFormat('EEEE, d MMMM').format(_date!),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (availability.isLoading) const LinearProgressIndicator(),
                if (availability.hasError)
                  TextButton(
                    onPressed: () =>
                        ref.invalidate(availabilityRangeProvider(range)),
                    child: const Text('Availability unavailable · Retry'),
                  ),
                CalendarDatePicker(
                  key: ValueKey(widget.listingId),
                  initialDate: null,
                  firstDate: eatToday(),
                  lastDate: eatToday().add(
                    Duration(days: (config.advanceDays ?? 365) - 1),
                  ),
                  currentDate: _date ?? eatToday(),
                  onDisplayedMonthChanged: (m) => setState(() => _month = m),
                  selectableDayPredicate: (d) =>
                      availability.hasValue &&
                      (availability.valueOrNull?.days[bookingDate(d)]?.free ??
                              config.inventory ??
                              1) >
                          0,
                  onDateChanged: (d) => setState(() {
                    _date = d;
                    _time = null;
                    _error = null;
                  }),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (unit == BookingUnit.hour && _date != null)
            CommercePanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available start times (EAT)',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 10),
                  if (hourly?.isLoading == true)
                    const LinearProgressIndicator(),
                  if (hourly?.hasError == true)
                    TextButton(
                      onPressed: () => ref.invalidate(
                        availabilityDayProvider(
                          AvailabilityDayQuery(
                            listingId: widget.listingId,
                            date: _date!,
                          ),
                        ),
                      ),
                      child: const Text('Retry time slots'),
                    ),
                  if (hourly?.valueOrNull case final day?
                      when !day.slots.any((slot) => slot.free > 0))
                    const Text('No times are available. Choose another date.'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final slot in hourly?.valueOrNull?.slots ?? [])
                        ChoiceChip(
                          label: Text(slot.time),
                          selected: _time == slot.time,
                          onSelected: slot.free > 0
                              ? (_) => setState(() => _time = slot.time)
                              : null,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          CommercePanel(
            child: Column(
              children: [
                BookingCounter(
                  label: unit == BookingUnit.hour
                      ? 'Hours'
                      : unit == BookingUnit.day
                      ? 'Days'
                      : 'Nights',
                  value: _units,
                  min: config.minUnits ?? 1,
                  max: config.maxUnits ?? 30,
                  onChange: (v) => setState(() => _units = v),
                ),
                BookingCounter(
                  label: unit == BookingUnit.night ? 'Rooms' : 'Spaces',
                  value: _quantity,
                  min: 1,
                  max: selection.maxQuantity,
                  onChange: (v) => setState(() {
                    _quantity = v;
                    _guests = _guests.clamp(1, (config.capacity ?? 2) * v);
                  }),
                ),
                BookingCounter(
                  label: 'Guests',
                  value: _guests,
                  min: 1,
                  max: selection.maxGuests,
                  onChange: (v) => setState(() => _guests = v),
                ),
              ],
            ),
          ),
          if (_date != null && selection.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                selection.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (_date != null && selection.endDate != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                '${unit == BookingUnit.night ? 'Checkout' : 'Last day'} · ${DateFormat.yMMMd().format(selection.endDate!)}',
              ),
            ),
        ] else
          Form(
            key: _form,
            child: CommercePanel(
              child: Column(
                children: [
                  TextFormField(
                    controller: _name,
                    enabled: !busy,
                    decoration: const InputDecoration(labelText: 'Full name'),
                    validator: (v) => (v?.trim().length ?? 0) < 2
                        ? 'Enter your full name.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phone,
                    enabled: !busy,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone'),
                    validator: (v) =>
                        (v ?? '').replaceAll(RegExp(r'\D'), '').length < 7
                        ? 'Enter a valid phone.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    enabled: !busy,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email (optional)',
                    ),
                    validator: (v) =>
                        (v ?? '').isNotEmpty &&
                            !RegExp(
                              r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                            ).hasMatch(v!.trim())
                        ? 'Enter a valid email.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notes,
                    enabled: !busy,
                    maxLength: 800,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Booking description (optional)',
                      hintText: 'Tell the provider what you need.',
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 18),
        CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Your booking estimate',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              Text(
                formatUgx(total),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              Text(
                '$_units ${unit.name}${_units == 1 ? '' : 's'} · $_quantity ${unit == BookingUnit.night ? 'rooms' : 'spaces'} · $_guests guests',
                style: const TextStyle(fontSize: 12),
              ),
              if ((config.depositPercent ?? 0) > 0)
                Text(
                  'Online deposit · ${formatUgx((total * config.depositPercent! / 100).round())} (${config.depositPercent}%)',
                  style: const TextStyle(fontSize: 12),
                ),
              if (config.depositNote?.isNotEmpty == true)
                Text(config.depositNote!, style: const TextStyle(fontSize: 12)),
              if (config.checkIn != null && unit == BookingUnit.night)
                Text(
                  'Check-in ${config.checkIn} · Checkout ${config.checkOut ?? '—'}',
                  style: const TextStyle(fontSize: 12),
                ),
              if (config.cancellation != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    config.cancellation!,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              const SizedBox(height: 12),
              Text(
                p.bookingMode == 'instant'
                    ? 'Instant confirmation, subject to availability.'
                    : 'The provider will review your request before payment.',
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        if (ref.watch(bookingFlowControllerProvider).hasError)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              '${ref.watch(bookingFlowControllerProvider).error}',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: busy || selection.error != null
              ? null
              : () async {
                  if (!_details) {
                    if (!ref.read(isSignedInProvider)) {
                      context.push(
                        '/login?next=${Uri.encodeComponent('/services/booking/${p.id}')}',
                      );
                      return;
                    }
                    setState(() => _details = true);
                    return;
                  }
                  if (!_form.currentState!.validate()) return;
                  await ref
                      .read(bookingFlowControllerProvider.notifier)
                      .submit(
                        BookingSubmission(
                          listingId: p.id,
                          startDate: _date!,
                          endDate: selection.endDate,
                          startTime: unit == BookingUnit.hour ? _time : null,
                          hours: unit == BookingUnit.hour ? _units : null,
                          quantity: _quantity,
                          guests: _guests,
                          name: _name.text.trim(),
                          phone: _phone.text.trim(),
                          email: _email.text.trim(),
                          notes: _notes.text.trim(),
                        ),
                      );
                },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              busy
                  ? 'Submitting…'
                  : _details
                  ? p.bookingMode == 'instant'
                        ? 'Confirm booking'
                        : 'Request booking'
                  : 'Continue to details',
            ),
          ),
        ),
      ],
    );
  }

  Widget _confirmation(Booking b) => ListView(
    padding: const EdgeInsets.all(22),
    children: [
      const SizedBox(height: 20),
      const Icon(Icons.event_available_outlined, size: 64),
      const SizedBox(height: 18),
      Text(
        b.status == BookingStatus.confirmed
            ? 'Your booking is confirmed'
            : 'Your request is with the provider',
        style: Theme.of(context).textTheme.headlineMedium,
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 14),
      if (b.reference != null) Center(child: Text(b.reference!)),
      const SizedBox(height: 24),
      CommercePanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${b.startDate} → ${b.endDate ?? b.startDate}'),
            if (b.startTime != null)
              Text('${b.startTime} – ${b.endTime ?? ''}'),
            const SizedBox(height: 12),
            Text(
              formatUgx(b.total),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (b.items.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final it in b.items)
                      Text(
                        '• ${it.name}${it.price != null && it.price! > 0 ? ' (${formatUgx(it.price!)})' : ''}',
                        style: const TextStyle(fontSize: 12),
                      ),
                  ],
                ),
              ),
            if (b.providerName != null) Text(b.providerName!),
            if (b.instructions != null) Text(b.instructions!),
            if (b.contact?.address != null) Text(b.contact!.address!),
            if (b.policyText != null) Text(b.policyText!),
          ],
        ),
      ),
      const SizedBox(height: 22),
      if (b.canPay || b.paymentStatus == 'payable')
        FilledButton(
          onPressed: () async {
            await showCommercePayment(
              context,
              endpoint: '/payments/bookings/${b.id}/pay',
              amount: b.amountDue ?? 0,
              title: 'Pay booking deposit',
            );
            ref.invalidate(myBookingsProvider);
          },
          child: Text('Pay ${formatUgx(b.amountDue)}'),
        ),
      FilledButton(
        onPressed: () {
          ref.read(bookingFlowControllerProvider.notifier).reset();
          context.go('/profile/bookings');
        },
        child: const Text('View my bookings'),
      ),
    ],
  );
}

class BookingCounter extends StatelessWidget {
  const BookingCounter({
    super.key,
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChange,
  });
  final String label;
  final int value, min, max;
  final ValueChanged<int> onChange;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: Text(label)),
      IconButton(
        tooltip: 'Fewer $label',
        onPressed: value > min ? () => onChange(value - 1) : null,
        icon: const Icon(Icons.remove_circle_outline),
      ),
      Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
      IconButton(
        tooltip: 'More $label',
        onPressed: value < max ? () => onChange(value + 1) : null,
        icon: const Icon(Icons.add_circle_outline),
      ),
    ],
  );
}
