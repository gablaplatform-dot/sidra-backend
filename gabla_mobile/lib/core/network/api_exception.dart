/// Mirrors the `{ error: { message, code } }` envelope the Sidra API returns
/// on a non-2xx response (see `public_app/src/lib/api.js`).
class ApiException implements Exception {
  ApiException({required this.message, this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
