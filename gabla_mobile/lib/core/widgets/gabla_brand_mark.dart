import 'package:flutter/material.dart';

/// The "G" mark + wordmark lockup (same pairing as the home screen's own header), sized for a
/// bright/colored surface - callers pass the two colors that read well there (usually
/// `colorScheme.onPrimary` and a translucent version of it for the mark's own background).
class GablaBrandMark extends StatelessWidget {
  const GablaBrandMark({
    super.key,
    required this.foreground,
    required this.markBackground,
    this.compact = false,
  });

  final Color foreground;
  final Color markBackground;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 30.0 : 36.0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: markBackground,
            borderRadius: BorderRadius.circular(size * 0.3),
          ),
          alignment: Alignment.center,
          child: Text(
            'G',
            style: TextStyle(
              color: foreground,
              fontWeight: FontWeight.w900,
              fontSize: compact ? 15 : 18,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          'Gabla',
          style: TextStyle(
            color: foreground,
            fontWeight: FontWeight.w800,
            fontSize: compact ? 17 : 20,
          ),
        ),
      ],
    );
  }
}
