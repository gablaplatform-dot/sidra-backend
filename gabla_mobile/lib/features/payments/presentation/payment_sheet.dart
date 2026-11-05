import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';

Future<bool?> showCommercePayment(
  BuildContext context, {
  required String endpoint,
  required double amount,
  required String title,
  String? providerId,
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  builder: (_) => PaymentSheet(
    endpoint: endpoint,
    amount: amount,
    title: title,
    providerId: providerId,
  ),
);

class PaymentSheet extends ConsumerStatefulWidget {
  const PaymentSheet({
    super.key,
    required this.endpoint,
    required this.amount,
    required this.title,
    this.providerId,
  });
  final String endpoint, title;
  final double amount;
  final String? providerId;
  @override
  ConsumerState<PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<PaymentSheet> {
  final _phone = TextEditingController();
  String _stage = 'form';
  String? _error, _transaction, _unlock;
  int _polls = 0;
  Timer? _timer;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _phone.text =
        ref.read(sessionControllerProvider).valueOrNull?.user.phone ?? '';
  }

  @override
  void dispose() {
    _timer?.cancel();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || _stage == 'waiting') return;
    if (_phone.text.replaceAll(RegExp(r'\D'), '').length < 9) {
      setState(() => _error = 'Enter a valid mobile money number.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>(
            widget.endpoint,
            body: {
              'phone': _phone.text.trim(),
              if (widget.providerId != null) 'providerId': widget.providerId,
            },
          );
      if (!mounted) return;
      _transaction = data['transactionId']?.toString();
      _unlock = data['contactUnlockId']?.toString();
      if (_transaction == null)
        throw StateError('Payment could not be started.');
      setState(() => _stage = 'waiting');
      _polls = 0;
      _schedule();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _schedule() {
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 3), _poll);
  }

  Future<void> _poll() async {
    if (!mounted || _transaction == null) return;
    try {
      final data = await ref
          .read(apiClientProvider)
          .get<Map<String, dynamic>>(
            '/payments/transactions/${Uri.encodeComponent(_transaction!)}/status',
          );
      if (!mounted) return;
      if (data['status'] == 'succeeded') {
        if (widget.providerId != null && _unlock != null)
          await const FlutterSecureStorage().write(
            key: 'gabla_unlock_${widget.providerId}',
            value: _unlock,
          );
        if (mounted) setState(() => _stage = 'succeeded');
        return;
      }
      if (data['status'] == 'failed') {
        setState(() => _stage = 'failed');
        return;
      }
    } catch (_) {}
    if (!mounted) return;
    _polls++;
    if (_polls >= 20) {
      setState(() => _stage = 'timeout');
    } else {
      _schedule();
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: EdgeInsets.fromLTRB(
      24,
      8,
      24,
      24 + MediaQuery.viewInsetsOf(context).bottom,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommerceTitle(switch (_stage) {
          'waiting' => 'Check your phone',
          'succeeded' => 'Payment confirmed',
          'failed' => 'Payment failed',
          'timeout' => 'Still waiting for confirmation',
          _ => widget.title,
        }),
        Text(
          formatUgx(widget.amount),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        if (_stage == 'form') ...[
          const Text(
            'A mobile money approval prompt will be sent to your number.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Mobile money number'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Starting…' : 'Pay with mobile money'),
          ),
        ] else if (_stage == 'waiting') ...[
          Text(
            'Approve the prompt on ${_phone.text}. We’ll check the payment automatically.',
          ),
          const SizedBox(height: 20),
          const LinearProgressIndicator(),
        ] else if (_stage == 'succeeded') ...[
          const Text('The payment has been confirmed by the server.'),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Done'),
          ),
        ] else if (_stage == 'timeout') ...[
          const Text(
            'The payment has not been confirmed yet. Check its status before starting another payment.',
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              setState(() => _stage = 'waiting');
              _polls = 0;
              _poll();
            },
            child: const Text('Check payment again'),
          ),
        ] else ...[
          const Text('Your payment was not completed. You can try again.'),
          FilledButton(
            onPressed: () => setState(() => _stage = 'form'),
            child: const Text('Try again'),
          ),
        ],
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.pop(context, _stage == 'succeeded'),
          child: Text(
            _stage == 'waiting'
                ? 'Close · check again from your orders'
                : 'Close',
          ),
        ),
      ],
    ),
  );
}
