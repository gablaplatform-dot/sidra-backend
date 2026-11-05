import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:gabla_mobile/app.dart';
import 'package:gabla_mobile/core/router/app_router.dart';
import 'package:gabla_mobile/core/location/journey_map.dart';
import 'package:gabla_mobile/core/location/map_mode.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/background_motion.dart';
import 'package:gabla_mobile/features/ride/presentation/ride_screen.dart';
import 'package:gabla_mobile/features/services/presentation/services_screen.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  gm.GoogleMapController? controller;
  int mapsCreated = 0;
  testWidgets(
    'native map, modes, draggable ride controls, five designs and services',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            journeyNativeMapProvider.overrideWithValue(
              (map) => gm.GoogleMap(
                initialCameraPosition: map.initialCameraPosition,
                mapType: map.mapType,
                padding: map.padding,
                markers: map.markers,
                polylines: map.polylines,
                onTap: map.onTap,
                gestureRecognizers: map.gestureRecognizers,
                mapToolbarEnabled: map.mapToolbarEnabled,
                zoomControlsEnabled: map.zoomControlsEnabled,
                compassEnabled: map.compassEnabled,
                myLocationButtonEnabled: map.myLocationButtonEnabled,
                onMapCreated: (c) {
                  controller = c;
                  mapsCreated++;
                  map.onMapCreated?.call(c);
                },
              ),
            ),
          ],
          child: const GablaApp(),
        ),
      );
      await tester.pump(const Duration(seconds: 3));
      final container = ProviderScope.containerOf(
        tester.element(find.byType(GablaApp)),
      );
      expect(await container.read(googleMapsConfiguredProvider.future), true);
      container
          .read(themeControllerProvider.notifier)
          .setMotion(BackgroundMotion.none);
      container.read(mapModeProvider.notifier).select(gm.MapType.satellite);
      final router = container.read(appRouterProvider);
      final snapshots = <String, String>{};
      for (final style in AppThemeStyle.values) {
        container.read(themeControllerProvider.notifier).setStyle(style);
        final previous = mapsCreated;
        router.go('/ride');
        await tester.pump();
        await tester.pump(const Duration(seconds: 2));
        for (var n = 0; n < 20 && mapsCreated == previous; n++) {
          await tester.pump(const Duration(milliseconds: 250));
        }
        expect(find.byType(RideScreen), findsOneWidget);
        expect(find.byType(gm.GoogleMap), findsOneWidget);
        expect(find.byType(DraggableScrollableSheet), findsOneWidget);
        expect(mapsCreated, greaterThan(previous));
        expect(
          tester.widget<gm.GoogleMap>(find.byType(gm.GoogleMap)).mapType,
          gm.MapType.satellite,
        );
        if (style == AppThemeStyle.gabla) {
          await Future<void>.delayed(const Duration(seconds: 8));
          await tester.pump();
          final png = await controller!.takeSnapshot();
          expect(png, isNotNull);
          expect(png!.length, greaterThan(20000));
          snapshots['native-satellite-map'] = base64Encode(png);
          await tester.tap(find.byTooltip('Change map type'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Road'));
          await tester.pump();
          expect(
            tester.widget<gm.GoogleMap>(find.byType(gm.GoogleMap)).mapType,
            gm.MapType.normal,
          );
          await tester.tap(find.byTooltip('Change map type'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Satellite'));
          await tester.pump();
        }
        await tester.drag(find.text('Where to next?'), const Offset(0, -120));
        await tester.pump(const Duration(seconds: 1));
        expect(find.byType(gm.GoogleMap), findsOneWidget);
        expect(tester.takeException(), isNull);
        if (style == AppThemeStyle.gabla) {
          await binding.convertFlutterSurfaceToImage();
          await tester.pump();
        }
        await binding.takeScreenshot('ride-${style.name}');
        router.go('/services');
        await tester.pump();
        await tester.pump(const Duration(seconds: 3));
        expect(find.byType(ServicesScreen), findsOneWidget);
        expect(tester.takeException(), isNull);
        await binding.takeScreenshot('services-${style.name}');
      }
      binding.reportData ??= <String, dynamic>{};
      binding.reportData!['nativeMapSnapshots'] = snapshots;
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 1));
    },
  );
}
