import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/network_providers.dart';

final workspaceDataProvider = FutureProvider.autoDispose
    .family<dynamic, String>(
      (ref, path) => ref.watch(apiClientProvider).get<dynamic>(path),
    );
List<Map<String, dynamic>> workspaceItems(dynamic data) {
  final list = data is List
      ? data
      : data is Map
      ? data['items'] as List? ?? []
      : [];
  return list
      .whereType<Map>()
      .map((v) => Map<String, dynamic>.from(v))
      .toList();
}
