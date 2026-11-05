import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../data/provider_onboarding_repository.dart';
import '../domain/provider_invite.dart';

final providerOnboardingRepositoryProvider =
    Provider<ProviderOnboardingRepository>(
      (ref) => ProviderOnboardingRepository(ref.watch(apiClientProvider)),
    );

final providerInviteProvider = FutureProvider.family<ProviderInvite, String>((
  ref,
  token,
) {
  return ref.watch(providerOnboardingRepositoryProvider).fetchInvite(token);
});

enum OnboardingStep { form, linkGoogle, done }

class ProviderOnboardingState {
  const ProviderOnboardingState({
    this.step = OnboardingStep.form,
    this.loading = false,
    this.error,
  });

  final OnboardingStep step;
  final bool loading;
  final String? error;

  ProviderOnboardingState copyWith({
    OnboardingStep? step,
    bool? loading,
    String? error,
  }) => ProviderOnboardingState(
    step: step ?? this.step,
    loading: loading ?? this.loading,
    error: error,
  );
}

/// Drives the two submission steps of completing an invite: filling in the
/// business profile, then linking a Google account to actually sign in as
/// that provider (same Google Identity Services exchange as regular login -
/// see `AuthController`).
class ProviderOnboardingController extends Notifier<ProviderOnboardingState> {
  @override
  ProviderOnboardingState build() => const ProviderOnboardingState();

  Future<void> submitProfile({
    required String token,
    required String businessName,
    String? description,
    required ProviderContactInfo contact,
    required ProviderLocationInfo location,
    String? categoryId,
  }) async {
    state = state.copyWith(loading: true, error: null);
    try {
      await ref
          .read(providerOnboardingRepositoryProvider)
          .complete(
            token: token,
            businessName: businessName,
            description: description,
            contact: contact,
            location: location,
            categoryId: categoryId,
          );
      state = state.copyWith(step: OnboardingStep.linkGoogle, loading: false);
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Could not save your business profile.',
      );
    }
  }

  Future<void> linkGoogleAccount(String token) async {
    state = state.copyWith(loading: true, error: null);
    try {
      final googleSignIn = GoogleSignIn(
        serverClientId: Env.googleClientId,
        scopes: const ['email', 'profile'],
      );
      final account = await googleSignIn.signIn();
      if (account == null) {
        state = state.copyWith(loading: false);
        return;
      }
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        throw ApiException(
          message: 'Google sign-in did not return an ID token.',
        );
      }
      final session = await ref
          .read(providerOnboardingRepositoryProvider)
          .linkGoogle(token, idToken);
      await ref.read(sessionControllerProvider.notifier).setSession(session);
      state = state.copyWith(step: OnboardingStep.done, loading: false);
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Could not link your Google account.',
      );
    }
  }
}

final providerOnboardingControllerProvider =
    NotifierProvider<ProviderOnboardingController, ProviderOnboardingState>(
      ProviderOnboardingController.new,
    );
