import '../../../core/theme/font_group.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/style_tokens.dart';

const nearbyHeroTag = 'gabla-nearby-entry';

/// Each design has its own entry composition. The drawing is decorative,
/// not an invented map or invented nearby results.
class NearbyEntry extends StatelessWidget {
  const NearbyEntry({super.key, required this.style});
  final AppThemeStyle style;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final radius = Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8;
    final extra = (MediaQuery.textScalerOf(context).scale(1) - 1) * 160;
    Widget caption(String text, {Color? color}) => Text(
      text,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: 9,
        letterSpacing: 1.4,
        fontWeight: FontWeight.w700,
        color: color ?? c.onPrimaryContainer,
      ),
    );
    Widget title(String text, {bool serif = false, Color? color}) => Text(
      text,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontFamily: AppTypography.of(context).heading,
        fontSize: 25,
        height: 1.08,
        fontWeight: serif ? FontWeight.w400 : FontWeight.w700,
        color: color ?? c.onPrimaryContainer,
        letterSpacing: -.7,
      ),
    );
    final content = switch (style) {
      AppThemeStyle.gabla => Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: c.primary,
              child: Icon(Icons.near_me_outlined, color: c.onPrimary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  caption('PRODUCTS & SERVICES'),
                  const SizedBox(height: 9),
                  title('Find it nearby'),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.arrow_outward, color: c.onPrimaryContainer),
          ],
        ),
      ),
      AppThemeStyle.editorial => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            caption('PRODUCTS & SERVICES'),
            const SizedBox(height: 10),
            title('Find nearby', serif: true),
            const SizedBox(height: 14),
            Container(
              height: 1,
              color: c.onPrimaryContainer.withValues(alpha: .2),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Explore the map',
                    style: TextStyle(fontSize: 11, color: c.onPrimaryContainer),
                  ),
                ),
                Icon(Icons.east, size: 20, color: c.onPrimaryContainer),
              ],
            ),
          ],
        ),
      ),
      AppThemeStyle.discover => Stack(
        children: [
          Positioned(
            right: 4,
            top: 22,
            width: 105,
            height: 125,
            child: Transform.rotate(
              angle: .12,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius),
                child: ColoredBox(
                  color: c.secondaryContainer,
                  child: Icon(
                    Icons.handyman_outlined,
                    color: c.onSecondaryContainer,
                    size: 42,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            right: 70,
            top: 32,
            width: 91,
            height: 120,
            child: Transform.rotate(
              angle: -.13,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius),
                child: ColoredBox(
                  color: c.primaryContainer,
                  child: Icon(
                    Icons.shopping_bag_outlined,
                    color: c.onPrimaryContainer,
                    size: 42,
                  ),
                ),
              ),
            ),
          ),
          Positioned.fill(
            right: 150,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 0, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  caption('NEARBY'),
                  const SizedBox(height: 10),
                  title('Products & services'),
                  const SizedBox(height: 12),
                  Icon(Icons.travel_explore, color: c.primary, size: 25),
                ],
              ),
            ),
          ),
        ],
      ),
      AppThemeStyle.cinematic => Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: c.surfaceContainerHighest),
          Positioned(
            top: 20,
            right: 22,
            child: Icon(
              Icons.travel_explore,
              color: c.primary.withValues(alpha: .35),
              size: 80,
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                caption('PRODUCTS & SERVICES', color: c.onSurfaceVariant),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: title('Find nearby', color: c.onSurface)),
                    const SizedBox(width: 8),
                    Icon(Icons.north_east, color: c.primary),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      AppThemeStyle.orbit => Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            SizedBox(
              width: 80,
              height: 80,
              child: CustomPaint(
                painter: _NearbyMotif(color: c.primary, style: style),
                child: Icon(Icons.explore_outlined, size: 32, color: c.primary),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  caption('PRODUCTS & SERVICES'),
                  const SizedBox(height: 9),
                  title('Find nearby'),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: c.onPrimaryContainer),
          ],
        ),
      ),
    };
    return Hero(
      tag: nearbyHeroTag,
      child: Material(
        color: c.primaryContainer,
        borderRadius: BorderRadius.circular(radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/nearby'),
          child: SizedBox(
            height:
                (switch (style) {
                  AppThemeStyle.gabla => 125.0,
                  AppThemeStyle.editorial => 180.0,
                  AppThemeStyle.discover => 190.0,
                  AppThemeStyle.cinematic => 180.0,
                  AppThemeStyle.orbit => 150.0,
                }) +
                extra,
            child: content,
          ),
        ),
      ),
    );
  }
}

class _NearbyMotif extends CustomPainter {
  const _NearbyMotif({required this.color, required this.style});
  final Color color;
  final AppThemeStyle style;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: .1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final center = Offset(size.width / 2, size.height / 2);
    if (style == AppThemeStyle.editorial) {
      for (var i = 0; i < 6; i++) {
        canvas.drawLine(Offset(i * 38, 0), Offset(i * 38, size.height), paint);
        canvas.drawLine(Offset(0, i * 38), Offset(size.width, i * 38), paint);
      }
    } else {
      for (var i = 1; i < 5; i++) {
        canvas.drawCircle(center, i * 24, paint);
      }
      for (var i = 0; i < 4; i++) {
        final angle = i * math.pi / 2;
        canvas.drawLine(
          center,
          center + Offset(math.cos(angle) * 95, math.sin(angle) * 95),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _NearbyMotif old) =>
      old.color != color || old.style != style;
}
