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
    Widget heading({bool light = false, double size = 38}) => Padding(
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            bus ? 'GABLA / INTERCITY' : 'GABLA / GET RIDE',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2.4,
              fontWeight: FontWeight.w700,
              color: light ? Colors.white70 : c.primary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: type.display(
              size: size,
              color: light ? Colors.white : c.onSurface,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            style: TextStyle(
              height: 1.5,
              fontSize: 13,
              color: light ? Colors.white70 : c.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
    Widget visual({double height = 230, bool round = false}) => SizedBox(
      height: height,
      child:
          scene ??
          ClipRRect(
            borderRadius: BorderRadius.circular(round ? 150 : 0),
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobilityArtwork(bus: bus),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Color(0x55000000)],
                    ),
                  ),
                ),
                Positioned(
                  left: 18,
                  bottom: 18,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Text(
                      bus
                          ? 'A little further. A new story.'
                          : 'Your city, at your pace.',
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                    ),
                  ),
                ),
              ],
            ),
          ),
    );
    Widget panel({double radius = 28}) =>
        MobilityPanel(radius: radius, child: child);
    Widget inset(Widget w) =>
        Padding(padding: const EdgeInsets.symmetric(horizontal: 18), child: w);
    final body = switch (style) {
      AppThemeStyle.gabla => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          visual(height: 265),
          Transform.translate(
            offset: const Offset(0, -24),
            child: inset(
              Column(
                children: [
                  MobilityPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: type.display(size: 30)),
                        const SizedBox(height: 8),
                        Text(
                          subtitle,
                          style: TextStyle(
                            color: c.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 22),
                        child,
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      AppThemeStyle.editorial => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading(size: 44),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Row(
              children: [
                Expanded(child: Divider(color: c.outlineVariant)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Icon(
                    bus ? Icons.route : Icons.near_me_outlined,
                    color: c.primary,
                  ),
                ),
                Expanded(child: Divider(color: c.outlineVariant)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          inset(visual(height: 170)),
          const SizedBox(height: 24),
          inset(panel(radius: 6)),
        ],
      ),
      AppThemeStyle.discover => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            children: [
              visual(height: 340),
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: .85),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              IgnorePointer(child: heading(light: true, size: 42)),
            ],
          ),
          Transform.translate(
            offset: const Offset(0, -34),
            child: inset(panel(radius: 32)),
          ),
        ],
      ),
      AppThemeStyle.cinematic => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading(size: 40),
          inset(
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: visual(height: 250),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
            child: Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: c.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    bus ? 'YOUR NEXT DEPARTURE' : 'YOUR JOURNEY CONSOLE',
                    style: const TextStyle(fontSize: 10, letterSpacing: 2),
                  ),
                ),
                Icon(Icons.arrow_downward, size: 16, color: c.primary),
              ],
            ),
          ),
          inset(panel(radius: 12)),
        ],
      ),
      AppThemeStyle.orbit => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading(size: 36),
          SizedBox(
            height: 250,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: OrbitRings(c.primary)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 40,
                    vertical: 14,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(150),
                    child: visual(height: 220, round: true),
                  ),
                ),
                Positioned(
                  right: 18,
                  bottom: 12,
                  child: CircleAvatar(
                    radius: 27,
                    backgroundColor: c.secondaryContainer,
                    child: Icon(
                      bus
                          ? Icons.confirmation_number_outlined
                          : Icons.north_east,
                      color: c.onSecondaryContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          inset(panel(radius: 36)),
        ],
      ),
    };
    return Scaffold(
      appBar: AppBar(
        title: Text(bus ? 'Gabla Bus' : 'Get Ride'),
        actions: [
          ...actions,
          IconButton(
            tooltip: 'Design Studio',
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
  const MobilityPanel({super.key, required this.child, this.radius = 26});
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
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: c.outlineVariant.withValues(alpha: .5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .06),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
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
    final image = Image.asset(
      'assets/artwork/${bus ? 'bus' : 'ride'}.jpg',
      fit: BoxFit.cover,
    );
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
