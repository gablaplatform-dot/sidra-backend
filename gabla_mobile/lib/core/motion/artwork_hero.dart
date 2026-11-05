import 'package:flutter/material.dart';

/// Image-only shared-element flights keep text and controls out of the shuttle.
class ArtworkHero extends StatelessWidget {
  const ArtworkHero({super.key, required this.tag, required this.child});
  final Object tag;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return Hero(
      tag: tag,
      createRectTween: (begin, end) =>
          MaterialRectCenterArcTween(begin: begin, end: end),
      flightShuttleBuilder: (context, animation, direction, from, to) =>
          AnimatedBuilder(
            animation: animation,
            builder: (context, _) => ClipRRect(
              borderRadius: BorderRadius.circular(24 * (1 - animation.value)),
              child: Material(
                color: Colors.transparent,
                child: (to.widget as Hero).child,
              ),
            ),
          ),
      child: child,
    );
  }
}
