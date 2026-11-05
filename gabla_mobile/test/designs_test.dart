import 'package:visibility_detector/visibility_detector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/home/presentation/design_launcher.dart';
import 'package:gabla_mobile/features/settings/data/theme_preferences_store.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';

void main() {
  setUp(
    () => VisibilityDetectorController.instance.updateInterval = Duration.zero,
  );
  for (final width in [320.0, 430.0]) {
    for (final style in AppThemeStyle.values) {
      testWidgets(
        '${style.name} fits $width with large text and reduced motion',
        (tester) async {
          tester.view.physicalSize = Size(width, 1000);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await tester.pumpWidget(
            MaterialApp(
              home: MediaQuery(
                data: MediaQueryData(
                  size: Size(width, 1000),
                  textScaler: const TextScaler.linear(1.3),
                  disableAnimations: true,
                ),
                child: Scaffold(
                  body: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: DesignLauncher(style: style),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.text('Shop'), findsOneWidget);
        },
      );
    }
  }
  test('each design retains an independent custom palette', () async {
    SharedPreferences.setMockInitialValues({});
    final store = ThemePreferencesStore();
    final pref = ThemePreferences.defaults.copyWith(
      palettes: {
        'gabla': [0xFF123456, 0xFF654321, 0xFFFFFFFF],
        'orbit': [0xFF006655, 0xFFFFAA00, 0xFFF0FFF0],
      },
    );
    await store.write(pref);
    final restored = await store.read();
    expect(restored.colors.first.toARGB32(), 0xFF123456);
    expect(
      restored.copyWith(style: AppThemeStyle.orbit).colors.first.toARGB32(),
      0xFF006655,
    );
    expect(
      restored.copyWith(style: AppThemeStyle.editorial).colors,
      AppThemeStyle.editorial.previewSwatches,
    );
  });
}
