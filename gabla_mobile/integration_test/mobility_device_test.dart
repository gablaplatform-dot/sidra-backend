import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:gabla_mobile/app.dart';
import 'package:gabla_mobile/core/router/app_router.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/background_motion.dart';
import 'package:gabla_mobile/features/ride/presentation/ride_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_home_screen.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('all five ride and bus designs run in the Android app', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: GablaApp()));
    await tester.pump(const Duration(seconds: 3));
    final container = ProviderScope.containerOf(
      tester.element(find.byType(GablaApp)),
    );
    expect(await container.read(googleMapsConfiguredProvider.future), true);
    final studio = container.read(themeControllerProvider.notifier);
    studio.setMotion(BackgroundMotion.none);
    final router = container.read(appRouterProvider);
    for (final style in AppThemeStyle.values) {
      studio.setStyle(style);
      router.go('/ride');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(seconds: 2));
      expect(find.byType(RideScreen), findsOneWidget);
      expect(find.text('See fares'), findsOneWidget);
      expect(tester.takeException(), isNull);
      router.go('/bus');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(seconds: 2));
      expect(find.byType(BusHomeScreen), findsOneWidget);
      expect(find.text('Find my bus'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 1));
  });
}
