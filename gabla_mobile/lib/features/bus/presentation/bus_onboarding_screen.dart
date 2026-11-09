import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/location/google_place_picker.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../auth/domain/session.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/custom_field_input.dart';
import 'bus_route_editor.dart';

class BusOnboardingScreen extends ConsumerStatefulWidget {
  const BusOnboardingScreen({super.key, this.token});
  final String? token;
  @override
  ConsumerState<BusOnboardingScreen> createState() =>
      _BusOnboardingScreenState();
}

class _BusOnboardingScreenState extends ConsumerState<BusOnboardingScreen> {
  final _invite = TextEditingController(),
      _password = TextEditingController(),
      _repeat = TextEditingController();
  final _form = GlobalKey<FormState>();
  Map<String, dynamic> _profile = {}, _answers = {};
  List<Map<String, dynamic>> _routes = [emptyBusRoute()];
  bool _ready = false, _busy = false;
  int _step = 0;
  String? _error;
  @override
  void dispose() {
    _invite.dispose();
    _password.dispose();
    _repeat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final token = widget.token;
    if (token == null || token.isEmpty)
      return Scaffold(
        appBar: const CommerceAppBar(title: 'Join Gabla Bus'),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Image.asset(
                'assets/artwork/bus.jpg',
                height: 220,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 26),
            Text(
              'Your company’s\nnext chapter.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 16),
            const Text(
              'Open the invitation sent by the Gabla team or paste the invitation link below to set up your company.',
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _invite,
              decoration: const InputDecoration(
                labelText: 'Invitation link or code',
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () {
                final raw = _invite.text.trim();
                final value =
                    Uri.tryParse(raw)?.queryParameters['token'] ?? raw;
                if (value.isNotEmpty)
                  context.go(
                    '/bus/onboarding?token=${Uri.encodeComponent(value)}',
                  );
              },
              child: const Text('Open invitation'),
            ),
            TextButton(
              onPressed: () => context.push('/bus/operator/login'),
              child: const Text('Already registered? Sign in'),
            ),
          ],
        ),
      );
    final path = '/bus/onboarding?token=${Uri.encodeComponent(token)}';
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Set up your company'),
      body: AsyncValueView(
        value: ref.watch(workspaceDataProvider(path)),
        onRetry: () => ref.invalidate(workspaceDataProvider(path)),
        data: (context, data) {
          if (!_ready) {
            final op = data['operator'] as Map? ?? {};
            _profile = {
              for (final key in [
                'companyName',
                'description',
                'contactPhone',
                'whatsapp',
                'parkName',
                'parkDistrict',
                'parkAddress',
                'parkLat',
                'parkLng',
                'logoUrl',
                'coverUrl',
                'fleetSize',
              ])
                if (op[key] != null) key: op[key],
            };
            _ready = true;
          }
          return Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(22),
              children: [
                Text(
                  [
                    'Your company account',
                    'Your company & park',
                    'Routes & tickets',
                    'Ready for your first passenger?',
                  ][_step],
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                LinearProgressIndicator(value: (_step + 1) / 4),
                const SizedBox(height: 24),
                if (_step == 0) ...[
                  Text('Invited as ${data['email']}'),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Choose a password',
                    ),
                    validator: (v) => (v?.length ?? 0) < 8
                        ? 'Use at least 8 characters.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _repeat,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Repeat password',
                    ),
                    validator: (v) =>
                        v != _password.text ? 'Passwords must match.' : null,
                  ),
                ],
                if (_step == 1) ...[
                  for (final e in {
                    'companyName': 'Company name',
                    'description': 'Company description',
                    'contactPhone': 'Contact phone',
                    'whatsapp': 'WhatsApp (optional)',
                    'parkName': 'Bus park name',
                    'parkDistrict': 'Park district',
                    'parkAddress': 'Park address',
                  }.entries)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: TextFormField(
                        key: ValueKey(e.key),
                        initialValue: '${_profile[e.key] ?? ''}',
                        decoration: InputDecoration(labelText: e.value),
                        onChanged: (v) => _profile[e.key] = v,
                        validator: (v) =>
                            [
                                  'companyName',
                                  'contactPhone',
                                  'parkName',
                                  'parkDistrict',
                                ].contains(e.key) &&
                                (v ?? '').trim().isEmpty
                            ? 'Enter ${e.value.toLowerCase()}.'
                            : null,
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final location = await pickGoogleLocation(
                        context,
                        title: 'Locate your bus park',
                      );
                      if (location != null)
                        setState(
                          () => _profile.addAll({
                            'parkAddress': location.address,
                            'parkLat': location.lat,
                            'parkLng': location.lng,
                          }),
                        );
                    },
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Choose park on map'),
                  ),
                  TextFormField(
                    initialValue: '${_profile['fleetSize'] ?? 0}',
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Fleet size'),
                    onChanged: (v) =>
                        _profile['fleetSize'] = int.tryParse(v) ?? 0,
                  ),
                  for (final field in data['questions'] as List? ?? [])
                    Padding(
                      padding: const EdgeInsets.only(top: 14),
                      child: CustomFieldInput(
                        field: Map<String, dynamic>.from(field),
                        value: _answers[field['key']],
                        onChanged: (v) =>
                            setState(() => _answers['${field['key']}'] = v),
                      ),
                    ),
                ],
                if (_step == 2) ...[
                  for (var i = 0; i < _routes.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: CommercePanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Route ${i + 1}',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 16),
                            BusRouteEditor(
                              key: ValueKey(i),
                              value: _routes[i],
                              busTypes: data['busTypes'] as List? ?? [],
                              onChanged: (v) => setState(() => _routes[i] = v),
                            ),
                            if (_routes.length > 1)
                              TextButton(
                                onPressed: () =>
                                    setState(() => _routes.removeAt(i)),
                                child: const Text('Remove route'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  if (_routes.length < 10)
                    OutlinedButton.icon(
                      onPressed: () =>
                          setState(() => _routes.add(emptyBusRoute())),
                      icon: const Icon(Icons.add),
                      label: const Text('Add another route'),
                    ),
                ],
                if (_step == 3)
                  CommercePanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${_profile['companyName']}',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        Text(
                          '${_profile['parkName']} · ${_profile['parkDistrict']}',
                        ),
                        const SizedBox(height: 20),
                        for (final r in _routes)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              '${r['originName']} → ${r['destinationName']} · ${(r['ticketTypes'] as List).length} ticket types',
                            ),
                          ),
                        const Text(
                          'Confirm the details above. Your company workspace will open after setup.',
                        ),
                      ],
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
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
                          if (_step == 2) {
                            for (final r in _routes) {
                              final error = validateBusRoute(r);
                              if (error != null) {
                                setState(() => _error = error);
                                return;
                              }
                            }
                          }
                          if (_step < 3) {
                            setState(() {
                              _step++;
                              _error = null;
                            });
                            return;
                          }
                          setState(() {
                            _busy = true;
                            _error = null;
                          });
                          try {
                            final result = await ref
                                .read(apiClientProvider)
                                .post<Map<String, dynamic>>(
                                  '/bus/onboarding/complete',
                                  body: {
                                    'token': token,
                                    'password': _password.text,
                                    'profile': {
                                      ..._profile,
                                      'customFields': _answers,
                                    },
                                    'routes': _routes
                                        .map(busRoutePayload)
                                        .toList(),
                                  },
                                );
                            await ref
                                .read(sessionControllerProvider.notifier)
                                .setSession(Session.fromJson(result));
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
                      _busy
                          ? 'Completing setup…'
                          : _step == 3
                          ? 'Complete company setup'
                          : 'Continue',
                    ),
                  ),
                ),
                if (_step > 0)
                  TextButton(
                    onPressed: _busy ? null : () => setState(() => _step--),
                    child: const Text('Back'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
