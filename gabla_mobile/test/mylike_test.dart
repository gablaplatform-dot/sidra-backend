import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/features/mylike/mylike_screen.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    for (final font in const {
      'Manrope': 'assets/fonts/Manrope.ttf',
      'MaterialIcons': 'fonts/MaterialIcons-Regular.otf',
    }.entries) {
      final loader = FontLoader(font.key)..addFont(rootBundle.load(font.value));
      await loader.load();
    }
  });

  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('all Mylike screens fit a narrow phone at enlarged text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final screen in MylikeScreen.screens) {
      await tester.pumpWidget(
        ProviderScope(
          key: ValueKey(screen),
          overrides: [
            googleMapsConfiguredProvider.overrideWith((_) async => false),
          ],
          child: MaterialApp(
            theme: ThemeData(fontFamily: 'Manrope'),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                disableAnimations: true,
                textScaler: const TextScaler.linear(1.25),
              ),
              child: child!,
            ),
            home: MylikeScreen(screen: screen),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: screen);
      final list = find.byType(ListView);
      if (list.evaluate().isNotEmpty) {
        await tester.drag(list.first, const Offset(0, -540));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: '$screen after scroll');
      }
    }
  });

  testWidgets('product action adds a sample item and opens the preview cart', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/mylike/product',
      routes: [
        GoRoute(
          path: '/mylike/:screen',
          builder: (_, state) =>
              MylikeScreen(screen: state.pathParameters['screen']!),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(child: MaterialApp.router(routerConfig: router)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add to Cart'));
    await tester.pumpAndSettle();
    expect(find.text('Your cart'), findsOneWidget);
    expect(find.text('Grey Casual shoe'), findsOneWidget);
    await tester.tap(find.text('Checkout'));
    await tester.pumpAndSettle();
    expect(find.text('Preview order'), findsOneWidget);
  });

  for (final screen in [
    'home',
    'shop',
    'product',
    'events',
    'event',
    'jobs',
    'ride-options',
    'bus',
  ]) {
    testWidgets('render Mylike $screen', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final key = GlobalKey();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            googleMapsConfiguredProvider.overrideWith((_) async => false),
          ],
          child: MaterialApp(
            theme: ThemeData(fontFamily: 'Manrope'),
            home: RepaintBoundary(
              key: key,
              child: MylikeScreen(screen: screen),
            ),
          ),
        ),
      );
      await tester.runAsync(() async {
        for (final asset in ['shop', 'events']) {
          await precacheImage(
            AssetImage('assets/mylike/$asset.jpg'),
            key.currentContext!,
          );
        }
      });
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      if (const bool.fromEnvironment('MYLIKE_PREVIEWS')) {
        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final image = await boundary.toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final directory = await Directory(
            'build/previews/mylike',
          ).create(recursive: true);
          await File(
            '${directory.path}/$screen.png',
          ).writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }
    });
  }
}
