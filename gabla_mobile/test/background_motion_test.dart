import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/motion/motion_background.dart';
import 'package:gabla_mobile/features/settings/data/theme_preferences_store.dart';
import 'package:gabla_mobile/features/settings/domain/background_motion.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/settings/domain/palette_presets.dart';
import 'package:gabla_mobile/features/settings/presentation/appearance_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'legacy settings default off; selected motion, speed, and intensity persist',
    () async {
      final store = ThemePreferencesStore();
      expect((await store.read()).motion, BackgroundMotion.none);
      await store.write(
        ThemePreferences.defaults.copyWith(
          motion: BackgroundMotion.lines,
          motionIntensity: .8,
          motionSpeed: .7,
        ),
      );
      final restored = await store.read();
      expect(restored.motion, BackgroundMotion.lines);
      expect(restored.motionIntensity, .8);
      expect(restored.motionSpeed, .7);
      expect(palettePresets.length, 12);
      expect(palettePresets.values.map((p) => p[2]).toSet().length, 12);
    },
  );
  testWidgets(
    'background advances normally, stays still with reduced motion, and pauses in background',
    (tester) async {
      Widget scene({bool reduced = false}) => MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: reduced),
          child: const SizedBox(
            width: 320,
            height: 500,
            child: MotionCanvas(
              mode: BackgroundMotion.orbs,
              colors: [Colors.blue, Colors.pink, Colors.white],
              background: Colors.white,
            ),
          ),
        ),
      );
      double progress() =>
          tester
                  .widget<CustomPaint>(
                    find.byWidgetPredicate(
                      (w) =>
                          w is CustomPaint &&
                          w.painter is MotionBackgroundPainter,
                    ),
                  )
                  .painter
              is MotionBackgroundPainter
          ? (tester
                        .widget<CustomPaint>(
                          find.byWidgetPredicate(
                            (w) =>
                                w is CustomPaint &&
                                w.painter is MotionBackgroundPainter,
                          ),
                        )
                        .painter
                    as MotionBackgroundPainter)
                .progress
          : -1;
      await tester.pumpWidget(scene());
      await tester.pump(const Duration(seconds: 1));
      expect(progress(), greaterThan(0));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      final stopped = progress();
      await tester.pump(const Duration(seconds: 1));
      expect(progress(), stopped);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(scene(reduced: true));
      final reduced = progress();
      await tester.pump(const Duration(seconds: 1));
      expect(progress(), reduced);
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('visual color picker previews a color and saves only on Apply', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final semantics = tester.ensureSemantics();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: AppearanceScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Palettes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Primary'));
    await tester.pumpAndSettle();
    expect(find.byType(ColorPicker), findsOneWidget);
    final before = container.read(themeControllerProvider).colors.first;
    await tester.ensureVisible(find.bySemanticsLabel('Color ffffff'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Color ffffff'));
    await tester.pumpAndSettle();
    expect(container.read(themeControllerProvider).colors.first, before);
    await tester.tap(find.text('Apply color'));
    await tester.pumpAndSettle();
    expect(container.read(themeControllerProvider).colors.first, Colors.white);
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
    semantics.dispose();
  });
}
