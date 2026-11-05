import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/core/motion/design_transitions.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/presentation/appearance_screen.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  testWidgets(
    'offscreen card waits, reveals on scroll, and replays on return',
    (tester) async {
      final scroll = ScrollController();
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                controller: scroll,
                child: const Column(
                  children: [
                    SizedBox(height: 1100),
                    DesignEntrance(
                      child: SizedBox(height: 150, child: Text('Reveal me')),
                    ),
                    SizedBox(height: 1100),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      double opacity() => tester
          .widget<Opacity>(
            find
                .ancestor(
                  of: find.text('Reveal me'),
                  matching: find.byType(Opacity),
                )
                .first,
          )
          .opacity;
      expect(opacity(), 0);
      scroll.jumpTo(1000);
      await tester.pump();
      VisibilityDetectorController.instance.notifyNow();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(opacity(), greaterThan(0));
      expect(opacity(), lessThan(1));
      await tester.pumpAndSettle();
      expect(opacity(), 1);
      scroll.jumpTo(0);
      await tester.pumpAndSettle();
      expect(opacity(), 0);
      scroll.jumpTo(1000);
      await tester.pumpAndSettle();
      expect(opacity(), 1);
      await tester.pumpWidget(const SizedBox());
      scroll.dispose();
    },
  );
  testWidgets(
    'palette choice changes colors without selecting a different layout',
    (tester) async {
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
      await tester.ensureVisible(find.text('Ocean'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ocean'));
      await tester.pumpAndSettle();
      final preferences = container.read(themeControllerProvider);
      expect(preferences.style, AppThemeStyle.gabla);
      expect(preferences.colors.first, const Color(0xFF075A69));
      await tester.tap(find.text('Designs'));
      await tester.pumpAndSettle();
      expect(find.text('Layout design'), findsOneWidget);
      expect(find.text('Ocean'), findsNothing);
    },
  );
}
