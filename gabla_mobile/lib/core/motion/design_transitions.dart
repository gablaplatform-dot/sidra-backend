import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:visibility_detector/visibility_detector.dart';
import '../../features/settings/application/theme_controller.dart';
import '../theme/app_theme_style.dart';

class DesignTransitions extends PageTransitionsBuilder {
  const DesignTransitions(this.style);
  final AppThemeStyle style;
  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    final eased = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    if (style == AppThemeStyle.gabla) {
      return const CupertinoPageTransitionsBuilder().buildTransitions(
        route,
        context,
        animation,
        secondaryAnimation,
        child,
      );
    }
    return FadeTransition(
      opacity: eased,
      child: switch (style) {
        AppThemeStyle.editorial => SlideTransition(
          position: Tween(
            begin: const Offset(0, .08),
            end: Offset.zero,
          ).animate(eased),
          child: child,
        ),
        AppThemeStyle.discover => SlideTransition(
          position: Tween(
            begin: const Offset(.12, 0),
            end: Offset.zero,
          ).animate(eased),
          child: child,
        ),
        AppThemeStyle.cinematic => ScaleTransition(
          scale: Tween(begin: 1.04, end: 1.0).animate(eased),
          child: child,
        ),
        AppThemeStyle.orbit => ScaleTransition(
          scale: Tween(begin: .86, end: 1.0).animate(eased),
          child: child,
        ),
        _ => child,
      },
    );
  }
}

/// Observe viewport exposure, rather than widget creation: cached/offscreen
/// children wait until scrolled into view and replay after leaving completely.
class DesignEntrance extends ConsumerStatefulWidget {
  const DesignEntrance({super.key, required this.child, this.index = 0});
  final Widget child;
  final int index;
  @override
  ConsumerState<DesignEntrance> createState() => _DesignEntranceState();
}

class _DesignEntranceState extends ConsumerState<DesignEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 650),
  );
  late final CurvedAnimation _progress = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );
  bool _inside = false;
  @override
  void initState() {
    super.initState();
    // Initialize while the element is active, including reduced-motion builds.
    _controller.value = 0;
  }

  void _visibility(VisibilityInfo info) {
    if (!mounted || MediaQuery.disableAnimationsOf(context)) return;
    if (info.visibleFraction > .08 && !_inside) {
      _inside = true;
      _controller.forward();
    } else if (info.visibleFraction == 0 && _inside) {
      _inside = false;
      _controller.reset();
    }
  }

  @override
  void dispose() {
    _progress.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    return VisibilityDetector(
      key: ObjectKey(this),
      onVisibilityChanged: _visibility,
      child: AnimatedBuilder(
        animation: _progress,
        child: widget.child,
        builder: (context, child) {
          final t = _progress.value;
          final distance = 1 - t;
          final offset = switch (style) {
            AppThemeStyle.gabla => Offset(0, 32 * distance),
            AppThemeStyle.editorial => Offset(
              (widget.index.isEven ? -36 : 36) * distance,
              20 * distance,
            ),
            AppThemeStyle.discover => Offset(0, 48 * distance),
            AppThemeStyle.cinematic => Offset(0, 18 * distance),
            AppThemeStyle.orbit => Offset(0, 24 * distance),
          };
          final scale = switch (style) {
            AppThemeStyle.discover => .93 + .07 * t,
            AppThemeStyle.cinematic => 1.045 - .045 * t,
            AppThemeStyle.orbit => .82 + .18 * t,
            _ => 1.0,
          };
          return ExcludeSemantics(
            excluding: t == 0,
            child: IgnorePointer(
              ignoring: t < .2,
              child: Opacity(
                opacity: t,
                child: Transform.translate(
                  offset: offset,
                  child: Transform.scale(scale: scale, child: child),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
