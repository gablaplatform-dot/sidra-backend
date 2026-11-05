import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/font_group.dart';
import '../../provider/application/provider_providers.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/session_controller.dart';
import '../domain/session.dart';

final providerDistrictsProvider = FutureProvider<List<String>>(
  (ref) => ref.watch(providerRepositoryProvider).fetchDistricts(),
);

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key, this.next});
  final String? next;
  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  String get _destination =>
      widget.next != null &&
          widget.next!.startsWith('/') &&
          !widget.next!.startsWith('//')
      ? widget.next!
      : '/home';
  final _name = TextEditingController(), _phone = TextEditingController();
  String? _district, _avatar, _error;
  bool _ready = false, _busy = false;
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionControllerProvider).valueOrNull?.user;
    if (!_ready) {
      _name.text = user?.name ?? '';
      _phone.text = user?.phone ?? '';
      _district = user?.district;
      _avatar = user?.avatarUrl;
      _ready = true;
    }
    final districtState = ref.watch(providerDistrictsProvider);
    final districts = districtState.valueOrNull ?? [];
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Account details'),
      body: ListView(
        padding: const EdgeInsets.all(18),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          Text(
            'Your profile',
            style: AppTypography.of(context).display(size: 30),
          ),
          const SizedBox(height: 14),
          const Text(
            'Add your name so people can recognize you. Your phone, photo and district are optional.',
          ),
          const SizedBox(height: 24),
          Center(
            child: CircleAvatar(
              radius: 44,
              backgroundImage: _avatar != null ? NetworkImage(_avatar!) : null,
              child: _avatar == null
                  ? const Icon(Icons.person_outline, size: 42)
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          MediaUploadButton(
            video: false,
            registerAsset: false,
            folder: 'user-avatar',
            label: 'Choose profile photo',
            onUploaded: (u) => setState(() => _avatar = u),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _name,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _phone,
            enabled: !_busy,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.telephoneNumber],
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Phone (optional)'),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            initialValue: districts.contains(_district) ? _district : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'District (optional)'),
            items: districts
                .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                .toList(),
            onChanged:
                _busy || districtState.isLoading || districtState.hasError
                ? null
                : (v) => _district = v,
          ),
          if (districtState.isLoading)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Loading districts…'),
            ),
          if (districtState.hasError)
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Districts could not be loaded. You can save without one.',
                  ),
                ),
                TextButton(
                  onPressed: () => ref.invalidate(providerDistrictsProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy
                ? null
                : () async {
                    if (_name.text.trim().isEmpty ||
                        _phone.text.isNotEmpty &&
                            _phone.text.replaceAll(RegExp(r'\D'), '').length <
                                7) {
                      setState(
                        () => _error = _name.text.trim().isEmpty
                            ? 'Enter your name.'
                            : 'Enter a phone number with at least 7 digits, or leave it blank.',
                      );
                      return;
                    }
                    setState(() {
                      _busy = true;
                      _error = null;
                    });
                    try {
                      final response = await ref
                          .read(apiClientProvider)
                          .patch<Map<String, dynamic>>(
                            '/auth/me',
                            body: {
                              'name': _name.text.trim(),
                              if (_phone.text.trim().isNotEmpty)
                                'phone': _phone.text.trim(),
                              if (_avatar != null) 'avatarUrl': _avatar,
                              'profile': {
                                'onboarded': true,
                                if (_district != null) 'district': _district,
                              },
                            },
                          );
                      final session = ref
                          .read(sessionControllerProvider)
                          .valueOrNull;
                      if (session != null)
                        await ref
                            .read(sessionControllerProvider.notifier)
                            .setSession(
                              session.copyWith(
                                user: AppUser.fromJson(
                                  Map<String, dynamic>.from(response['user']),
                                ),
                              ),
                            );
                      if (context.mounted) context.go(_destination);
                    } catch (e) {
                      if (mounted)
                        setState(() {
                          _busy = false;
                          _error = e is ApiException
                              ? e.message
                              : 'Could not save your profile. Please try again.';
                        });
                    }
                  },
            child: Text(_busy ? 'Saving…' : 'Save and continue'),
          ),
          TextButton(
            onPressed: _busy ? null : () => context.go(_destination),
            child: const Text('Skip for now'),
          ),
        ],
      ),
    );
  }
}
