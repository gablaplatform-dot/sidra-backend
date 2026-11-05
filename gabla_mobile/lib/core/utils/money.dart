import 'package:intl/intl.dart';

/// `UGX 12,000` - mirrors `formatUgx` in `public_app/src/lib/format.js`.
String formatUgx(num? value) {
  final formatter = NumberFormat.decimalPattern();
  return 'UGX ${formatter.format(value ?? 0)}';
}
