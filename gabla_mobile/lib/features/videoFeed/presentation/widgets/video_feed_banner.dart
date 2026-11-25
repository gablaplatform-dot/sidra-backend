import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The entry point into the TikTok-style provider video feed (see features/videoFeed) - shown on
/// both the Services and Shop categories screens, since the feed itself covers every provider's
/// video ads regardless of which module the shopper came from.
class VideoFeedBanner extends StatelessWidget {
  const VideoFeedBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Material(
      color: c.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/services/videos'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle),
                child: Icon(Icons.play_arrow_rounded, color: c.onPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Tap for videos',
                  style: TextStyle(fontWeight: FontWeight.w600, color: c.onSurface),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
