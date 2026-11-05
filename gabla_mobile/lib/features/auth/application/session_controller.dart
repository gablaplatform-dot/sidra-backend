import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/secure_session_store.dart';
import '../domain/session.dart';

final secureSessionStoreProvider = Provider<SecureSessionStore>(
  (ref) => SecureSessionStore(),
);

/// Owns the signed-in session, loaded once from secure storage at startup
/// and kept there on every change. Every other provider that needs "am I
/// signed in" or "what's my token" reads through this one - there is no
/// second source of truth.
class SessionController extends AsyncNotifier<Session?> {
  @override
  Future<Session?> build() async {
    final stored = await ref.read(secureSessionStoreProvider).read();
    if (stored == null) return null;
    try {
      return Session.fromJson(stored);
    } catch (_) {
      return null;
    }
  }

  Future<void> setSession(Session session) async {
    state = AsyncData(session);
    await ref.read(secureSessionStoreProvider).write(session.toJson());
  }

  Future<void> clear() async {
    state = const AsyncData(null);
    await ref.read(secureSessionStoreProvider).clear();
  }

  /// The API extends an active session by handing back a fresh token as it
  /// ages (see `ApiClient`'s `onTokenRenewed`). Applying it here means a
  /// user who keeps using the app is never signed out for being idle.
  void applyRenewedToken(String token) {
    final current = state.valueOrNull;
    if (current == null) return;
    final updated = current.copyWith(accessToken: token);
    state = AsyncData(updated);
    unawaited(ref.read(secureSessionStoreProvider).write(updated.toJson()));
  }
}

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, Session?>(SessionController.new);

/// True once the signed-in session has loaded and is present. Screens behind
/// a sign-in wall (profile, orders, ...) watch this instead of the raw
/// session to avoid flashing a logged-out state while storage is read.
final isSignedInProvider = Provider<bool>((ref) {
  final session = ref.watch(sessionControllerProvider);
  return session.valueOrNull != null;
});
