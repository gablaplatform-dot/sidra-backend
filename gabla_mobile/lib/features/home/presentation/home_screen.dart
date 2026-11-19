import '../../nearby/presentation/nearby_entry.dart';
import '../../../core/motion/design_transitions.dart';
import 'design_launcher.dart';
import '../../settings/application/theme_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/widgets/page_band.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../provider/application/provider_providers.dart';
import '../../provider/domain/provider_summary.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final design = ref.watch(themeControllerProvider).style;
    final signedIn = ref.watch(isSignedInProvider);
    final session = ref.watch(sessionControllerProvider).valueOrNull;
    final providers = ref.watch(topRatedProvidersProvider);

    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final canvas = theme.scaffoldBackgroundColor;
    final header = _HomeHeader(
      signedIn: signedIn,
      initial: _initial(session?.user.name),
    );
    final search = _SearchBar(onTap: () => context.push('/nearby'));
    final nearby = NearbyEntry(style: design);
    final launcher = AnimatedSwitcher(
      duration: Duration(
        milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 450,
      ),
      child: DesignLauncher(key: ValueKey(design), style: design),
    );
    Widget raisedSection(Color color, List<Widget> children) => Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: PageBand(
        color: color,
        elevation: 2,
        borderRadius: BorderRadius.circular(
          theme.extension<StyleTokens>()?.cardRadius ?? 16,
        ),
        children: children,
      ),
    );
    final directory = raisedSection(colors.surface, [
      _SectionHeader(title: 'Top rated providers', onSeeAll: null),
      const SizedBox(height: 12),
      AsyncValueView<List<ProviderSummary>>(
        value: providers,
        onRetry: () => ref.invalidate(topRatedProvidersProvider),
        data: (context, items) => items.isEmpty
            ? const Text('No providers yet.')
            : Column(
                children: [
                  for (var i = 0; i < items.length; i++) ...[
                    DesignEntrance(
                      index: i,
                      child: _ProviderRow(provider: items[i]),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ),
      ),
    ]);
    final sections = switch (design) {
      AppThemeStyle.gabla => [
        PageBand(
          color: colors.surface,
          children: [header, const SizedBox(height: 16), search],
        ),
        PageBand(color: canvas, children: [nearby, launcher]),
        directory,
      ],
      AppThemeStyle.editorial => [
        PageBand(color: colors.surface, children: [header]),
        PageBand(color: canvas, children: [launcher]),
        PageBand(
          color: colors.surface,
          children: [search, const SizedBox(height: 12), nearby],
        ),
        directory,
      ],
      AppThemeStyle.discover => [
        PageBand(
          color: colors.surfaceContainerHigh,
          children: [header, const SizedBox(height: 16), search, launcher],
        ),
        PageBand(color: canvas, children: [nearby]),
        directory,
      ],
      AppThemeStyle.cinematic => [
        PageBand(color: canvas, children: [header, launcher]),
        PageBand(
          color: colors.surfaceContainerHigh,
          children: [search, const SizedBox(height: 12), nearby],
        ),
        directory,
      ],
      AppThemeStyle.orbit => [
        PageBand(
          color: colors.surfaceContainerLow,
          children: [header, const SizedBox(height: 16), nearby],
        ),
        PageBand(color: canvas, children: [launcher]),
        PageBand(color: colors.surfaceContainerHigh, children: [search]),
        directory,
      ],
    };

    return Scaffold(
      bottomNavigationBar: _HomeDock(signedIn: signedIn),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(topRatedProvidersProvider);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: sections,
          ),
        ),
      ),
    );
  }

  String _initial(String? name) =>
      (name != null && name.isNotEmpty) ? name[0].toUpperCase() : 'G';
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.signedIn, required this.initial});

  final bool signedIn;
  final String initial;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            borderRadius: BorderRadius.circular(11),
          ),
          alignment: Alignment.center,
          child: Text(
            'G',
            style: TextStyle(
              color: theme.colorScheme.onPrimary,
              fontWeight: FontWeight.w900,
              fontSize: 18,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'Gabla',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const Spacer(),
        IconButton(
          tooltip: 'Design studio',
          icon: const Icon(Icons.palette_outlined),
          onPressed: () => context.push('/settings/appearance'),
        ),
        _IconBubble(
          icon: Icons.notifications_none_rounded,
          onTap: () =>
              context.push(signedIn ? '/orders' : '/login?next=%2Forders'),
        ),
        const SizedBox(width: 8),
        _IconBubble(
          icon: signedIn ? Icons.person_outline : Icons.login,
          onTap: () => context.push(signedIn ? '/profile' : '/login'),
          filled: signedIn,
          label: signedIn ? initial : null,
        ),
      ],
    );
  }
}

