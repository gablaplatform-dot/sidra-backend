import 'dart:io';
import 'package:http/http.dart' as http;

import 'api_client.dart';

/// Same presigned-URL upload flow used by public_app/admin_ui: ask the backend for a signed
/// PUT URL, upload the file bytes straight to R2, then use the returned public URL.
class UploadService {
  final ApiClient api;
  UploadService(this.api);

  Future<String> uploadFile(File file, {String folder = 'ride-driver-permits'}) async {
    final contentType = _contentTypeFor(file.path);
    final upload = await api.request(
      '/storage/upload-url',
      method: 'POST',
      body: {
        'contentType': contentType,
        'folder': folder,
        'filename': file.uri.pathSegments.last,
      },
    ) as Map<String, dynamic>;

    final uploadUrl = upload['uploadUrl'] as String;
    final publicUrl = upload['publicUrl'] as String?;

    final bytes = await file.readAsBytes();
    final response = await http.put(
      Uri.parse(uploadUrl),
      headers: {'Content-Type': contentType},
      body: bytes,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('Photo upload failed. Please try again.');
    }

    if (publicUrl == null) {
      throw ApiException('Photo uploaded but no URL was returned.');
    }
    return publicUrl;
  }

  String _contentTypeFor(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
}
