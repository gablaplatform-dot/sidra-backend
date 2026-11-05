import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/application/shop_providers.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../application/booking_flow_controller.dart';
import '../application/service_providers.dart';
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
    return CommerceScaffold(
      appBar: const CommerceAppBar(title: 'Book service'),
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
          }
          if (flow.valueOrNull != null) return _confirmation(flow.valueOrNull!);
          if (!p.bookable || p.booking == null)
            return CommerceEmpty(
              title: 'Arrange this with the provider',
              message: 'This listing does not offer online reservations.',
              action: 'View provider',
              onAction: p.providerId == null
                  ? null
                  : () => context.push('/provider/${p.providerId}'),
              icon: Icons.support_agent,
            );
          return _content(p, flow.isLoading);
        },
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
        CommercePanel(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: CommerceImage(p.imageUrl),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (p.providerName != null)
                      Text(
                        p.providerName!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    const SizedBox(height: 4),
                    Text(
                      '${formatUgx(p.price)} / ${unit.name}',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: Text(
                _details ? '2. Contact details' : '1. Dates and guests',
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
        const SizedBox(height: 8),
        Text(
          _details
              ? 'Review your dates and estimate below before submitting.'
              : 'Choose dates, duration and number of guests. Times are shown in East Africa Time (EAT).',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
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
                    'Available start times',
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
                  if (hourly?.hasValue == true &&
                      !(hourly?.valueOrNull?.slots.any(
                            (slot) => slot.free > 0,
                          ) ??
                          false))
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'No start times available. Choose another date.',
                      ),
                    ),
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
                      labelText: 'Notes for the provider',
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
                'Booking summary',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 10),
              if (_date != null) ...[
                Text(
                  '${DateFormat.yMMMd().format(_date!)}${selection.endDate == null ? '' : ' – ${DateFormat.yMMMd().format(selection.endDate!)}'}',
                ),
                if (_time != null) Text('Start time: $_time EAT'),
                const Divider(height: 24),
              ],
              Text(
                formatUgx(total),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              Text(
                '$_units ${unit.name}${_units == 1 ? '' : 's'} × $_quantity ${unit == BookingUnit.night ? (_quantity == 1 ? 'room' : 'rooms') : (_quantity == 1 ? 'space' : 'spaces')} · $_guests ${_guests == 1 ? 'guest' : 'guests'}',
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
            padding: const EdgeInsets.symmetric(vertical: 2),
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
