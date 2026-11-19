import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/page_band.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/workspace_screen.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).valueOrNull?.user;
    if (user?.roles.contains('provider') == true) {
      return const _ProviderProfile();
    }
    return const Scaffold(
      appBar: CommerceAppBar(title: 'Your space'),
      body: _AccountProfile(),
    );
  }
}

class _AccountProfile extends ConsumerWidget {
  const _AccountProfile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).valueOrNull?.user,
        c = Theme.of(context).colorScheme;
    final operator = user?.roles.contains('bus_operator') == true;
    final entries = [
      (
        'Account details',
        'Your name, photo, phone and district',
        '/welcome',
        Icons.manage_accounts_outlined,
      ),
      (
        'My orders',
        'Purchases and delivery updates',
        '/orders',
        Icons.shopping_bag_outlined,
      ),
      (
        'My bookings',
        'Stays, appointments and experiences',
        '/profile/bookings',
        Icons.event_available_outlined,
      ),
      (
        'Bus tickets',
        'Your next journey and boarding passes',
        '/bus/tickets',
        Icons.confirmation_number_outlined,
      ),
      (
        'Saved businesses',
        'Your trusted people, together',
        '/profile/saved',
        Icons.favorite_border,
      ),
      if (operator)
        (
          'Operator workspace',
          'Routes, trips and passengers',
          '/bus/operator/dashboard',
          Icons.directions_bus_outlined,
        ),
      (
        'Design Studio',
        'Five designs, colors, fonts and motion',
        '/settings/appearance',
        Icons.tune,
      ),
    ];
    final radius = BorderRadius.circular(commerceRadius(commerceStyle(ref)));
    Widget group(String heading, Iterable<Widget> rows, {int index = 1}) =>
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: DesignEntrance(
            index: index,
            child: PageBand(
              color: c.surface,
              borderRadius: radius,
              elevation: 2,
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    heading,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(height: 6),
                ...rows,
              ],
            ),
          ),
        );
    Widget tile((String, String, String, IconData) entry) => ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      leading: CircleAvatar(
        radius: 17,
        backgroundColor: c.surfaceContainerHigh,
        foregroundColor: c.primary,
        child: Icon(entry.$4, size: 17),
      ),
      title: Text(entry.$1),
      subtitle: Text(entry.$2),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push(entry.$3),
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        DesignEntrance(
          child: PageBand(
            color: c.primaryContainer,
            elevation: 4,
            borderRadius: radius,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: c.primary,
                    foregroundColor: c.onPrimary,
                    child: Text(
                      user?.name.isNotEmpty == true
                          ? user!.name.characters.first.toUpperCase()
                          : 'G',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? 'Welcome to Gabla',
                          style: AppTypography.of(
                            context,
                          ).display(size: 26, color: c.onPrimaryContainer),
                        ),
                        if (user?.email.isNotEmpty == true)
                          Text(
                            user!.email,
                            style: TextStyle(color: c.onPrimaryContainer),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        group('Activity', entries.skip(1).take(4).map(tile)),
        group('Preferences', [
          tile(entries.first),
          ...entries.skip(5).map(tile),
        ], index: 2),
        group('Account access', [
          TextButton.icon(
            onPressed: () => context.push('/account/delete'),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Delete account'),
          ),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).signOut();
              if (context.mounted) context.go('/home');
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ], index: 3),
      ],
    );
  }
}

class _ProviderProfile extends ConsumerStatefulWidget {
  const _ProviderProfile();

  @override
  ConsumerState<_ProviderProfile> createState() => _ProviderProfileState();
}

class _ProviderProfileState extends ConsumerState<_ProviderProfile> {
  static const _endpoint = '/providers/me';
  static const _tabs = [
    ('business', 'About', Icons.person_outline),
    ('analytics', 'Insights', Icons.insights_outlined),
    ('listings', 'Listings', Icons.inventory_2_outlined),
    ('categories', 'Shop categories', Icons.category_outlined),
    ('ads', 'Promotions', Icons.campaign_outlined),
    ('orders', 'Orders', Icons.local_shipping_outlined),
    ('bookings', 'Bookings', Icons.calendar_month_outlined),
    ('documents', 'Documents', Icons.description_outlined),
    ('wallet', 'Wallet', Icons.account_balance_wallet_outlined),
    ('gallery', 'Gallery', Icons.photo_library_outlined),
  ];
  String _selected = 'business';
  bool _savingPhoto = false;

