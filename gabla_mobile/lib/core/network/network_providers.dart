import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/session_controller.dart';
import 'api_client.dart';

/// The single `ApiClient` instance for the app. It reads the current token
/// and reports token renewal / 401s straight to [SessionController], so no
/// other layer has to juggle auth headers by hand.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    getToken: () =>
        ref.read(sessionControllerProvider).valueOrNull?.accessToken,
    onTokenRenewed: (token) =>
        ref.read(sessionControllerProvider.notifier).applyRenewedToken(token),
    onUnauthorized: () => ref.read(sessionControllerProvider.notifier).clear(),
  );
});
