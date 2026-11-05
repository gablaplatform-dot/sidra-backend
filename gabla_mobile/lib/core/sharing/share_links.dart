import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

const sharedKinds = {'job', 'event', 'product', 'service'};
Uri gablaShareUrl(String type, String id) {
  if (!sharedKinds.contains(type) ||
      !RegExp(r'^[a-zA-Z0-9_-]{1,64}$').hasMatch(id))
    throw ArgumentError('Invalid shared item');
  return Uri.https('gogabla.com', '/share/$type/$id');
}

String? sharedDestination(Uri uri) {
  final parts = uri.pathSegments;
  if (parts.length != 3 ||
      parts.first != 'share' ||
      !sharedKinds.contains(parts[1]) ||
      !RegExp(r'^[a-zA-Z0-9_-]{1,64}$').hasMatch(parts[2]))
    return null;
  return switch (parts[1]) {
    'job' => '/jobs/p/${parts[2]}',
    'event' => '/events/p/${parts[2]}',
    _ => '/shop/product/${parts[2]}',
  };
}

Future<void> shareGablaItem(
  BuildContext context, {
  required String type,
  required String id,
  required String title,
}) async {
  final url = gablaShareUrl(type, id).toString();
  final box = context.findRenderObject();
  final origin = box is RenderBox && box.hasSize
      ? box.localToGlobal(Offset.zero) & box.size
      : const Rect.fromLTWH(0, 0, 1, 1);
  try {
    await SharePlus.instance.share(
      ShareParams(
        text: '$title\n$url',
        subject: title,
        title: 'Share on',
        sharePositionOrigin: origin,
      ),
    );
  } on PlatformException {
    await _copy(context, url);
  } on MissingPluginException {
    await _copy(context, url);
  }
}

Future<void> _copy(BuildContext context, String url) async {
  await Clipboard.setData(ClipboardData(text: url));
  if (context.mounted)
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Link copied. Paste it into WhatsApp or another app.'),
      ),
    );
}
