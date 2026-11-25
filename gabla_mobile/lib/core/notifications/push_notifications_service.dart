import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/session_controller.dart';
import '../network/network_providers.dart';
import '../router/app_router.dart';

/// Runs once at startup (see `app.dart`) as a Riverpod-aware service: asks for
/// notification permission, grabs an FCM token and registers it with the
/// backend (`POST /devices`), keeps it fresh on rotation, and routes to the
/// relevant screen when a push is tapped. Everything here is best-effort -
/// no Firebase project configured yet (no google-services.json /
/// GoogleService-Info.plist) simply means `Firebase.initializeApp()` throws
/// once and the app carries on without push, same as the backend side
/// degrades gracefully with no FIREBASE_SERVICE_ACCOUNT_JSON set.
const _androidChannel = AndroidNotificationChannel(
  'high_importance_channel',
  'Notifications',
  description: 'Ride offers, order updates and other important alerts.',
  importance: Importance.high,
);

final _localNotifications = FlutterLocalNotificationsPlugin();

// A background/terminated isolate has no app state of its own - Firebase must be reinitialized
// here independently of the foreground app. There's nothing else to do: Android already shows
// the system notification from the message's `notification` payload via the channel declared in
// AndroidManifest.xml, and iOS does the same at the OS level.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushNotificationsService {
  PushNotificationsService(this._ref);

  final Ref _ref;
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('[push] Firebase.initializeApp failed (no config files yet?): $e');
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_androidChannel);
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (details) => _navigate(details.payload),
    );

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // A foreground message doesn't show a system notification on its own - without this it would
    // silently do nothing while the app is open.
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;
      _localNotifications.show(
        id: notification.hashCode,
        title: notification.title,
        body: notification.body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _androidChannel.id,
            _androidChannel.name,
            channelDescription: _androidChannel.description,
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: _pathFor(message.data),
      );
    });

    FirebaseMessaging.onMessageOpenedApp.listen(
      (message) => _navigate(_pathFor(message.data)),
    );
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      // The router isn't guaranteed to be mounted on this very first call - give it one frame.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _navigate(_pathFor(initialMessage.data)),
      );
    }

    messaging.onTokenRefresh.listen(_registerToken);
    await syncTokenWithSignInState();
  }

  /// Registers the current FCM token with the backend if someone is actually signed in right
  /// now - call this once at startup (after `init`, in case the session was already loaded) and
  /// again right after a successful sign-in, since `onTokenRefresh` only fires on token rotation,
  /// not on login.
  Future<void> syncTokenWithSignInState() async {
    if (!_ref.read(isSignedInProvider)) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _registerToken(token);
  }

  Future<void> _registerToken(String token) async {
    if (!_ref.read(isSignedInProvider)) return;
    try {
      await _ref.read(apiClientProvider).post<void>(
        '/devices',
        body: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'},
      );
    } catch (e) {
      debugPrint('[push] token registration failed: $e');
    }
  }

  /// Called from the sign-out flow so a shared/reset device stops receiving the signed-out
  /// account's pushes.
  Future<void> unregisterCurrentToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _ref.read(apiClientProvider).post<void>(
        '/devices/unregister',
        body: {'token': token},
      );
    } catch (e) {
      debugPrint('[push] token unregistration failed: $e');
    }
  }

  String? _pathFor(Map<String, dynamic> data) {
    switch (data['type']) {
      case 'ride_offer':
      case 'ride_accepted':
        return '/ride';
      case 'order':
        return '/orders';
      default:
        return null;
    }
  }

  void _navigate(String? path) {
    if (path == null) return;
    _ref.read(appRouterProvider).go(path);
  }
}

final pushNotificationsServiceProvider = Provider<PushNotificationsService>(
  (ref) => PushNotificationsService(ref),
);
