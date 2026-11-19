import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/network/network_providers.dart';
import '../application/community_providers.dart';

String eventTicketPrice(num value) =>
    'UGX ${NumberFormat.decimalPattern().format(value)}';
String _eventTime(Object? value) {
  final date = DateTime.tryParse('$value');
  return date == null
      ? ''
      : '${DateFormat('EEE, d MMM · HH:mm').format(date.toUtc().add(const Duration(hours: 3)))} EAT';
}

class EventTicketCheckout extends ConsumerStatefulWidget {
  const EventTicketCheckout({
    super.key,
    required this.eventId,
    required this.price,
  });
  final String eventId;
  final int price;

  @override
  ConsumerState<EventTicketCheckout> createState() =>
      _EventTicketCheckoutState();
}

class _EventTicketCheckoutState extends ConsumerState<EventTicketCheckout> {
  final _form = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  int _quantity = 1;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>(
            '/events/${widget.eventId}/tickets/orders',
            body: {
              'quantity': _quantity,
              'expectedPrice': widget.price,
              'payPhone': _phone.text.trim(),
              'email': _email.text.trim(),
            },
          );
      if (mounted) context.pushReplacement('/events/tickets/${order['id']}');
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Get tickets')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _TicketBanner(
            kicker: 'ONLINE TICKETS · MOBILE MONEY',
            title: 'General admission',
            subtitle: '${eventTicketPrice(widget.price)} per person',
          ),
          const SizedBox(height: 20),
          Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<int>(
                  initialValue: _quantity,
                  decoration: const InputDecoration(labelText: 'Tickets'),
                  items: [
                    for (var i = 1; i <= 10; i++)
                      DropdownMenuItem(value: i, child: Text('$i')),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) => setState(() => _quantity = value!),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _email,
                  decoration: const InputDecoration(
                    labelText: 'Email for your tickets',
                  ),
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: (value) =>
                      RegExp(
                        r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                      ).hasMatch(value?.trim() ?? '')
                      ? null
                      : 'Enter a valid email',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phone,
                  decoration: const InputDecoration(
                    labelText: 'Mobile Money number',
                    hintText: '07…',
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (value) =>
                      RegExp(
                        r'^(?:\+?256|0)7\d{8}$',
                      ).hasMatch(value?.trim() ?? '')
                      ? null
                      : 'Enter a Ugandan mobile number',
                ),
                const SizedBox(height: 16),
                if (_error case final error?)
                  Text(
                    error,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                FilledButton(
                  onPressed: _busy ? null : _pay,
                  child: Text(
                    _busy
                        ? 'Sending payment request…'
                        : 'Pay ${eventTicketPrice(_quantity * widget.price)}',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class EventTicketListScreen extends ConsumerStatefulWidget {
  const EventTicketListScreen({super.key});

  @override
  ConsumerState<EventTicketListScreen> createState() =>
      _EventTicketListScreenState();
}

class _EventTicketListScreenState extends ConsumerState<EventTicketListScreen> {
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final provider = communityEndpointProvider(
      '/events/tickets/mine?page=$_page',
    );
    return Scaffold(
      appBar: AppBar(title: const Text('My event tickets')),
      body: ref
          .watch(provider)
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(
              child: TextButton(
                onPressed: () => ref.invalidate(provider),
                child: Text('$error · Retry'),
              ),
            ),
            data: (data) {
              final orders = communityItems(data);
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const _TicketBanner(
                    kicker: 'GABLA EVENTS',
                    title: 'Your tickets',
                    subtitle: 'Open an order to show your admission passes.',
                  ),
                  if (orders.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(20),
                      child: Text('No orders on this page.'),
                    ),
                  for (final order in orders)
                    ListTile(
                      leading: const Icon(Icons.confirmation_number_outlined),
                      title: Text('${order['event']['title']}'),
                      subtitle: Text(_eventTime(order['event']['startsAt'])),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () =>
                          context.push('/events/tickets/${order['id']}'),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: _page > 1
                            ? () => setState(() => _page--)
                            : null,
                        child: const Text('Previous'),
                      ),
                      Text('Page $_page'),
                      TextButton(
                        onPressed: orders.length == 30
                            ? () => setState(() => _page++)
                            : null,
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
    );
  }
}

class EventTicketOrderScreen extends ConsumerStatefulWidget {
  const EventTicketOrderScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<EventTicketOrderScreen> createState() =>
      _EventTicketOrderScreenState();
}

class _EventTicketOrderScreenState
    extends ConsumerState<EventTicketOrderScreen> {
  Timer? _timer;
  Map<String, dynamic>? _order;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (_loading) return;
    _timer?.cancel();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(apiClientProvider)
          .get<Map<String, dynamic>>('/events/tickets/orders/${widget.id}');
      if (!mounted) return;
      setState(() => _order = data);
      if (data['status'] == 'pending_payment') {
        _timer = Timer(const Duration(seconds: 4), _load);
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final event = order?['event'] as Map?;
    final tickets = order?['tickets'] as List? ?? [];
    final status = order?['status'];
    final message = switch (status) {
      'pending_payment' =>
        'Approve the Mobile Money prompt on your phone. Your tickets will appear after payment clears.',
      'refunded' => 'This payment was refunded.',
      'failed' => 'The payment did not complete.',
      'expired' =>
        'The reservation expired. If you already paid, check this order before paying again.',
      'refund_due' =>
        'Payment arrived but tickets could not be issued. Contact Gabla support with this order reference.',
      _ => null,
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Ticket order')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _TicketBanner(
            kicker: status == 'paid' ? 'PAYMENT CONFIRMED' : 'GABLA EVENTS',
            title: '${event?['title'] ?? 'Your order'}',
            subtitle: event == null
                ? ''
                : '${_eventTime(event['startsAt'])}\n${event['address']} · ${eventTicketPrice(order!['total'] as num)}',
          ),
          if (_error case final error?)
            Padding(padding: const EdgeInsets.all(12), child: Text(error)),
          if (order == null && _loading) const LinearProgressIndicator(),
          if (message != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text('$message\n\nOrder ${widget.id}'),
            ),
          if (status != 'paid')
            OutlinedButton(
              onPressed: _loading ? null : _load,
              child: const Text('Check payment status'),
            ),
          for (final (index, item) in tickets.indexed)
            Card(
              margin: const EdgeInsets.only(top: 16),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Text(
                      'GENERAL ADMISSION · ${index + 1} / ${tickets.length}',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    const Divider(),
                    if (item['usedAt'] != null)
                      Text('Checked in · ${_eventTime(item['usedAt'])}')
                    else
                      Image.memory(
                        base64Decode((item['qr'] as String).split(',').last),
                        width: 200,
                        height: 200,
                        semanticLabel: 'Admission QR code',
                      ),
                    SelectableText(
                      '${item['number']}',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class EventDoorScreen extends ConsumerStatefulWidget {
  const EventDoorScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<EventDoorScreen> createState() => _EventDoorScreenState();
}

class _EventDoorScreenState extends ConsumerState<EventDoorScreen> {
  final _number = TextEditingController();
  bool _camera = false, _busy = false;
  String? _status, _error;

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  Future<void> _redeem(String number) async {
    if (_busy || number.trim().isEmpty) return;
    setState(() {
      _busy = true;
      _camera = false;
      _error = null;
      _status = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>(
            '/events/${widget.id}/tickets/redeem',
            body: {'number': number.trim()},
          );
      if (mounted) setState(() => _status = response['status'] as String);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final event = ref.watch(communityEndpointProvider('/events/${widget.id}'));
    final (title, detail, icon, tone) = switch (_status) {
      'valid' => (
        'Valid',
        'Checked in. Admit this guest.',
        Icons.check_circle_outline,
        const Color(0xff166534),
      ),
      'used' => (
        'Already used',
        'This pass has already been checked in.',
        Icons.history,
        const Color(0xff92400e),
      ),
      'not_found' => (
        'Not found',
        'Check the number and the event.',
        Icons.error_outline,
        const Color(0xff991b1b),
      ),
      _ => ('', '', Icons.info_outline, Colors.transparent),
    };
    return Scaffold(
      appBar: AppBar(title: const Text('Door check-in')),
      body: event.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
        data: (post) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _TicketBanner(
              kicker: 'ORGANIZER · DOOR CHECK-IN',
              title: '${post['title']}',
              subtitle:
                  'Scan one pass per guest or enter the printed ticket number. A valid pass is marked used immediately.',
            ),
            const SizedBox(height: 16),
            if (post['canManage'] != true)
              const Text('Only the event organizer can check in guests.')
            else ...[
              if (_camera)
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: MobileScanner(
                      onDetect: (capture) {
                        final code = capture.barcodes.firstOrNull?.rawValue;
                        if (code != null) _redeem(code);
                      },
                      errorBuilder: (context, error) => const Center(
                        child: Text(
                          'Camera unavailable. Enter the ticket number below.',
                        ),
                      ),
                    ),
                  ),
                ),
              OutlinedButton.icon(
                icon: Icon(_camera ? Icons.close : Icons.qr_code_scanner),
                onPressed: _busy
                    ? null
                    : () => setState(() {
                        _camera = !_camera;
                        _status = null;
                      }),
                label: Text(_camera ? 'Close camera' : 'Scan QR code'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _number,
                decoration: const InputDecoration(
                  labelText: 'Ticket number',
                  hintText: 'GE-…',
                ),
                textCapitalization: TextCapitalization.characters,
                maxLength: 128,
              ),
              FilledButton(
                onPressed: _busy ? null : () => _redeem(_number.text),
                child: Text(_busy ? 'Checking…' : 'Verify and check in'),
              ),
              if (_error case final error?) Text(error),
              if (_status != null)
                Semantics(
                  liveRegion: true,
                  child: Card(
                    color: Colors.white,
                    child: ListTile(
                      leading: Icon(icon, color: tone),
                      title: Text(
                        title,
                        style: TextStyle(
                          color: tone,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      subtitle: Text(detail, style: TextStyle(color: tone)),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TicketBanner extends StatelessWidget {
  const _TicketBanner({
    required this.kicker,
    required this.title,
    required this.subtitle,
  });
  final String kicker, title, subtitle;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xff901744),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            kicker,
            style: const TextStyle(
              color: Color(0xffffdbeb),
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(subtitle, style: const TextStyle(color: Colors.white)),
          ],
        ],
      ),
    ),
  );
}
