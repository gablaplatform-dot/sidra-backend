import '../../nearby/presentation/nearby_entry.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../../../core/motion/design_transitions.dart';
import 'design_launcher.dart';
import '../../settings/application/theme_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/style_tokens.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../categories/application/category_providers.dart';
import '../../categories/domain/category.dart';
import '../../provider/application/provider_providers.dart';
import '../../provider/domain/provider_summary.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final design = ref.watch(themeControllerProvider).style;
    final signedIn = ref.watch(isSignedInProvider);
    final session = ref.watch(sessionControllerProvider).valueOrNull;
    final categories = ref.watch(directoryCategoriesProvider);
    final providers = ref.watch(topRatedProvidersProvider);

    return Scaffold(
      bottomNavigationBar: _HomeDock(signedIn: signedIn),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(directoryCategoriesProvider);
            ref.invalidate(topRatedProvidersProvider);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _HomeHeader(
                signedIn: signedIn,
                initial: _initial(session?.user.name),
              ),
              const SizedBox(height: 20),
              _SearchBar(onTap: () => context.push('/nearby')),
              const SizedBox(height: 14),
              NearbyEntry(style: design),
              AnimatedSwitcher(
                duration: Duration(
                  milliseconds: MediaQuery.disableAnimationsOf(context)
                      ? 0
                      : 450,
                ),
                child: DesignLauncher(key: ValueKey(design), style: design),
              ),
              const SizedBox(height: 28),
              _SectionHeader(
                title: 'Categories',
                onSeeAll: () => context.push('/shop/categories'),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 184,
                child: AsyncValueView<List<Category>>(
                  value: categories,
                  onRetry: () => ref.invalidate(directoryCategoriesProvider),
                  data: (context, items) => items.isEmpty
                      ? const Center(child: Text('No categories yet.'))
                      : ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: items.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          itemBuilder: (context, i) => DesignEntrance(
                            index: i,
                            child: _CategoryTile(category: items[i]),
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 28),
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
            ],
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
class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category});

  final Category category;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<StyleTokens>();
    final radius = tokens?.cardRadius ?? 20;
    return GestureDetector(
      onTap: () => context.push('/category/${category.id}'),
      child: Container(
        width: 136,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          color: Colors.grey.shade800,
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            CategoryCover(category: category),
            Container(
              padding: const EdgeInsets.all(14),
              alignment: Alignment.bottomLeft,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(radius),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0),
                    Colors.black.withValues(alpha: 0.65),
                  ],
                ),
              ),
              child: Text(
                category.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

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
                                  ? colors.secondary
                                  : colors.surface,
                              size: 22,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.$2,
                              style: TextStyle(
                                color: item.$3 == '/home'
                                    ? colors.secondary
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
