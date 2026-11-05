import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/data/theme_preferences_store.dart';
import 'package:gabla_mobile/features/settings/presentation/motion_settings.dart';
import 'package:gabla_mobile/features/shop/presentation/product_gallery.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  test(
    'old installations default to 1.5 seconds and selected interval survives restart',
    () async {
      final store = ThemePreferencesStore();
      expect((await store.read()).productImageSeconds, 1.5);
      final container = ProviderContainer();
      container.read(themeControllerProvider);
      await Future<void>.delayed(Duration.zero);
      container
          .read(themeControllerProvider.notifier)
          .setProductImageSeconds(4.5);
      await Future<void>.delayed(Duration.zero);
      expect((await store.read()).productImageSeconds, 4.5);
      container.dispose();
      final restarted = ProviderContainer();
      restarted.read(themeControllerProvider);
      await Future<void>.delayed(Duration.zero);
      expect(restarted.read(themeControllerProvider).productImageSeconds, 4.5);
      restarted.dispose();
    },
  );
  testWidgets(
    'Design Studio interval controls update label and slider on a narrow phone',
    (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: Scaffold(body: MotionSettings())),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('1.5 seconds'), findsOneWidget);
      await tester.tap(find.byTooltip('Show images less often'));
      await tester.pumpAndSettle();
      expect(find.text('2.0 seconds'), findsOneWidget);
      final slider = tester.widget<Slider>(
        find.byKey(const Key('product-image-interval')),
      );
      slider.onChanged!(6);
      await tester.pumpAndSettle();
      expect(find.text('6.0 seconds'), findsOneWidget);
      expect(container.read(themeControllerProvider).productImageSeconds, 6);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'visible gallery uses saved interval and restarts timer when changed',
    (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      Widget scene({bool reduced = false}) => UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: reduced),
            child: const Scaffold(
              body: SizedBox(
                height: 350,
                child: ProductGallery(images: ['', '']),
              ),
            ),
          ),
        ),
      );
      await tester.pumpWidget(scene());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1400));
      expect(find.text('1/2'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('2/2'), findsOneWidget);
      container
          .read(themeControllerProvider.notifier)
          .setProductImageSeconds(4);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 3900));
      expect(find.text('2/2'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('1/2'), findsOneWidget);
      await tester.pumpWidget(scene(reduced: true));
      await tester.pump(const Duration(seconds: 8));
      expect(find.text('1/2'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    },
  );
}
