import '../theme/style_tokens.dart';
import '../widgets/feature_visual.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../motion/design_transitions.dart';
import '../theme/app_theme_style.dart';
import '../theme/font_group.dart';
import '../../features/settings/application/theme_controller.dart';

/// Five compositions share actions and data, while retaining independent
/// hierarchy, image treatment, surface geometry and motion.
class MobilityLayout extends ConsumerWidget {
  const MobilityLayout({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.bus = false,
    this.scene,
    this.footer,
    this.actions = const [],
    this.stageKey = 'start',
  });
  final String title, subtitle, stageKey;
  final Widget child;
  final bool bus;
  final Widget? scene, footer;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    final c = Theme.of(context).colorScheme;
    final type = AppTypography.of(context);
    final radius = switch (style) {
      AppThemeStyle.editorial => 0.0,
      AppThemeStyle.orbit => 4.0,
      AppThemeStyle.cinematic => 6.0,
      AppThemeStyle.gabla => 8.0,
      AppThemeStyle.discover => 12.0,
    };
    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.replaceAll('\n', ' '),
          style: type.display(size: style == AppThemeStyle.editorial ? 29 : 26),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: TextStyle(
              height: 1.5,
              fontSize: 14,
              color: c.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
    final visual = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: scene is SizedBox ? 112 : 200,
        child: scene ?? MobilityArtwork(bus: bus),
      ),
    );
    final panel = MobilityPanel(radius: radius, child: child);
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
      child: switch (style) {
        AppThemeStyle.gabla => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            heading,
            const SizedBox(height: 20),
            panel,
            const SizedBox(height: 16),
            visual,
          ],
        ),
        AppThemeStyle.editorial => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            heading,
            const Divider(height: 26),
            child,
            const Divider(height: 26),
            visual,
          ],
        ),
        AppThemeStyle.discover => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            visual,
            const SizedBox(height: 18),
            heading,
            const SizedBox(height: 18),
            panel,
          ],
        ),
        AppThemeStyle.cinematic => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.only(left: 14),
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: c.primary, width: 2)),
              ),
              child: heading,
            ),
            const SizedBox(height: 20),
            panel,
            const SizedBox(height: 18),
            visual,
          ],
        ),
        AppThemeStyle.orbit => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  bus
                      ? Icons.directions_bus_outlined
                      : Icons.local_taxi_outlined,
                  size: 30,
                  color: c.primary,
                ),
                const SizedBox(width: 14),
                Expanded(child: heading),
              ],
            ),
            const Divider(height: 28),
            child,
            const SizedBox(height: 18),
            visual,
          ],
        ),
      },
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(bus ? 'Bus tickets' : 'Get a ride'),
        actions: [
          ...actions,
          IconButton(
            tooltip: 'Design studio',
            onPressed: () => context.push('/settings/appearance'),
            icon: const Icon(Icons.tune_rounded),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          key: PageStorageKey('mobility-${bus ? 'bus' : 'ride'}-${style.name}'),
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MobilityStageSwitcher(
                style: style,
                stageKey: stageKey,
                child: body,
              ),
              if (footer != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
                  child: footer!,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class MobilityStageSwitcher extends StatelessWidget {
  const MobilityStageSwitcher({
    super.key,
    required this.style,
    required this.stageKey,
    required this.child,
  });
  final AppThemeStyle style;
  final String stageKey;
  final Widget child;
  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Duration(
      milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 460,
    ),
    switchInCurve: Curves.easeOutCubic,
    switchOutCurve: Curves.easeInCubic,
    layoutBuilder: (current, previous) => current ?? const SizedBox.shrink(),
    transitionBuilder: (child, animation) => FadeTransition(
      opacity: animation,
      child: style == AppThemeStyle.orbit
          ? ScaleTransition(
              scale: Tween(begin: .92, end: 1.0).animate(animation),
              child: child,
            )
          : SlideTransition(
              position: Tween(
                begin: Offset(
                  style == AppThemeStyle.editorial ? .06 : 0,
                  style == AppThemeStyle.cinematic ? .025 : .055,
                ),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
    ),
    child: TweenAnimationBuilder<double>(
      key: ValueKey('$stageKey-${style.name}'),
      tween: Tween(begin: 0, end: 1),
      duration: Duration(
        milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 650,
      ),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(
            0,
            (1 - value) * (style == AppThemeStyle.discover ? 40 : 22),
          ),
          child: Transform.scale(
            scale: style == AppThemeStyle.orbit ? .94 + .06 * value : 1,
            child: child,
          ),
        ),
      ),
    ),
  );
}

class MobilityPanel extends StatelessWidget {
  const MobilityPanel({super.key, required this.child, this.radius = 8});
  final Widget child;
  final double radius;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(
          Theme.of(context).extension<StyleTokens>()?.cardRadius ?? radius,
        ),
        border: Border.all(color: c.outlineVariant.withValues(alpha: .5)),
      ),
      child: child,
    );
  }
}

