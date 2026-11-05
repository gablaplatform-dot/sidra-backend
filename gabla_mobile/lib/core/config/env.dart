/// Build-time configuration, overridable with `--dart-define`.
///
/// Example:
///   flutter run --dart-define=API_BASE_URL=https://sidra-api.fly.dev/api/v1
class Env {
  Env._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://sidra-api.fly.dev/api/v1',
  );

  // Public OAuth audience shared with the website and validated by the API.
  static const googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue:
        '478189678916-l0t6k527ok7rra3p7tcpq8445suh46qj.apps.googleusercontent.com',
  );
}
