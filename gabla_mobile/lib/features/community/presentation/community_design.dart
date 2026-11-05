import 'package:flutter/material.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';

// Reference-to-layout mapping is recorded in docs/COMMUNITY_POLISH_REFERENCES.md.
// Explicit local shapes keep the app-wide Orbit capsule style out of forms.
double communityRadius(AppThemeStyle style) => switch (style) {
  AppThemeStyle.editorial => 0,
  AppThemeStyle.orbit => 4,
  AppThemeStyle.cinematic => 6,
  AppThemeStyle.gabla => 8,
  AppThemeStyle.discover => 10,
};
ThemeData communityTheme(ThemeData base, AppThemeStyle style) {
  final c = base.colorScheme, r = communityRadius(style);
  final line = OutlineInputBorder(
    borderRadius: BorderRadius.circular(r),
    borderSide: BorderSide(color: c.outlineVariant),
  );
  final editorial = style == AppThemeStyle.editorial;
  return base.copyWith(
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: !editorial,
      fillColor: style == AppThemeStyle.cinematic
          ? c.surfaceContainerHigh
          : c.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
      border: editorial
          ? UnderlineInputBorder(
              borderSide: BorderSide(color: c.outlineVariant),
            )
          : line,
      enabledBorder: editorial
          ? UnderlineInputBorder(
              borderSide: BorderSide(color: c.outlineVariant),
            )
          : line,
      focusedBorder: editorial
          ? UnderlineInputBorder(
              borderSide: BorderSide(color: c.primary, width: 1.5),
            )
          : line.copyWith(borderSide: BorderSide(color: c.primary, width: 1.5)),
      errorBorder: line.copyWith(borderSide: BorderSide(color: c.error)),
      focusedErrorBorder: line.copyWith(
        borderSide: BorderSide(color: c.error, width: 1.5),
      ),
      hintStyle: base.textTheme.bodyMedium?.copyWith(color: c.onSurfaceVariant),
      errorMaxLines: 3,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
        textStyle: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
        side: BorderSide(color: c.outlineVariant),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
      showCheckmark: false,
      side: BorderSide(color: c.outlineVariant),
      labelStyle: base.textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w600,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
    ),
    dropdownMenuTheme: DropdownMenuThemeData(
      textStyle: base.textTheme.bodyMedium,
    ),
  );
}

class CommunityDesignScope extends StatelessWidget {
  const CommunityDesignScope({
    super.key,
    required this.style,
    required this.child,
  });
  final AppThemeStyle style;
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      Theme(data: communityTheme(Theme.of(context), style), child: child);
}

/// Shared content hierarchy; each selected design uses its own composition.
class CommunityPageHeading extends StatelessWidget {
  const CommunityPageHeading({
    super.key,
    required this.style,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.icon = Icons.work_outline,
  });
  final AppThemeStyle style;
  final String eyebrow, title, description;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final inverse = style == AppThemeStyle.gabla;
    final ink = inverse ? c.onPrimaryContainer : c.onSurface;
    final muted = inverse ? c.onPrimaryContainer : c.onSurfaceVariant;
    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: TextStyle(
            color: inverse ? ink : c.primary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: .4,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          title,
          style: AppTypography.of(context).display(
            size: style == AppThemeStyle.editorial ? 34 : 28,
            color: ink,
          ),
        ),
        const SizedBox(height: 10),
        Text(description, style: TextStyle(color: muted, height: 1.5)),
      ],
    );
    return switch (style) {
      AppThemeStyle.gabla => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: c.primaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: heading,
      ),
      AppThemeStyle.editorial => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [heading, const Divider(height: 32)],
      ),
      AppThemeStyle.discover => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: c.secondaryContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: c.onSecondaryContainer, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(child: heading),
        ],
      ),
      AppThemeStyle.cinematic => Container(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
        decoration: BoxDecoration(
          color: c.surfaceContainerHigh,
          border: Border(left: BorderSide(color: c.primary, width: 3)),
        ),
        child: heading,
      ),
      AppThemeStyle.orbit => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 2, thickness: 2, color: c.primary),
          const SizedBox(height: 18),
          heading,
          const SizedBox(height: 18),
          const Divider(height: 1),
        ],
      ),
    };
  }
}

