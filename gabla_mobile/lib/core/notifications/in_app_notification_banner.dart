import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'push_notifications_service.dart';

/// Wraps the whole app (see `app.dart`) and slides down a preview banner whenever a push
/// arrives while the app is in the foreground - the on-device equivalent of what a real,
/// backend-sent push looks like when the app is backgrounded or closed, which the OS shows on
/// its own. Tapping the banner dismisses it; it also auto-dismisses after a few seconds.
class InAppNotificationBanner extends ConsumerStatefulWidget {
  const InAppNotificationBanner({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<InAppNotificationBanner> createState() =>
      _InAppNotificationBannerState();
}

class _InAppNotificationBannerState
    extends ConsumerState<InAppNotificationBanner> {
  Timer? _dismissTimer;

  void _dismiss() {
    _dismissTimer?.cancel();
    ref.read(foregroundNotificationProvider.notifier).state = null;
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final message = ref.watch(foregroundNotificationProvider);
    ref.listen<RemoteMessage?>(foregroundNotificationProvider, (
      previous,
      next,
    ) {
      _dismissTimer?.cancel();
      if (next != null) {
        _dismissTimer = Timer(const Duration(seconds: 5), _dismiss);
      }
    });

    return Stack(
      children: [
        widget.child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              transitionBuilder: (child, animation) => SlideTransition(
                position: Tween(begin: const Offset(0, -1), end: Offset.zero)
                    .animate(animation),
                child: child,
              ),
              child: message == null
                  ? const SizedBox.shrink(key: ValueKey('empty'))
                  : _BannerCard(
                      key: ValueKey(message.messageId ?? message.hashCode),
                      title: message.notification?.title ?? 'Gabla',
                      body: message.notification?.body ?? '',
                      onTap: _dismiss,
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({
    super.key,
    required this.title,
    required this.body,
    required this.onTap,
  });

  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Material(
        color: theme.colorScheme.surface,
        elevation: 8,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.notifications_rounded,
                    color: theme.colorScheme.onPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (body.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          body,
                          style: theme.textTheme.bodySmall,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
