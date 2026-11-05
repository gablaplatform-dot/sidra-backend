import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/network_providers.dart';

final communityEndpointProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, endpoint) {
      final uri = Uri.parse(endpoint);
      return ref
          .watch(apiClientProvider)
          .get<Map<String, dynamic>>(uri.path, query: uri.queryParameters);
    });
List<Map<String, dynamic>> communityItems(Map<String, dynamic> data) =>
    (data['items'] as List? ?? [])
        .map((v) => Map<String, dynamic>.from(v as Map))
        .toList();
const jobCategories = [
  'Technology',
  'Hospitality',
  'Construction',
  'Driving',
  'Sales',
  'Education',
  'Healthcare',
  'Creative',
  'Other',
];
const eventCategories = [
  'Music',
  'Nightlife',
  'Arts',
  'Community',
  'Sports',
  'Food',
  'Workshops',
  'Other',
];
String communityPay(Map post) {
  final min = num.tryParse('${post['payMin']}') ?? 0,
      max = num.tryParse('${post['payMax']}') ?? 0;
  String amount(num n) => n
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  if (min == 0 && max == 0)
    return post['kind'] == 'event' ? 'Free entry' : 'Pay negotiable';
  return '${post['currency'] ?? 'UGX'} ${amount(min)}${max > min ? ' – ${amount(max)}' : ''}';
}

/// Show only a declared pay basis; negotiable pay has no periodic amount.
String communityPayPeriod(Map post) {
  if (post['kind'] == 'event') return '';
  final min = num.tryParse('${post['payMin']}') ?? 0;
  final max = num.tryParse('${post['payMax']}') ?? 0;
  if (min == 0 && max == 0) return '';
  if (post['jobType'] == 'task') return 'Per task';
  final details = post['details'] as Map? ?? {};
  final period = '${details['payPeriod'] ?? ''}';
  return switch (period) {
    'hour' => 'Per hour',
    'day' => 'Per day',
    'week' => 'Per week',
    'month' => 'Per month',
    'year' => 'Per year',
    'task' => 'Per task',
    'negotiable' => 'Pay period negotiable',
    _ => '',
  };
}