class CommunityBrowseHeader extends StatelessWidget {
  const CommunityBrowseHeader({
    super.key,
    required this.style,
    required this.event,
  });
  final AppThemeStyle style;
  final bool event;
  @override
  Widget build(BuildContext context) => KeyedSubtree(
    key: ValueKey('community-header-${style.name}'),
    child: CommunityPageHeading(
      style: style,
      eyebrow: event ? 'Events' : 'Jobs & paid tasks',
      title: event ? 'Find an event' : 'Find your next role',
      description: event
          ? 'Browse by category. Check dates, venues and entrance prices.'
          : 'Compare vacancies and paid tasks by location, workplace and pay.',
      icon: event ? Icons.event_outlined : Icons.work_outline,
    ),
  );
}

/// Context-specific recovery keeps saved posts separate from owned posts.
class CommunityEmptyState extends StatelessWidget {
  const CommunityEmptyState({
    super.key,
    required this.event,
    required this.private,
    this.scope = 'browse',
    this.filtered = false,
    this.onAction,
  });
  final bool event, private, filtered;
  final String scope;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final noun = event ? 'events' : 'jobs';
    final saved = scope == 'saved';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            saved
                ? Icons.bookmark_border
                : event
                ? Icons.event_outlined
                : Icons.work_outline,
            size: 28,
            color: c.primary,
          ),
          const SizedBox(height: 18),
          Text(
            private
                ? saved
                      ? 'No saved $noun'
                      : 'No $noun posted yet'
                : filtered
                ? 'No matching $noun'
                : 'No $noun available',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          Text(
            private
                ? saved
                      ? 'Save ${event ? 'an event' : 'a job or task'} from its details page to find it here.'
                      : 'Posts you create appear here, including posts awaiting review.'
                : filtered
                ? 'Try a different search or clear your filters.'
                : 'Pull down to check again for published $noun.',
            style: TextStyle(color: c.onSurfaceVariant, height: 1.5),
          ),
          if (onAction != null) ...[
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: onAction,
              child: Text(
                private
                    ? saved
                          ? 'Browse $noun'
                          : event
                          ? 'Create an event'
                          : 'Post a job or task'
                    : 'Clear search & filters',
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Application records inherit the selected design without global Card shapes.
class CommunityRecordSurface extends StatelessWidget {
  const CommunityRecordSurface({
    super.key,
    required this.style,
    required this.child,
  });
  final AppThemeStyle style;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.all(style == AppThemeStyle.editorial ? 0 : 18),
      decoration: BoxDecoration(
        color: style == AppThemeStyle.editorial
            ? null
            : style == AppThemeStyle.cinematic
            ? c.surfaceContainerHigh
            : c.surfaceContainerLow,
        borderRadius: BorderRadius.circular(communityRadius(style)),
        border: switch (style) {
          AppThemeStyle.editorial => Border(
            bottom: BorderSide(color: c.outlineVariant),
          ),
          AppThemeStyle.cinematic => Border(
            left: BorderSide(color: c.primary, width: 3),
          ),
          AppThemeStyle.orbit => Border.all(color: c.outlineVariant),
          _ => null,
        },
      ),
      child: Padding(
        padding: style == AppThemeStyle.editorial
            ? const EdgeInsets.symmetric(vertical: 20)
            : EdgeInsets.zero,
        child: child,
      ),
    );
  }
}

/// Honest, compact fallback for a missing upload; never substitutes stock media.
class CommunityMediaPlaceholder extends StatelessWidget {
  const CommunityMediaPlaceholder({
    super.key,
    required this.style,
    required this.event,
  });
  final AppThemeStyle style;
  final bool event;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final icon = Icon(
      event ? Icons.event_outlined : Icons.work_outline,
      color: style == AppThemeStyle.discover
          ? c.onSecondaryContainer
          : c.onPrimaryContainer,
      size: 28,
    );
    return ColoredBox(
      color: style == AppThemeStyle.discover
          ? c.secondaryContainer
          : c.primaryContainer,
      child: switch (style) {
        AppThemeStyle.editorial => Align(
          alignment: Alignment.centerLeft,
          child: Padding(padding: const EdgeInsets.all(16), child: icon),
        ),
        AppThemeStyle.cinematic => Container(
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: c.primary, width: 3)),
          ),
          alignment: Alignment.center,
          child: icon,
        ),
        AppThemeStyle.orbit => Center(
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              border: Border.all(
                color: c.onPrimaryContainer.withValues(alpha: .3),
              ),
            ),
            child: icon,
          ),
        ),
        _ => Center(child: icon),
      },
    );
  }
}

