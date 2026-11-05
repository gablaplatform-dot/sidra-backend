import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/services.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../data/auth_repository.dart';
import 'session_controller.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

final googleIdentityTokenProvider = Provider<Future<String?> Function()>((ref) {
  final google = GoogleSignIn(
    serverClientId: Env.googleClientId,
    scopes: const ['email', 'profile'],
  );
  return () async {
    final account = await google.signIn();
    if (account == null) return null;
    final token = (await account.authentication).idToken;
    if (token == null)
      throw ApiException(
        message: 'Google did not return an ID token. Please try again.',
      );
    return token;
  };
});

/// Drives the sign-in / sign-out flow. UI watches this for
/// loading/error state and calls [signInWithGoogle] / [signOut]; the actual
/// session is owned by [SessionController].
class AuthController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  GoogleSignIn _googleSignIn() => GoogleSignIn(
    serverClientId: Env.googleClientId,
    scopes: const ['email', 'profile'],
  );

  Future<void> signInWithGoogle() async {
    if (state.isLoading) return;
    state = const AsyncLoading();
    try {
      final idToken = await ref.read(googleIdentityTokenProvider)();
      if (idToken == null) {
        state = const AsyncData(null);
        return;
      }
      final session = await ref
          .read(authRepositoryProvider)
          .signInWithGoogle(idToken);
      await ref.read(sessionControllerProvider.notifier).setSession(session);
      state = const AsyncData(null);
    } on PlatformException catch (error, stackTrace) {
      if (error.code == GoogleSignIn.kSignInCanceledError) {
        state = const AsyncData(null);
        return;
      }
      state = AsyncError(
        ApiException(
          message: error.code == 'network_error'
              ? 'Check your connection and try Google again.'
              : 'Google sign-in could not finish. Please try again.',
          code: error.code,
        ),
        stackTrace,
      );
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
    }
  }

  Future<void> signIn(
    String identifier,
    String password, {
    String? name,
    String? businessName,
  }) async {
    if (state.isLoading) return;
    state = const AsyncLoading();
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .signIn(identifier, password, name: name, businessName: businessName);
      await ref.read(sessionControllerProvider.notifier).setSession(session);
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> signOut() async {
    try {
      await _googleSignIn().signOut();
    } catch (_) {}
    await ref.read(sessionControllerProvider.notifier).clear();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AsyncValue<void>>(AuthController.new);
