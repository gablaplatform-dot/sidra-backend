import 'dart:convert';
import 'package:http/http.dart' as http;

import 'session_store.dart';

/// Points at the production API by default (matches public_app/admin_ui's own default),
/// overridable at build time with --dart-define=API_BASE=... for local testing against
/// an emulator (10.0.2.2 instead of localhost).
const String apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://sidra-api.fly.dev/api/v1',
);

class ApiException implements Exception {
  final String message;
  final int? status;
  final String? code;
  ApiException(this.message, {this.status, this.code});
  @override
  String toString() => message;
}

class ApiClient {
  final SessionStore session;
  ApiClient(this.session);

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final token = auth ? await session.getToken() : null;
    final uri = Uri.parse('$apiBase$path');
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    late http.Response response;
    final encoded = body != null ? jsonEncode(body) : null;
    switch (method) {
      case 'POST':
        response = await http.post(uri, headers: headers, body: encoded);
        break;
      case 'PATCH':
        response = await http.patch(uri, headers: headers, body: encoded);
        break;
      case 'PUT':
        response = await http.put(uri, headers: headers, body: encoded);
        break;
      default:
        response = await http.get(uri, headers: headers);
    }

    Map<String, dynamic> parsed = {};
    if (response.body.isNotEmpty) {
      try {
        parsed = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        parsed = {};
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) {
        await session.clear();
      }
      final err = parsed['error'] as Map<String, dynamic>?;
      throw ApiException(
        err?['message'] as String? ?? 'Request failed',
        status: response.statusCode,
        code: err?['code'] as String?,
      );
    }

    return parsed['data'];
  }
}
