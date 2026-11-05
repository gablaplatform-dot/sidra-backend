import 'package:intl/intl.dart';

final _ugxFormat = NumberFormat.decimalPattern('en_US');

String formatUgx(dynamic value) {
  final n = double.tryParse(value?.toString() ?? '') ?? 0;
  return 'UGX ${_ugxFormat.format(n.round())}';
}

String formatTime(dynamic iso) {
  if (iso == null) return '';
  final d = DateTime.tryParse(iso.toString());
  if (d == null) return '';
  return DateFormat('MMM d, h:mm a').format(d.toLocal());
}
