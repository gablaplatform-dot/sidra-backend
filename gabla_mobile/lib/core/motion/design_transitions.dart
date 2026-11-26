import 'package:flutter/material.dart';
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

/// Content now appears instantly - kept as a passthrough so the many call
/// sites across the app don't each need to be unwrapped.
class DesignEntrance extends StatelessWidget {
  const DesignEntrance({super.key, required this.child, this.index = 0});
  final Widget child;
  final int index;
  @override
  Widget build(BuildContext context) => child;
}
