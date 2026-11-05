import 'dart:io';
import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/features/auth/application/auth_controller.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/data/auth_repository.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/auth/presentation/login_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';

class FixedTheme extends ThemeController {
  FixedTheme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class MemorySession extends SessionController {
  @override
  Future<Session?> build() async => null;
  @override
  Future<void> setSession(Session session) async {
    state = AsyncData(session);
  }
}

class TokenRepository extends AuthRepository {
  TokenRepository()
    : super(
        ApiClient(
          getToken: () => null,
          onTokenRenewed: (_) {},
          onUnauthorized: () {},
        ),
      );
  String? received;
  @override
  Future<Session> signInWithGoogle(String token) async {
    received = token;
    return const Session(
      accessToken: 'fixture-session',
      user: AppUser(id: 'user', name: 'Amina', email: 'amina@example.test'),
      isNewUser: true,
    );
  }
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    for (final entry in {
      'Inter': 'Inter.ttf',
      'Manrope': 'Manrope.ttf',
      'DM Serif Display': 'DMSerifDisplay-Regular.ttf',
    }.entries) {
      final loader = FontLoader(entry.key)
        ..addFont(rootBundle.load('assets/fonts/${entry.value}'));
      await loader.load();
    }
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  test(
    'Google credential is exchanged with API and account result is stored; duplicate tap is ignored',
    () async {
      final identity = Completer<String?>(), repository = TokenRepository();
      var calls = 0;
      final container = ProviderContainer(
        overrides: [
          sessionControllerProvider.overrideWith(MemorySession.new),
          authRepositoryProvider.overrideWithValue(repository),
          googleIdentityTokenProvider.overrideWithValue(() {
            calls++;
            return identity.future;
          }),
        ],
      );
      addTearDown(container.dispose);
      await container.read(sessionControllerProvider.future);
      final flow = container.read(authControllerProvider.notifier);
      final pending = flow.signInWithGoogle();
      expect(container.read(authControllerProvider).isLoading, true);
      await flow.signInWithGoogle();
      expect(calls, 1);
      identity.complete('fixture-google-credential');
      await pending;
      expect(repository.received, 'fixture-google-credential');
      expect(
        container.read(sessionControllerProvider).valueOrNull?.isNewUser,
        true,
      );
    },
  );
  test(
    'Google picker cancellation leaves user signed out without an error',
    () async {
      final repository = TokenRepository();
      final container = ProviderContainer(
        overrides: [
          sessionControllerProvider.overrideWith(MemorySession.new),
          authRepositoryProvider.overrideWithValue(repository),
          googleIdentityTokenProvider.overrideWithValue(() async => null),
        ],
      );
      addTearDown(container.dispose);
      await container.read(sessionControllerProvider.future);
      await container.read(authControllerProvider.notifier).signInWithGoogle();
      expect(container.read(authControllerProvider).hasError, false);
      expect(container.read(sessionControllerProvider).valueOrNull, isNull);
      expect(repository.received, isNull);
    },
  );
  test(
    'social account result preserves welcome and operator routing without persisting welcome flag',
    () {
      final session = Session.fromJson({
        'accessToken': 'fixture',
        'user': {'id': 'user'},
        'isNewUser': true,
        'busOperator': {'id': 'operator'},
      });
      expect(session.isNewUser, true);
      expect(session.isBusOperator, true);
      expect(session.copyWith(accessToken: 'renewed').isBusOperator, true);
      final restored = Session.fromJson(session.toJson());
      expect(restored.isNewUser, false);
      expect(restored.isBusOperator, true);
    },
  );
  test(
    'return destination accepts internal journeys and rejects unsafe or recursive routes',
    () {
      expect(loginDestination('/cart?checkout=true'), '/cart?checkout=true');
      expect(loginDestination(null, isBusOperator: true), '/bus/operator');
      for (final next in [
        'https://example.test',
        '//example.test',
        '/login',
        '/welcome',
        '/\\example.test',
      ]) {
        expect(loginDestination(next), '/home');
      }
    },
  );
  for (final style in AppThemeStyle.values) {
    for (final reduced in [true, false]) {
      testWidgets(
        '${style.name} social login fits ${reduced ? '320px accessible' : '430px animated'}',
        (tester) async {
          tester.view.physicalSize = Size(
            reduced ? 320 : 430,
            reduced ? 640 : 932,
          );
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final key = GlobalKey();
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                themeControllerProvider.overrideWith(() => FixedTheme(style)),
              ],
              child: MaterialApp(
                theme: AppTheme.resolve(style, Brightness.light),
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    disableAnimations: reduced,
                    textScaler: TextScaler.linear(reduced ? 1.3 : 1),
                  ),
                  child: child!,
                ),
                home: RepaintBoundary(key: key, child: const LoginScreen()),
              ),
            ),
          );
          await tester.pump(const Duration(milliseconds: 1200));
          expect(tester.takeException(), isNull);
          expect(find.byType(TextFormField), findsNothing);
          expect(find.text('Continue with Google'), findsOneWidget);
          await tester.ensureVisible(find.byKey(const Key('google-sign-in')));
          await tester.pump(const Duration(milliseconds: 300));
          expect(tester.takeException(), isNull);
          if (!reduced) {
            await tester.runAsync(() async {
              final context = key.currentContext!;
              for (final asset in [
                'assets/brand/icon-only.png',
                'assets/artwork/shop.png',
                'assets/artwork/ride.png',
                'assets/artwork/services.png',
              ]) {
                await precacheImage(AssetImage(asset), context);
              }
            });
            await tester.pump();
            await tester.runAsync(() async {
              final boundary =
                  key.currentContext!.findRenderObject()!
                      as RenderRepaintBoundary;
              final image = await boundary.toImage();
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              final folder = Directory('build/previews/login');
              await folder.create(recursive: true);
              await File(
                '${folder.path}/${style.name}.png',
              ).writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
}