  Future<void> _savePhoto(String field, String url) async {
    if (_savingPhoto) return;
    setState(() => _savingPhoto = true);
    try {
      final api = ref.read(apiClientProvider);
      final latest = await api.get<Map<String, dynamic>>(_endpoint);
      await api.put(
        _endpoint,
        body: {
          'media': {...?latest['media'] as Map?, field: url},
        },
      );
      if (mounted) ref.invalidate(workspaceDataProvider(_endpoint));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _savingPhoto = false);
    }
  }

  void _openAccount() => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => const Scaffold(
        appBar: CommerceAppBar(title: 'Your account'),
        body: _AccountProfile(),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final provider = ref.watch(workspaceDataProvider(_endpoint));
    return Scaffold(
      appBar: CommerceAppBar(
        title: 'Business profile',
        actions: [
          IconButton(
            tooltip: 'Customer inquiries',
            icon: const Icon(Icons.chat_bubble_outline),
            onPressed: () => context.push('/profile/inquiries'),
          ),
          IconButton(
            tooltip: 'Account and settings',
            icon: const Icon(Icons.manage_accounts_outlined),
            onPressed: _openAccount,
          ),
        ],
      ),
      body: AsyncValueView(
        value: provider,
        onRetry: () => ref.invalidate(workspaceDataProvider(_endpoint)),
        data: (context, data) => NestedScrollView(
          headerSliverBuilder: (context, _) => [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                child: DesignEntrance(
                  child: _identity(Map<String, dynamic>.from(data as Map)),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
                child: PageBand(
                  color: Theme.of(context).colorScheme.surface,
                  elevation: 3,
                  borderRadius: BorderRadius.circular(
                    commerceRadius(commerceStyle(ref)),
                  ),
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 12),
                  children: [
                    for (final row in [_tabs.take(5), _tabs.skip(5)])
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final (section, label, icon) in row)
                            Expanded(child: _profileTab(section, label, icon)),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ],
          body: WorkspaceScreen(
            key: ValueKey(_selected),
            section: _selected,
            embedded: true,
          ),
        ),
      ),
    );
  }

  Widget _profileTab(String section, String label, IconData icon) {
    final colors = Theme.of(context).colorScheme;
    final selected = _selected == section;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => setState(() => _selected = section),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 6),
          child: Column(
            children: [
              AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 160),
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: selected
                      ? colors.primary
                      : colors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: selected ? colors.onPrimary : colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selected ? colors.primary : colors.onSurface,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  height: 1.15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _identity(Map<String, dynamic> provider) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final media = provider['media'] as Map?;
    final name = '${provider['businessName'] ?? 'Your business'}';
    final cover = media?['coverUrl'] as String?;
    final avatar = media?['avatarUrl'] as String?;
    Widget editPhoto(
      String field,
      String label,
      String folder, {
      bool iconOnly = false,
    }) => MediaUploadButton(
      folder: folder,
      video: false,
      label: label,
      iconOnly: iconOnly,
      onUploaded: (url) => _savePhoto(field, url),
    );
    return Material(
      elevation: 5,
      clipBehavior: Clip.antiAlias,
      borderRadius: BorderRadius.circular(commerceRadius(commerceStyle(ref))),
      child: Stack(
        children: [
          Positioned.fill(
            child: cover?.isNotEmpty == true
                ? CommerceImage(cover)
                : ColoredBox(
                    color: Color.lerp(
                      const Color(0xFF0B2046),
                      colors.primary,
                      .3,
                    )!,
                  ),
          ),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xD8040B1A)],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: _savingPhoto
                      ? const LinearProgressIndicator()
                      : Material(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(22),
                          child: editPhoto(
                            'coverUrl',
                            'Change cover',
                            'provider-cover',
                          ),
                        ),
                ),
                const SizedBox(height: 64),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    SizedBox.square(
                      dimension: 84,
                      child: Stack(
                        children: [
                          DecoratedBox(
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(3),
                              child: SizedBox.square(
                                dimension: 76,
                                child: ClipOval(
                                  child: avatar?.isNotEmpty == true
                                      ? CommerceImage(avatar)
                                      : ColoredBox(
                                          color: const Color(0xFF0B2046),
                                          child: Center(
                                            child: Text(
                                              name.trim().isEmpty
                                                  ? 'G'
                                                  : name
                                                        .trim()
                                                        .characters
                                                        .first
                                                        .toUpperCase(),
                                              style: const TextStyle(
                                                color: Color(0xFFFACC15),
                                                fontSize: 30,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ),
                          if (!_savingPhoto)
                            PositionedDirectional(
                              bottom: 0,
                              end: 0,
                              child: editPhoto(
                                'avatarUrl',
                                'Change profile photo',
                                'provider-avatar',
                                iconOnly: true,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (provider['id'] case final String id)
                            TextButton(
                              style: TextButton.styleFrom(
                                foregroundColor: const Color(0xFFFACC15),
                                padding: EdgeInsets.zero,
                              ),
                              onPressed: () => context.push('/provider/$id'),
                              child: const Text(
                                'View public profile',
                                textAlign: TextAlign.start,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
