import 'package:flutter/material.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';

// Reference-to-layout mapping is recorded in docs/COMMUNITY_DESIGN_REFERENCES.md.
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

class CommunityBrowseHeader extends StatelessWidget {
  const CommunityBrowseHeader({
    super.key,
    required this.style,
    required this.event,
  });
  final AppThemeStyle style;
  final bool event;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final title = event
        ? 'Good nights.\nGreat company.'
        : 'Find work\nthat fits you.';
    final subtitle = event
        ? 'Music, culture and gatherings near you.'
        : 'Vacancies & paid tasks, in one place.';
    Widget text(String value, {Color? color, double size = 32}) => Text(
      value,
      style: AppTypography.of(context).display(size: size, color: color),
    );
    Widget location({Color? color}) => Row(
      children: [
        Icon(Icons.location_on_outlined, size: 16, color: color ?? c.primary),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            'Explore your city',
            style: TextStyle(fontSize: 12, color: color ?? c.onSurfaceVariant),
          ),
        ),
      ],
    );
    Widget artwork(double height) => ClipRRect(
      borderRadius: BorderRadius.circular(communityRadius(style)),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Image.asset(
          'assets/artwork/community-concert.png',
          fit: BoxFit.cover,
          alignment: Alignment.centerRight,
        ),
      ),
    );
    switch (style) {
      case AppThemeStyle.gabla:
        return Container(
          key: const ValueKey('community-header-gabla'),
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: c.inverseSurface,
            image: event
                ? const DecorationImage(
                    image: AssetImage('assets/artwork/community-concert.png'),
                    fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(
                      Color(0x88000000),
                      BlendMode.darken,
                    ),
                  )
                : null,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              location(color: (event ? Colors.white : c.onInverseSurface)),
              const SizedBox(height: 24),
              text(
                event ? 'Discover amazing\nevents.' : title,
                color: (event ? Colors.white : c.onInverseSurface),
              ),
              const SizedBox(height: 12),
              Text(
                subtitle,
                style: TextStyle(
                  color: (event ? Colors.white : c.onInverseSurface).withValues(
                    alpha: .75,
                  ),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Icon(
                    event ? Icons.graphic_eq : Icons.work_outline,
                    color: c.primaryContainer,
                    size: 24,
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      event
                          ? 'Find your next live moment'
                          : 'Your next opportunity starts here',
                      style: TextStyle(
                        fontSize: 12,
                        color: (event ? Colors.white : c.onInverseSurface),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      case AppThemeStyle.editorial:
        return Column(
          key: const ValueKey('community-header-editorial'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            location(),
            const SizedBox(height: 24),
            Text(
              event ? 'THE CITY / WHAT’S ON' : 'WORK / OPPORTUNITIES',
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 2,
                color: c.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            text(
              event
                  ? 'Go somewhere\nworth remembering.'
                  : 'Your next\nchapter.',
              size: 38,
            ),
            const SizedBox(height: 14),
            Text(
              subtitle,
              style: TextStyle(color: c.onSurfaceVariant, height: 1.5),
            ),
            if (event) ...[const SizedBox(height: 20), artwork(155)],
            const Divider(height: 38),
          ],
        );
      case AppThemeStyle.discover:
        return Column(
          key: const ValueKey('community-header-discover'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            location(),
            const SizedBox(height: 18),
            text(
              event
                  ? 'Make plans.\nMake memories.'
                  : 'Let’s find your\nnext job.',
              size: 34,
            ),
            const SizedBox(height: 18),
            if (event) ...[artwork(185), const SizedBox(height: 14)],
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: c.primaryContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    event ? Icons.local_activity_outlined : Icons.trending_up,
                    color: c.onPrimaryContainer,
                    size: 32,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      subtitle,
                      style: TextStyle(
                        color: c.onPrimaryContainer,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                  ),
                  Icon(Icons.north_east, color: c.onPrimaryContainer),
                ],
              ),
            ),
          ],
        );
      case AppThemeStyle.cinematic:
        return Container(
          key: const ValueKey('community-header-cinematic'),
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
          decoration: BoxDecoration(
            color: c.surfaceContainerHigh,
            image: event
                ? const DecorationImage(
                    image: AssetImage('assets/artwork/community-concert.png'),
                    fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(
                      Color(0x99000000),
                      BlendMode.darken,
                    ),
                  )
                : null,
            border: Border(left: BorderSide(color: c.primary, width: 3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                event ? 'LIVE / LOCAL / UNMISSABLE' : 'YOUR JOB MATCH',
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 2,
                  color: c.primary,
                ),
              ),
              const SizedBox(height: 24),
              text(
                event ? 'The city\nafter hours.' : 'Work on\nyour terms.',
                size: 40,
              ),
              const SizedBox(height: 18),
              Text(
                subtitle,
                style: TextStyle(color: c.onSurfaceVariant, height: 1.6),
              ),
              const SizedBox(height: 24),
              location(),
            ],
          ),
        );
      case AppThemeStyle.orbit:
        return Column(
          key: const ValueKey('community-header-orbit'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  color: c.primary,
                  child: Icon(
                    event ? Icons.bolt : Icons.work_outline,
                    color: c.onPrimary,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  event ? 'GABLA / EVENTS' : 'GABLA / JOBS',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const Spacer(),
                Icon(Icons.north_east, color: c.primary),
              ],
            ),
            const SizedBox(height: 24),
            text(
              event
                  ? 'Find your\nnext night out.'
                  : 'Your next move\nstarts here.',
              size: 34,
            ),
            const SizedBox(height: 16),
            location(),
            const SizedBox(height: 18),
            Text(
              subtitle,
              style: TextStyle(color: c.onSurfaceVariant, height: 1.5),
            ),
            const SizedBox(height: 18),
            Divider(color: c.primary, thickness: 2, height: 2),
            if (event) ...[const SizedBox(height: 16), artwork(135)],
          ],
        );
    }
  }
}

class CommunityEmptyState extends StatelessWidget {
  const CommunityEmptyState({
    super.key,
    required this.event,
    required this.private,
  });
  final bool event, private;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            event ? Icons.event_available_outlined : Icons.work_outline,
            size: 30,
            color: c.primary,
          ),
          const SizedBox(height: 14),
          Text(
            private
                ? 'Nothing here yet'
                : event
                ? 'No events found'
                : 'No matching opportunities',
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          Text(
            private
                ? 'Your posts and saved discoveries will appear here.'
                : 'Try another search or share the first ${event ? 'event' : 'opportunity'}.',
            textAlign: TextAlign.center,
            style: TextStyle(color: c.onSurfaceVariant, height: 1.5),
          ),
        ],
      ),
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
      height: height,
      width: double.infinity,
      child: Hero(
        tag: 'community-${post['id']}',
        child: poster == null
            ? ColoredBox(
                color: c.primaryContainer,
                child: Icon(
                  post['kind'] == 'event'
                      ? Icons.local_activity_outlined
                      : Icons.work_outline,
                  size: 44,
                  color: c.onPrimaryContainer,
                ),
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
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: photo(post['kind'] == 'event' ? 280 : 150),
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
            photo(post['kind'] == 'event' ? 250 : 140),
            const SizedBox(height: 20),
          ],
        );
      case AppThemeStyle.discover:
        return Column(
          key: const ValueKey('community-detail-discover'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: photo(post['kind'] == 'event' ? 340 : 190),
            ),
            Transform.translate(
              offset: const Offset(0, -24),
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
            photo(post['kind'] == 'event' ? 400 : 180),
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
