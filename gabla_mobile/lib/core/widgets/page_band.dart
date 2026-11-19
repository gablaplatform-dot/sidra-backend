import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/settings/application/theme_controller.dart';
import '../theme/background_grain.dart';

/// A full-width surface for a distinct part of a scrollable page.
class PageBand extends ConsumerWidget {
  const PageBand({
    super.key,
    required this.color,
    required this.children,
    this.elevation = 0,
    this.borderRadius = BorderRadius.zero,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
  });

  final Color color;
  final double elevation;
  final BorderRadius borderRadius;
  final EdgeInsetsGeometry padding;
  final List<Widget> children;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final grainEnabled = ref.watch(
      themeControllerProvider.select(
        (preferences) => preferences.backgroundGrainEnabled,
      ),
    );
    final content = Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
    return Material(
      color: color,
      elevation: elevation,
      borderRadius: borderRadius,
      clipBehavior: borderRadius == BorderRadius.zero
          ? Clip.none
          : Clip.antiAlias,
      child: grainEnabled && color.a > 0
          ? Ink(decoration: backgroundGrain, child: content)
          : content,
    );
  }
}
