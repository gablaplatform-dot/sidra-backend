import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../../auth/domain/session.dart';
import '../../shop/presentation/commerce_widgets.dart';

class BusOperatorLoginScreen extends ConsumerStatefulWidget {
  const BusOperatorLoginScreen({super.key});
  @override
  ConsumerState<BusOperatorLoginScreen> createState() =>
      _BusOperatorLoginScreenState();
}

class _BusOperatorLoginScreenState
    extends ConsumerState<BusOperatorLoginScreen> {
  final _email = TextEditingController(), _password = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false, _show = false;
  String? _error;
  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const CommerceAppBar(title: 'Operator sign-in'),
    body: ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Icon(
          Icons.directions_bus_outlined,
          size: 40,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          'Operator sign-in',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'Use your registered company account to manage routes, departures and passengers.',
        ),
        const SizedBox(height: 24),
        Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.username],
                enabled: !_busy,
                decoration: const InputDecoration(labelText: 'Company email'),
                validator: (v) => (v ?? '').contains('@')
                    ? null
                    : 'Enter your company email.',
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _password,
                obscureText: !_show,
                enabled: !_busy,
                autofillHints: const [AutofillHints.password],
                decoration: InputDecoration(
                  labelText: 'Password',
                  suffixIcon: IconButton(
                    tooltip: _show ? 'Hide password' : 'Show password',
                    onPressed: () => setState(() => _show = !_show),
                    icon: Icon(
                      _show
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                ),
                validator: (v) =>
                    (v ?? '').isEmpty ? 'Enter your password.' : null,
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        if (!_form.currentState!.validate()) return;
                        setState(() {
                          _busy = true;
                          _error = null;
                        });
                        try {
                          final data = await ref
                              .read(apiClientProvider)
                              .post<Map<String, dynamic>>(
                                '/auth/login',
                                body: {
                                  'email': _email.text.trim(),
                                  'password': _password.text,
                                },
                              );
                          final session = Session.fromJson(data);
                          if (!session.user.roles.contains('bus_operator'))
                            throw StateError(
                              'Use the account invited for your bus company.',
                            );
                          if ((data['busOperator']
                                  as Map?)?['onboardingStatus'] !=
                              'registered')
                            throw StateError(
                              'Complete your company invitation before signing in.',
                            );
                          await ref
                              .read(sessionControllerProvider.notifier)
                              .setSession(session);
                          if (context.mounted)
                            context.go('/bus/operator/dashboard');
                        } catch (e) {
                          if (mounted)
                            setState(() {
                              _busy = false;
                              _error = '$e';
                            });
                        }
                      },
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    _busy ? 'Signing in…' : 'Open operator workspace',
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.push('/bus/onboarding'),
                child: const Text('Complete a company invitation'),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