class _IconBubble extends StatelessWidget {
  const _IconBubble({
    required this.icon,
    required this.onTap,
    this.filled = false,
    this.label,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: filled
          ? theme.colorScheme.primary
          : theme.cardTheme.color ?? theme.colorScheme.surface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 42,
          height: 42,
          child: Center(
            child: label != null
                ? Text(
                    label!,
                    style: TextStyle(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : Icon(
                    icon,
                    size: 20,
                    color: filled ? theme.colorScheme.onPrimary : null,
                  ),
          ),
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = theme.extension<StyleTokens>();
    return Material(
      color: theme.inputDecorationTheme.fillColor ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(tokens?.pillRadius ?? 999),
      child: InkWell(
        borderRadius: BorderRadius.circular(tokens?.pillRadius ?? 999),
        onTap: onTap,
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(tokens?.pillRadius ?? 999),
            border: Border.all(
              color: theme.dividerColor.withValues(alpha: 0.4),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.search, color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'What would you like to find nearby?',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_forward,
                  size: 18,
                  color: theme.colorScheme.onPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.onSeeAll});

  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<StyleTokens>();
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style:
              tokens?.sectionTitleStyle ??
              Theme.of(context).textTheme.titleMedium,
        ),
        if (onSeeAll != null)
          TextButton(
            onPressed: onSeeAll,
            child: Text(
              'See all',
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ),
      ],
    );
  }
}

/// A photo category card: image + gradient scrim + bold white label -
/// mirrors the `TallCard` convention from the real site, used regardless of
/// the selected app style since it's about the photography, not the chrome.
class _ProviderRow extends StatelessWidget {
  const _ProviderRow({required this.provider});

  final ProviderSummary provider;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = theme.extension<StyleTokens>();
    final radius = tokens?.cardRadius ?? 16;
    final bordered = tokens?.cardStyle != CardVisualStyle.floating;
    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(radius),
        onTap: () => context.push('/provider/${provider.id}'),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            border: bordered
                ? Border.all(color: theme.dividerColor.withValues(alpha: 0.4))
                : null,
            boxShadow: bordered
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: theme.colorScheme.primary.withValues(
                  alpha: 0.12,
                ),
                backgroundImage: provider.logoUrl != null
                    ? NetworkImage(provider.logoUrl!)
                    : null,
                child: provider.logoUrl == null
                    ? Icon(
                        Icons.store_outlined,
                        color: theme.colorScheme.primary,
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.businessName,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (provider.district != null)
                      Text(
                        provider.district!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeDock extends StatelessWidget {
  const _HomeDock({required this.signedIn});
  final bool signedIn;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final active =
        ThemeData.estimateBrightnessForColor(colors.onSurface) ==
            ThemeData.estimateBrightnessForColor(colors.secondary)
        ? colors.surface
        : colors.secondary;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 10),
        child: Container(
          decoration: BoxDecoration(
            color: colors.onSurface,
            borderRadius: BorderRadius.circular(99),
            boxShadow: [
              BoxShadow(
                color: colors.onSurface.withValues(alpha: .12),
                blurRadius: 24,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (final item in [
                (Icons.home_rounded, 'Home', '/home'),
                (Icons.search_rounded, 'Explore', '/search'),
                (Icons.shopping_bag_outlined, 'Cart', '/cart'),
                (
                  Icons.person_outline_rounded,
                  'Account',
                  signedIn ? '/profile' : '/login',
                ),
              ])
                Expanded(
                  child: Semantics(
                    selected: item.$3 == '/home',
                    button: true,
                    label: item.$2,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(99),
                      onTap: () {
                        if (item.$3 != '/home') context.push(item.$3);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 9),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              item.$1,
                              color: item.$3 == '/home'
                                  ? active
                                  : colors.surface,
                              size: 22,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.$2,
                              style: TextStyle(
                                color: item.$3 == '/home'
                                    ? active
                                    : colors.surface,
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
