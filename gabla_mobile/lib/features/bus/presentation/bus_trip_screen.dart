import 'bus_design_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../application/bus_providers.dart';
import '../application/bus_checkout_controller.dart';
import '../domain/bus_trip.dart';

class BusTripScreen extends ConsumerStatefulWidget {
  const BusTripScreen({super.key, required this.tripId});
  final String tripId;
  @override
  ConsumerState<BusTripScreen> createState() => _BusTripScreenState();
}

class _BusTripScreenState extends ConsumerState<BusTripScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _phone = TextEditingController(),
      _email = TextEditingController(),
      _payPhone = TextEditingController();
  final Map<String, int> _qty = {};
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _payPhone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trip = ref.watch(tripDetailProvider(widget.tripId));
    final checkout = ref.watch(busCheckoutProvider(widget.tripId));
    return AsyncValueView(
      value: trip,
      onRetry: () => ref.invalidate(tripDetailProvider(widget.tripId)),
      data: (context, t) => MobilityLayout(
        bus: true,
        scene: const SizedBox(height: 112, child: BusScene()),
        stageKey: checkout.phase,
        title: checkout.phase == 'confirmed'
            ? 'Booking confirmed'
            : '${t.originName}\nto ${t.destinationName}',
        subtitle:
            '${t.companyName ?? 'Bus operator'} · ${DateFormat('EEE, d MMM · HH:mm').format(t.departAtEat)} EAT',
        actions: [
          IconButton(
            tooltip: 'My tickets',
            onPressed: () => context.push('/bus/tickets'),
            icon: const Icon(Icons.confirmation_number_outlined),
          ),
        ],
        child: checkout.restoring
            ? const Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text('Restoring your booking…'),
                ],
              )
            : checkout.phase == 'restore_error'
            ? Column(
                children: [
                  Text(checkout.error!),
                  TextButton(
                    onPressed: () => ref
                        .read(busCheckoutProvider(widget.tripId).notifier)
                        .retryRestore(),
                    child: const Text('Retry'),
                  ),
                ],
              )
            : ['waiting', 'confirmed', 'failed'].contains(checkout.phase)
            ? _paymentState(checkout)
            : _booking(t, checkout),
        footer: _itinerary(t),
      ),
    );
  }

  Widget _booking(BusTrip t, BusCheckoutState checkout) {
    final cap = (t.seatsAvailable ?? 0).clamp(0, t.maxPerBooking);
    // Availability may change after payment expiration or an explicit refresh.
    var remaining = cap;
    final quantities = <String, int>{};
    for (final type in t.ticketTypes) {
      final count = (_qty[type.id] ?? 0).clamp(0, remaining);
      quantities[type.id] = count;
      remaining -= count;
    }
    final count = quantities.values.fold(0, (a, b) => a + b);
    final total = t.ticketTypes.fold(
      0.0,
      (sum, type) => sum + type.price * (quantities[type.id] ?? 0),
    );
    final busy = checkout.phase == 'submitting';
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Choose your tickets',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (t.seatsAvailable != null)
                Text(
                  '${t.seatsAvailable} seats left',
                  style: const TextStyle(fontSize: 12),
                ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Seats are assigned after payment is confirmed.',
            style: TextStyle(fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 16),
          if (t.ticketTypes.isEmpty)
            const Text(
              'No ticket types are available for this departure. Try another departure.',
            ),
          if (!t.bookable)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text('Ticket sales for this departure are closed.'),
            ),
          for (final type in t.ticketTypes)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    type.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (type.description?.isNotEmpty == true)
                    Text(
                      type.description!,
                      style: const TextStyle(fontSize: 12),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          formatUgx(type.price),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Remove ${type.name}',
                        onPressed: busy || (quantities[type.id] ?? 0) == 0
                            ? null
                            : () => setState(() {
                                _qty
                                  ..clear()
                                  ..addAll(quantities);
                                _qty[type.id] = quantities[type.id]! - 1;
                              }),
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text(
                        '${quantities[type.id] ?? 0}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      IconButton(
                        tooltip: 'Add ${type.name}',
                        onPressed: busy || !t.bookable || count >= cap
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                setState(() {
                                  _qty
                                    ..clear()
                                    ..addAll(quantities);
                                  _qty[type.id] =
                                      (quantities[type.id] ?? 0) + 1;
                                });
                              },
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                  const Divider(),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text(
            'Passenger details',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _name,
            enabled: !busy,
            textCapitalization: TextCapitalization.words,
            autofillHints: const [AutofillHints.name],
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'Full name'),
            validator: (v) =>
                (v?.trim().length ?? 0) < 2 ? 'Enter your full name.' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _phone,
            enabled: !busy,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
            decoration: const InputDecoration(
              labelText: 'Passenger phone',
              hintText: '07XXXXXXXX',
            ),
            validator: (v) => normalizeBusPhone(v ?? '').isEmpty
                ? 'Enter a valid Ugandan phone number.'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _email,
            enabled: !busy,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email (optional)'),
            validator: (v) =>
                (v ?? '').trim().isNotEmpty &&
                    !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v!.trim())
                ? 'Enter a valid email.'
                : null,
          ),
          const SizedBox(height: 22),
          Text(
            'Mobile money payment',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const Text(
            'Approve the payment prompt on your phone to receive your tickets.',
            style: TextStyle(fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _payPhone,
            enabled: !busy,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Payment phone (optional)',
              helperText: 'Leave blank to use the passenger phone.',
              helperMaxLines: 2,
            ),
            validator: (v) =>
                (v ?? '').trim().isNotEmpty && normalizeBusPhone(v!).isEmpty
                ? 'Enter a valid payment number.'
                : null,
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              Expanded(child: Text('$count ticket${count == 1 ? '' : 's'}')),
              Text(
                formatUgx(total),
                style: const TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (checkout.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                checkout.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: busy || !t.bookable || count == 0
                ? null
                : () {
                    if (!ref.read(isSignedInProvider)) {
                      context.push(
                        '/login?next=${Uri.encodeComponent('/bus/trip/${widget.tripId}')}',
                      );
                      return;
                    }
                    if (!_form.currentState!.validate()) return;
                    ref
                        .read(busCheckoutProvider(widget.tripId).notifier)
                        .submit({
                          'tripId': widget.tripId,
                          'items': [
                            for (final type in t.ticketTypes)
                              if ((quantities[type.id] ?? 0) > 0)
                                {
                                  'ticketTypeId': type.id,
                                  'quantity': quantities[type.id],
                                },
                          ],
                          'passenger': {
                            'name': _name.text.trim(),
                            'phone': normalizeBusPhone(_phone.text),
                            if (_email.text.trim().isNotEmpty)
                              'email': _email.text.trim(),
                          },
                          'payPhone': normalizeBusPhone(
                            _payPhone.text.trim().isEmpty
                                ? _phone.text
                                : _payPhone.text,
                          ),
                        });
                  },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 15),
              child: busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      ref.watch(isSignedInProvider)
                          ? 'Pay ${formatUgx(total)}'
                          : 'Sign in to book',
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentState(BusCheckoutState s) {
    final b = s.booking ?? {}, tickets = b['tickets'] as List? ?? [];
    final done = s.phase == 'confirmed', failed = s.phase == 'failed';
    final expiry = DateTime.tryParse('${b['expiresAt'] ?? ''}');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MobilityActivityIcon(
          active: !done && !failed,
          icon: done
              ? Icons.check_circle_outline
              : failed
              ? Icons.info_outline
              : Icons.phone_android,
        ),
        const SizedBox(height: 18),
        Text(
          done
              ? 'Your tickets are ready'
              : failed
              ? 'Payment not confirmed'
              : 'Check your phone',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          done
              ? 'Show your ticket QR when boarding.'
              : failed
              ? 'Booking status: ${b['status'] ?? 'expired'}. Check your mobile money history before starting again.'
              : 'Approve the mobile money prompt. We will confirm your tickets here once payment succeeds.',
          textAlign: TextAlign.center,
          style: const TextStyle(height: 1.5),
        ),
        const SizedBox(height: 18),
        if (b['reference'] != null)
          Text('Reference · ${b['reference']}', textAlign: TextAlign.center),
        if (b['total'] != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              formatUgx(double.tryParse('${b['total']}')),
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
          ),
        if (!done && !failed && expiry != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'Seat hold until ${DateFormat('HH:mm').format(expiry.toUtc().add(const Duration(hours: 3)))} EAT',
              textAlign: TextAlign.center,
            ),
          ),
        if (s.error != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Text(s.error!, textAlign: TextAlign.center),
          ),
        const SizedBox(height: 20),
        if (done) ...[
          for (final ticket in tickets)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: FilledButton.icon(
                icon: const Icon(Icons.confirmation_number_outlined),
                label: Text(
                  'Seat ${ticket['seatNumber'] ?? '—'} · Open ticket',
                ),
                onPressed: () => context.push(
                  '/bus/tickets/${Uri.encodeComponent('${ticket['ticketNumber']}')}',
                ),
              ),
            ),
          TextButton(
            onPressed: () => context.push('/bus/tickets'),
            child: const Text('All my tickets'),
          ),
        ] else if (failed)
          FilledButton(
            onPressed: () => ref
                .read(busCheckoutProvider(widget.tripId).notifier)
                .startAgain(),
            child: const Text('Choose tickets again'),
          )
        else
          OutlinedButton(
            onPressed: () =>
                ref.read(busCheckoutProvider(widget.tripId).notifier).refresh(),
            child: const Text('Check payment status'),
          ),
      ],
    );
  }

  Widget _itinerary(BusTrip t) => MobilitySection(
    title: 'Boarding & arrival',
    child: BusPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _stop(
            Icons.trip_origin,
            t.originName,
            t.boardingPoint ?? t.parkName ?? 'Departure point',
            DateFormat('HH:mm').format(t.departAtEat),
          ),
          const Padding(
            padding: EdgeInsets.only(left: 9),
            child: Text('⋮\n⋮', style: TextStyle(height: .8)),
          ),
          _stop(
            Icons.location_on_outlined,
            t.destinationName,
            t.dropoffPoint ?? 'Arrival point',
            t.durationMinutes > 0
                ? DateFormat('HH:mm').format(t.arriveAtEat)
                : '—',
          ),
          if (t.busTypeName != null)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: Text(
                t.busTypeName!,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          if (t.amenities.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                children: [
                  for (final a in t.amenities)
                    Chip(label: Text(a, style: const TextStyle(fontSize: 11))),
                ],
              ),
            ),
          if (t.note?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(t.note!),
            ),
          if (t.contactPhone?.isNotEmpty == true)
            TextButton.icon(
              onPressed: () =>
                  launchUrl(Uri(scheme: 'tel', path: t.contactPhone)),
              icon: const Icon(Icons.phone_outlined),
              label: const Text('Call bus company'),
            ),
        ],
      ),
    ),
  );
  Widget _stop(IconData icon, String town, String point, String time) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(town, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(point, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
      const SizedBox(width: 8),
      Text(time, style: const TextStyle(fontWeight: FontWeight.w700)),
    ],
  );
}
