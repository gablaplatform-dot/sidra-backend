import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../auth/application/session_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/provider_repository.dart';
import '../domain/provider_summary.dart';

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderRepository(ref.watch(apiClientProvider)),
);

final topRatedProvidersProvider = FutureProvider<List<ProviderSummary>>((ref) {
  return ref.watch(providerRepositoryProvider).fetchTopRated();
});

final providerDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((
      ref,
      providerId,
    ) async {
      final api = ref.watch(apiClientProvider);
      final signedIn = ref.watch(isSignedInProvider);
      final provider = await ref
          .watch(providerRepositoryProvider)
          .fetchById(providerId);
      if (provider['contactLocked'] != true) return provider;
      final unlock = await const FlutterSecureStorage().read(
        key: 'gabla_unlock_$providerId',
      );
      Map<String, dynamic>? contact;
      if (signedIn) {
        try {
          contact = await api.get('/providers/$providerId/contact');
        } catch (_) {}
      }
      if (contact == null && unlock != null) {
        try {
          contact = await api.get(
            '/providers/$providerId/contact/unlocked',
            query: {'unlockId': unlock},
          );
        } catch (_) {}
      }
      return contact == null
          ? provider
          : {
              ...provider,
              'contactLocked': false,
              'contact': contact['contact'],
              'location': contact['location'],
            };
    });
