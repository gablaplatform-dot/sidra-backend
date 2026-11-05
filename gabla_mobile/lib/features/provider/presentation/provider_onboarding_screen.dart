import '../../../core/location/google_place_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/async_value_view.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/presentation/workspace_form.dart';
import '../../categories/application/category_providers.dart';
import '../application/provider_onboarding_providers.dart';
import '../domain/provider_invite.dart';

/// `/provider/onboarding?token=...` - completing an admin-sent provider
/// invite. There is no self-serve "become a provider" flow on the web app
/// either (see `ProviderInvite`'s doc comment), so without a token this is
/// just an explanation, not a form.
class ProviderOnboardingScreen extends ConsumerWidget {
  const ProviderOnboardingScreen({super.key, this.token});

  final String? token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (token == null || token!.isEmpty) {
      return CommerceScaffold(
        appBar: const CommerceAppBar(title: 'Your business invitation'),
        body: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            const CommerceIconArt(icon: Icons.storefront_outlined),
            const SizedBox(height: 26),
            Text(
              'Set up your business profile',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 16),
            const Text(
              'Your Gabla business profile starts with an invitation from the team. Open your invitation link or paste it below to continue.',
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => showWorkspaceForm(
                context,
                title: 'Open provider invitation',
                action: 'Continue',
                fields: const [
                  WorkspaceField(
                    'invite',
                    'Invitation link or code',
                    required: true,
                  ),
                ],
                save: (values) async {
                  final raw = '${values['invite']}'.trim(),
                      token = Uri.tryParse(
                        '${values['invite']}',
                      )?.queryParameters['token'];
                  context.go(
                    '/provider/onboarding?token=${Uri.encodeComponent(token ?? raw)}',
                  );
                },
              ),
              child: const Text('Open my invitation'),
            ),
          ],
        ),
      );
    }

    final invite = ref.watch(providerInviteProvider(token!));
    return CommerceScaffold(
      appBar: const CommerceAppBar(title: 'Business profile'),
      body: AsyncValueView<ProviderInvite>(
        value: invite,
        onRetry: () => ref.invalidate(providerInviteProvider(token!)),
        data: (context, inv) => _OnboardingBody(token: token!, invite: inv),
      ),
    );
  }
}

class _OnboardingBody extends ConsumerStatefulWidget {
  const _OnboardingBody({required this.token, required this.invite});

  final String token;
  final ProviderInvite invite;

  @override
  ConsumerState<_OnboardingBody> createState() => _OnboardingBodyState();
}