class CommunityDetailMasthead extends StatelessWidget {
  const CommunityDetailMasthead({
    super.key,
    required this.style,
    required this.post,
    this.poster,
  });
  final AppThemeStyle style;
  final Map<String, dynamic> post;
  final String? poster;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    Widget title({Color? ink, double size = 32}) => Text(
      '${post['title']}',
      style: AppTypography.of(context).display(size: size, color: ink),
    );
    Widget organization() => Text(
      '${post['organization'] ?? ''}',
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: c.primary,
      ),
    );
    Widget photo(double height) => SizedBox(
      height: poster == null ? 84 : height,
      width: double.infinity,
      child: Hero(
        tag: 'community-${post['id']}',
        child: poster == null
            ? CommunityMediaPlaceholder(
                style: style,
                event: post['kind'] == 'event',
              )
            : Image.network(
                poster!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => ColoredBox(
                  color: c.surfaceContainerHigh,
                  child: const Icon(Icons.image_outlined, size: 36),
                ),
              ),
      ),
    );
    switch (style) {
      case AppThemeStyle.gabla:
        return Column(
          key: const ValueKey('community-detail-gabla'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (poster != null || post['kind'] == 'event')
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: photo(post['kind'] == 'event' ? 240 : 150),
              ),
            const SizedBox(height: 20),
            organization(),
            const SizedBox(height: 10),
            title(),
            const SizedBox(height: 18),
          ],
        );
      case AppThemeStyle.editorial:
        return Column(
          key: const ValueKey('community-detail-editorial'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            organization(),
            const SizedBox(height: 12),
            title(size: 38),
            const Divider(height: 28),
            if (poster != null || post['kind'] == 'event')
              photo(post['kind'] == 'event' ? 250 : 140),
            const SizedBox(height: 20),
          ],
        );
      case AppThemeStyle.discover:
        return Column(
          key: const ValueKey('community-detail-discover'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (poster != null || post['kind'] == 'event')
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: photo(post['kind'] == 'event' ? 260 : 190),
              ),
            Transform.translate(
              offset: Offset(
                0,
                poster != null || post['kind'] == 'event' ? -16 : 0,
              ),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: c.surface,
                  border: Border.all(color: c.outlineVariant),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    organization(),
                    const SizedBox(height: 10),
                    title(size: 29),
                  ],
                ),
              ),
            ),
          ],
        );
      case AppThemeStyle.cinematic:
        return Column(
          key: const ValueKey('community-detail-cinematic'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (poster != null || post['kind'] == 'event')
              photo(post['kind'] == 'event' ? 280 : 180),
            Container(
              padding: const EdgeInsets.fromLTRB(18, 24, 18, 24),
              decoration: BoxDecoration(
                color: c.surfaceContainerHigh,
                border: Border(left: BorderSide(color: c.primary, width: 3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  organization(),
                  const SizedBox(height: 14),
                  title(size: 34),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        );
      case AppThemeStyle.orbit:
        return Column(
          key: const ValueKey('community-detail-orbit'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            organization(),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 86, child: photo(112)),
                const SizedBox(width: 16),
                Expanded(child: title(size: 27)),
              ],
            ),
            const SizedBox(height: 22),
            Divider(color: c.primary, thickness: 2, height: 2),
            const SizedBox(height: 20),
          ],
        );
    }
  }
}

class CommunityAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CommunityAppBar({super.key, required this.title, this.actions});
  final String title;
  final List<Widget>? actions;
  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
  @override
  Widget build(BuildContext context) =>
      AppBar(title: Text(title), actions: actions, scrolledUnderElevation: 0);
}
