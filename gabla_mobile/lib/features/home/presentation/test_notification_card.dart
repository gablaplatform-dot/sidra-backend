import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/page_band.dart';
import '../../auth/application/session_controller.dart';

/// A Home screen card that proves push notifications actually work end to end: it asks the
/// backend to send this device a real push a minute from now, through Firebase, not a
/// device-only scheduled notification - so it still arrives even if the app is closed.
class TestNotificationCard extends ConsumerStatefulWidget {
  const TestNotificationCard({super.key});

  @override
  ConsumerState<TestNotificationCard> createState() =>
      _TestNotificationCardState();
}

class _TestNotificationCardState extends ConsumerState<TestNotificationCard> {
  bool _sending = false;

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      await ref.read(apiClientProvider).post<void>('/devices/test');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sent - it\'ll arrive in about a minute, even if you close the app.',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(isSignedInProvider);
    final theme = Theme.of(context);
    return PageBand(
      color: theme.colorScheme.surface,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.notifications_active_outlined,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Test notifications',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    signedIn
                        ? 'Send yourself a real push in 1 minute - try closing the app first.'
                        : 'Sign in to try a real push notification.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: signedIn && !_sending ? _send : null,
            child: _sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Send test push'),
          ),
        ),
      ],
    );
  }
}
