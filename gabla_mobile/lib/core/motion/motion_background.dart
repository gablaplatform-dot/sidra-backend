import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/settings/application/theme_controller.dart';
import '../../features/settings/domain/background_motion.dart';

/// A background behind route content, never an overlay on text or artwork.
class AppMotionSurface extends ConsumerWidget {
  const AppMotionSurface({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(themeControllerProvider);
    final theme = Theme.of(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: MotionCanvas(
            mode: preferences.motion,
            colors: preferences.colors,
            background: theme.scaffoldBackgroundColor,
            intensity: preferences.motionIntensity,
            speed: preferences.motionSpeed,
          ),
        ),
        Theme(
          data: theme.copyWith(
            scaffoldBackgroundColor: preferences.motion == BackgroundMotion.none
                ? theme.scaffoldBackgroundColor
                : Colors.transparent,
          ),
          child: child,
        ),
      ],
    );
  }
}

class MotionCanvas extends StatefulWidget {
  const MotionCanvas({
    super.key,
    required this.mode,
    required this.colors,
    required this.background,
    this.intensity = .55,
    this.speed = 1,
  });
  final BackgroundMotion mode;
  final List<Color> colors;
  final Color background;
  final double intensity, speed;
  @override
  State<MotionCanvas> createState() => _MotionCanvasState();
}

class _MotionCanvasState extends State<MotionCanvas>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _clock;
  bool _foreground = true;
  @override
  void initState() {
    super.initState();
    _clock = AnimationController(vsync: this);
    WidgetsBinding.instance.addObserver(this);
  }

  void _sync() {
    final duration = Duration(milliseconds: (18000 / widget.speed).round());
    final shouldAnimate =
        widget.mode != BackgroundMotion.none &&
        !MediaQuery.disableAnimationsOf(context) &&
        TickerMode.of(context) &&
        _foreground;
    if (!shouldAnimate) {
      _clock.stop();
      return;
    }
    if (!_clock.isAnimating || _clock.duration != duration) {
      _clock.duration = duration;
      _clock.repeat();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant MotionCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (mounted) _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
    child: IgnorePointer(
      child: ExcludeSemantics(
        child: ColoredBox(
          color: widget.background,
          child: AnimatedBuilder(
            animation: _clock,
            builder: (context, _) => CustomPaint(
              painter: MotionBackgroundPainter(
                mode: widget.mode,
                colors: widget.colors,
                progress: _clock.value,
                intensity: widget.intensity,
              ),
              child: const SizedBox.expand(),
            ),
          ),
        ),
      ),
    ),
  );
}

class MotionBackgroundPainter extends CustomPainter {
  const MotionBackgroundPainter({
    required this.mode,
    required this.colors,
    required this.progress,
    required this.intensity,
  });
  final BackgroundMotion mode;
  final List<Color> colors;
  final double progress, intensity;
  @override
  void paint(Canvas canvas, Size size) {
    if (mode == BackgroundMotion.none) return;
    final t = progress * math.pi * 2;
    final w = size.width, h = size.height;
    if (mode == BackgroundMotion.lines) {
      for (var line = 0; line < 11; line++) {
        final path = Path();
        for (var step = 0; step <= 36; step++) {
          final x = w * step / 36;
          final y =
              h * (.08 + line * .09) +
              math.sin(step / 36 * math.pi * 2 + t + line * .3) * w * .09;
          if (step == 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }
        canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..color = colors[line % 2].withValues(alpha: .32 * intensity),
        );
      }
      return;
    }
    final count = mode == BackgroundMotion.aurora ? 4 : 6;
    for (var i = 0; i < count; i++) {
      final phase = t + i * 1.8;
      final center = Offset(
        w * (.5 + math.sin(phase) * .48),
        h * (.15 + i / count * .8 + math.cos(phase) * .08),
      );
      final radius = w * (mode == BackgroundMotion.aurora ? .95 : .46);
      final rect = Rect.fromCircle(center: center, radius: radius);
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            colors[i % 2].withValues(
              alpha: intensity * (mode == BackgroundMotion.aurora ? .3 : .38),
            ),
            colors[i % 2].withValues(alpha: 0),
          ],
        ).createShader(rect);
      if (mode == BackgroundMotion.aurora) {
        canvas.save();
        canvas.translate(center.dx, center.dy);
        canvas.rotate(.5 + math.sin(phase) * .2);
        final ribbon = Rect.fromCenter(
          center: Offset.zero,
          width: w * 2.5,
          height: w * .7,
        );
        paint.shader = RadialGradient(
          colors: [
            colors[i % 2].withValues(alpha: intensity * .38),
            colors[i % 2].withValues(alpha: 0),
          ],
        ).createShader(ribbon);
        canvas.drawOval(ribbon, paint);
        canvas.restore();
      } else {
        canvas.drawCircle(center, radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant MotionBackgroundPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.mode != mode ||
      oldDelegate.intensity != intensity ||
      oldDelegate.colors != colors;
}
