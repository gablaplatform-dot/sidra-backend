import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

/// Sets up FCM so a driver gets a push the moment a ride offer comes in, even with the app
/// backgrounded or the screen off. Everything here is best-effort - no Firebase project
/// configured yet (no google-services.json / GoogleService-Info.plist) simply means
/// `Firebase.initializeApp()` throws once and the app carries on without push, same as the
/// backend side degrades gracefully with no FIREBASE_SERVICE_ACCOUNT_JSON set.
const _androidChannel = AndroidNotificationChannel(
  'high_importance_channel',
  'Notifications',
  description: 'Ride offers and other important alerts.',
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
  PushNotificationsService(this._api);

  final ApiClient _api;
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
    );

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    // A foreground message doesn't show a system notification on its own - without this it would
    // silently do nothing while the app is open and the driver might miss a ride request.
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
      );
    });

    messaging.onTokenRefresh.listen(_registerToken);
    final token = await messaging.getToken();
    if (token != null) await _registerToken(token);
  }

  Future<void> _registerToken(String token) async {
    try {
      await _api.request(
        '/devices',
        method: 'POST',
        body: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'},
      );
    } catch (e) {
      debugPrint('[push] token registration failed: $e');
    }
  }

  /// Called right before logout so a shared/reset device stops receiving the signed-out
  /// account's pushes.
  Future<void> unregisterCurrentToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _api.request('/devices/unregister', method: 'POST', body: {'token': token});
    } catch (e) {
      debugPrint('[push] token unregistration failed: $e');
    }
  }
}
