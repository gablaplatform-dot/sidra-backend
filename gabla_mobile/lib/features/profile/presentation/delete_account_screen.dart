import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';

class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() =>
      _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _form = GlobalKey<FormState>();
  final _confirmation = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false, _checking = true, _needsPassword = false;
  bool _accountReady = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAccount();
  }

  Future<void> _loadAccount() async {
    if (!ref.read(isSignedInProvider)) {
      setState(() => _checking = false);
      return;
    }
    setState(() {
      _checking = true;
      _accountReady = false;
      _error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .get<Map<String, dynamic>>('/auth/me');
      if (!mounted) return;
      setState(() {
        _needsPassword =
            (response['user'] as Map?)?['authProvider'] == 'password';
        _accountReady = true;
        _checking = false;
      });
    } catch (e) {
      if (mounted)
        setState(() {
          _checking = false;
          _error = e is ApiException
              ? e.message
              : 'Could not load your account. Please retry before continuing.';
        });
    }
  }

  @override
  void dispose() {
    _confirmation.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _confirmDelete() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .post(
            '/auth/me/delete',
            body: {
              'confirm': _confirmation.text.trim(),
              if (_needsPassword) 'password': _password.text,
            },
          );
      await ref.read(sessionControllerProvider.notifier).clear();
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted)
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Could not delete your account. Please try again.',
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final signedIn = ref.watch(isSignedInProvider);
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Delete account'),
      body: !signedIn
          ? CommerceEmpty(
              title: 'Sign in to delete your account',
              message: 'Use the Gabla account you want to delete.',
              action: 'Sign in',
              onAction: () => context.push('/login?next=%2Faccount%2Fdelete'),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(18),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  Icon(Icons.delete_outline, color: colors.error, size: 32),
                  const SizedBox(height: 16),
                  Text(
                    'Before you leave',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Deleting your account removes your personal details and sign-in access. Your business profile and listings will no longer be available. This cannot be undone.',
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Records we keep',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Order, payment, ticket and wallet records are kept without your personal details where other customers or businesses still need them.',
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Complete or cancel active orders, rides and bookings first. Business owners must also withdraw their balance and wait for pending withdrawals.',
                  ),
                  const SizedBox(height: 24),
                  if (_checking) ...[
                    const LinearProgressIndicator(),
                    const SizedBox(height: 8),
                    const Text('Checking your account…'),
                  ],
                  if (_needsPassword) ...[
                    TextFormField(
                      controller: _password,
                      enabled: !_loading,
                      obscureText: true,
                      autocorrect: false,
                      enableSuggestions: false,
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Current password',
                      ),
                      validator: (value) => (value ?? '').isEmpty
                          ? 'Enter your current password.'
                          : null,
                    ),
                    const SizedBox(height: 14),
                  ],
                  TextFormField(
                    controller: _confirmation,
                    enabled: !_loading && !_checking,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Type DELETE to confirm',
                      errorMaxLines: 2,
                    ),
                    validator: (value) =>
                        (value ?? '').trim().toUpperCase() == 'DELETE'
                        ? null
                        : 'Type DELETE to confirm account deletion.',
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style: TextStyle(color: colors.error),
                      ),
                    ),
                    if (!_accountReady)
                      TextButton(
                        onPressed: _loading ? null : _loadAccount,
                        child: const Text('Reload account details'),
                      ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.error,
                      foregroundColor: colors.onError,
                    ),
                    onPressed: _loading || _checking || !_accountReady
                        ? null
                        : _confirmDelete,
                    child: Text(
                      _loading ? 'Deleting account…' : 'Delete my account',
                    ),
                  ),
                  TextButton(
                    onPressed: _loading ? null : () => context.go('/profile'),
                    child: const Text('Keep my account'),
                  ),
                ],
              ),
            ),
    );
  }
}