class _OnboardingBodyState extends ConsumerState<_OnboardingBody> {
  late final _businessName = TextEditingController(
    text: widget.invite.businessName,
  );
  late final _description = TextEditingController(
    text: widget.invite.description ?? '',
  );
  late final _email = TextEditingController(
    text: widget.invite.contact.email ?? widget.invite.email,
  );
  late final _phone = TextEditingController(
    text: widget.invite.contact.phone ?? widget.invite.phone ?? '',
  );
  late final _whatsapp = TextEditingController(
    text: widget.invite.contact.whatsapp ?? '',
  );
  late final _website = TextEditingController(
    text: widget.invite.contact.website ?? '',
  );
  late final _address = TextEditingController(
    text: widget.invite.location.address ?? '',
  );
  late final _city = TextEditingController(
    text: widget.invite.location.city ?? '',
  );
  late final _region = TextEditingController(
    text: widget.invite.location.region ?? '',
  );
  late final _country = TextEditingController(
    text: widget.invite.location.country ?? '',
  );
  String? _categoryId;
  Map<String, dynamic>? _geo;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.invite.categoryId;
    _geo = widget.invite.location.geo;
  }

  @override
  void dispose() {
    for (final c in [
      _businessName,
      _description,
      _email,
      _phone,
      _whatsapp,
      _website,
      _address,
      _city,
      _region,
      _country,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controllerState = ref.watch(providerOnboardingControllerProvider);
    final effectiveStep =
        widget.invite.alreadyRegistered &&
            controllerState.step == OnboardingStep.form
        ? OnboardingStep.linkGoogle
        : controllerState.step;

    return switch (effectiveStep) {
      OnboardingStep.form => _buildForm(context, controllerState),
      OnboardingStep.linkGoogle => _buildLinkGoogle(context, controllerState),
      OnboardingStep.done => _buildDone(context),
    };
  }

  Widget _buildForm(BuildContext context, ProviderOnboardingState state) {
    final categories = ref.watch(directoryCategoriesProvider);

    Widget field(
      String label,
      TextEditingController controller,
      String lockKey,
    ) {
      if (widget.invite.isLocked(lockKey)) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(color: Colors.grey.shade600),
                ),
              ),
              Text(controller.text.isEmpty ? '—' : controller.text),
            ],
          ),
        );
      }
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: TextField(
          controller: controller,
          decoration: InputDecoration(labelText: label),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Business', style: Theme.of(context).textTheme.titleSmall),
        field('Business name', _businessName, 'businessName'),
        field('Description', _description, 'description'),
        const SizedBox(height: 16),
        Text('Category', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        categories.when(
          data: (items) => DropdownButtonFormField<String>(
            initialValue: items.any((c) => c.id == _categoryId)
                ? _categoryId
                : null,
            items: items
                .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                .toList(),
            onChanged: (value) => setState(() => _categoryId = value),
            decoration: const InputDecoration(labelText: 'Category'),
          ),
          loading: () => const LinearProgressIndicator(),
          error: (_, _) => const Text('Could not load categories.'),
        ),
        const SizedBox(height: 16),
        Text('Contact', style: Theme.of(context).textTheme.titleSmall),
        field('Email', _email, 'contact.email'),
        field('Phone', _phone, 'contact.phone'),
        field('WhatsApp', _whatsapp, 'contact.whatsapp'),
        field('Website', _website, 'contact.website'),
        const SizedBox(height: 16),
        Text('Location', style: Theme.of(context).textTheme.titleSmall),
        field('Address', _address, 'location.address'),
        if (!widget.invite.isLocked('location.address') &&
            !widget.invite.isLocked('location.geo'))
          TextButton.icon(
            icon: const Icon(Icons.pin_drop_outlined),
            label: const Text('Choose business location with Google'),
            onPressed: () async {
              final point = await pickGoogleLocation(
                context,
                title: 'Choose your business location',
              );
              if (point == null || !mounted) return;
              setState(() {
                _address.text = point.address;
                _geo = {
                  'type': 'Point',
                  'coordinates': [point.lng, point.lat],
                };
              });
            },
          ),
        field('City', _city, 'location.city'),
        field('Region', _region, 'location.region'),
        field('Country', _country, 'location.country'),
        const SizedBox(height: 20),
        if (state.error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              state.error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ElevatedButton(
          onPressed: state.loading
              ? null
              : () => ref
                    .read(providerOnboardingControllerProvider.notifier)
                    .submitProfile(
                      token: widget.token,
                      businessName: _businessName.text.trim(),
                      description: _description.text.trim(),
                      contact: ProviderContactInfo(
                        email: _email.text.trim(),
                        phone: _phone.text.trim(),
                        whatsapp: _whatsapp.text.trim(),
                        website: _website.text.trim(),
                      ),
                      location: ProviderLocationInfo(
                        address: _address.text.trim(),
                        geo: _geo,
                        city: _city.text.trim(),
                        region: _region.text.trim(),
                        country: _country.text.trim(),
                      ),
                      categoryId: _categoryId,
                    ),
          child: state.loading
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save and continue'),
        ),
      ],
    );
  }

  Widget _buildLinkGoogle(BuildContext context, ProviderOnboardingState state) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.storefront,
            size: 48,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 16),
          Text(
            widget.invite.alreadyRegistered
                ? 'This invitation was already completed. Sign in with Google to continue.'
                : 'Your profile is ready. Sign in with Google to activate your provider account.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          if (state.error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                state.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          ElevatedButton.icon(
            icon: state.loading
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.login),
            label: const Text('Continue with Google'),
            onPressed: state.loading
                ? null
                : () => ref
                      .read(providerOnboardingControllerProvider.notifier)
                      .linkGoogleAccount(widget.token),
          ),
        ],
      ),
    );
  }

  Widget _buildDone(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Your provider account is ready!',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => context.go('/profile'),
            child: const Text('Go to profile'),
          ),
        ],
      ),
    );
  }
}
