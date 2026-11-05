import 'dart:typed_data';
import 'package:dio/dio.dart';

import '../config/env.dart';
import 'api_exception.dart';

/// Thin HTTP client over the Sidra API, mirroring the contract
/// `public_app/src/lib/api.js` implements for the web app:
///  - every request carries `Authorization: Bearer <token>` when signed in;
///  - a successful response's body is `{ data: ... }` - callers get `data`;
///  - an error response's body is `{ error: { message, code } }`;
///  - the server may hand back a refreshed token via `X-Renewed-Token`,
///    which must replace the stored one so an active session never expires;
///  - a 401 means the stored token is dead and the session should be cleared.
///
/// This class has no knowledge of Riverpod or storage - it is driven purely
/// by the three callbacks below, which `features/auth` wires up to the
/// session state. That keeps it trivially testable on its own.
class ApiClient {
  ApiClient({
    String? baseUrl,
    required String? Function() getToken,
    required void Function(String renewedToken) onTokenRenewed,
    required void Function() onUnauthorized,
    Dio? dio,
  }) : _getToken = getToken,
       _onTokenRenewed = onTokenRenewed,
       _onUnauthorized = onUnauthorized,
       _dio =
           dio ??
           Dio(
             BaseOptions(
               baseUrl: baseUrl ?? Env.apiBaseUrl,
               connectTimeout: const Duration(seconds: 15),
               receiveTimeout: const Duration(seconds: 20),
             ),
           ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          final renewed = response.headers.value('x-renewed-token');
          if (renewed != null && renewed.isNotEmpty) _onTokenRenewed(renewed);
          handler.next(response);
        },
        onError: (error, handler) {
          if (error.response?.statusCode == 401) _onUnauthorized();
          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;
  final String? Function() _getToken;
  final void Function(String renewedToken) _onTokenRenewed;
  final void Function() _onUnauthorized;

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>(() => _dio.get(path, queryParameters: query));

  /// Every paginated list endpoint (`/listings`, `/product-categories/roots`,
  /// `/providers`, `/bus/*`, ...) wraps its array as `{ items: [...] }`
  /// rather than returning the array directly - this unwraps that
  /// consistently so repositories don't each re-implement it.
  Future<List<dynamic>> getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final raw = await get<dynamic>(path, query: query);
    if (raw is Map) return raw['items'] as List? ?? const [];
    return raw as List? ?? const [];
  }

  Future<Uint8List> getPdf(
    String path, {
    String method = 'GET',
    Object? body,
  }) async {
    try {
      final response = await _dio.request<List<int>>(
        path,
        data: body,
        options: Options(responseType: ResponseType.bytes, method: method),
      );
      final bytes = Uint8List.fromList(response.data ?? []);
      if (bytes.length < 4 || String.fromCharCodes(bytes.take(4)) != '%PDF') {
        throw ApiException(message: 'The document response was not a PDF.');
      }
      return bytes;
    } on DioException catch (e) {
      throw ApiException(
        message: 'Could not open the document.',
        statusCode: e.response?.statusCode,
      );
    }
  }

  Future<T> post<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.post(path, data: body));

  Future<T> put<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.put(path, data: body));

  Future<Map<String, dynamic>> uploadMedia(
    Uint8List bytes, {
    required String filename,
    required String contentType,
    required String folder,
  }) => _send<Map<String, dynamic>>(
    () => _dio.post(
      '/storage/upload',
      queryParameters: {'folder': folder, 'filename': filename},
      data: bytes,
      options: Options(contentType: contentType),
    ),
  );

  Future<T> patch<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.patch(path, data: body));

  Future<T> delete<T>(String path, {Object? body}) =>
      _send<T>(() => _dio.delete(path, data: body));

  Future<T> _send<T>(Future<Response<dynamic>> Function() call) async {
    try {
      final response = await call();
      final body = response.data;
      if (body is! Map || !body.containsKey('data')) {
        throw ApiException(
          message: 'This feature needs the latest server update.',
          statusCode: 404,
          code: 'API_NOT_AVAILABLE',
        );
      }
      return body['data'] as T;
    } on DioException catch (error) {
      final body = error.response?.data;
      final errorBody = body is Map ? body['error'] as Map? : null;
      throw ApiException(
        message:
            errorBody?['message'] as String? ??
            error.message ??
            'The request failed.',
        statusCode: error.response?.statusCode,
        code: errorBody?['code'] as String?,
      );
    }
  }
}
