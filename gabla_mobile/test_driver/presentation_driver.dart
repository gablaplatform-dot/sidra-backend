import 'dart:convert';
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final folder = Directory('build/previews/presentation');
  await folder.create(recursive: true);
  await integrationDriver(
    onScreenshot: (name, bytes, [args]) async {
      await File('${folder.path}/$name.png').writeAsBytes(bytes);
      return true;
    },
    responseDataCallback: (data) async {
      final snapshots = data?['nativeMapSnapshots'] as Map? ?? {};
      for (final entry in snapshots.entries) {
        await File(
          '${folder.path}/${entry.key}.png',
        ).writeAsBytes(base64Decode('${entry.value}'));
      }
    },
  );
}