class JourneyField extends StatelessWidget {
  const JourneyField({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    this.trailing,
  });
  final String label, value;
  final IconData icon;
  final VoidCallback onTap;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Material(
      color: c.surfaceContainerHighest.withValues(alpha: .5),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 21, color: c.primary),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label.toUpperCase(),
                      style: TextStyle(
                        fontSize: 9,
                        letterSpacing: 1.5,
                        color: c.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      value,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              trailing ?? const Icon(Icons.chevron_right, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class MobilitySection extends StatelessWidget {
  const MobilitySection({
    super.key,
    required this.title,
    required this.child,
    this.index = 0,
  });
  final String title;
  final Widget child;
  final int index;
  @override
  Widget build(BuildContext context) => DesignEntrance(
    index: index,
    child: Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          child,
        ],
      ),
    ),
  );
}

class OrbitRings extends CustomPainter {
  OrbitRings(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = color.withValues(alpha: .24);
    canvas.drawOval(
      Rect.fromCenter(
        center: size.center(Offset.zero),
        width: size.width - 12,
        height: 230,
      ),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: size.center(Offset.zero),
        width: size.width - 34,
        height: 246,
      ),
      paint,
    );
    canvas.drawCircle(Offset(size.width * .16, 35), 5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(OrbitRings oldDelegate) => color != oldDelegate.color;
}

/// Artwork moves slightly slower than the surrounding scroll. Location maps
/// remain native and interactive; this effect applies only to illustration.
class MobilityArtwork extends StatelessWidget {
  const MobilityArtwork({super.key, required this.bus});
  final bool bus;
  @override
  Widget build(BuildContext context) {
    final position = Scrollable.maybeOf(context)?.position;
    final image = FeatureVisual(kind: bus ? 'bus' : 'ride');
    if (position == null || MediaQuery.disableAnimationsOf(context))
      return image;
    return AnimatedBuilder(
      animation: position,
      child: image,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, (position.pixels * .12).clamp(0, 30)),
        child: Transform.scale(scale: 1.16, child: child),
      ),
    );
  }
}

class MobilityActivityIcon extends StatefulWidget {
  const MobilityActivityIcon({
    super.key,
    required this.icon,
    this.active = true,
  });
  final IconData icon;
  final bool active;
  @override
  State<MobilityActivityIcon> createState() => _MobilityActivityIconState();
}

class _MobilityActivityIconState extends State<MobilityActivityIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _update();
  }

  @override
  void didUpdateWidget(covariant MobilityActivityIcon old) {
    super.didUpdateWidget(old);
    _update();
  }

  void _update() {
    if (widget.active && !MediaQuery.disableAnimationsOf(context)) {
      _pulse.repeat();
    } else {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Center(
    child: SizedBox(
      width: 84,
      height: 84,
      child: AnimatedBuilder(
        animation: _pulse,
        builder: (context, _) {
          final c = Theme.of(context).colorScheme.primary;
          return Stack(
            alignment: Alignment.center,
            children: [
              if (widget.active)
                Transform.scale(
                  scale: .7 + .3 * _pulse.value,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: c.withValues(alpha: .4 * (1 - _pulse.value)),
                        width: 2,
                      ),
                    ),
                  ),
                ),
              CircleAvatar(
                radius: 31,
                backgroundColor: c.withValues(alpha: .09),
                child: Icon(widget.icon, size: 34, color: c),
              ),
            ],
          );
        },
      ),
    ),
  );
}
