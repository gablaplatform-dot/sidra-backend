import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:gabla_mobile/core/location/google_location_service.dart';
import 'package:gabla_mobile/core/location/google_place_picker.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'real Android key, places, geocoding, routes and satellite tiles',
    (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(
        await container.read(googleMapsConfiguredProvider.future),
        true,
        reason: 'The APK must contain the native Android configuration.',
      );
      const service = GoogleLocationService();
      final origin = await service.geocode('Kampala, Uganda');
      expect(origin.lat, inInclusiveRange(-2, 5));
      expect(origin.lng, inInclusiveRange(29, 36));
      final reverse = await service.reverse(origin.lat, origin.lng);
      expect(reverse.address, isNotEmpty);
      final session = 'integration-${DateTime.now().millisecondsSinceEpoch}';
      final suggestions = await service.suggestions('Kampala', session);
      expect(suggestions, isNotEmpty);
      final place = await service.place(suggestions.first.id, session);
      expect(place.address, isNotEmpty);
      final destination = await service.geocode('Entebbe, Uganda');
      final route = await service.route(origin, destination);
      expect(route.distanceMeters, greaterThan(1000));
      expect(route.polyline.length, greaterThan(20));
      final created = Completer<gm.GoogleMapController>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: gm.GoogleMap(
              initialCameraPosition: gm.CameraPosition(
                target: gm.LatLng(origin.lat, origin.lng),
                zoom: 15,
              ),
              mapType: gm.MapType.satellite,
              onMapCreated: created.complete,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              markers: {
                gm.Marker(
                  markerId: const gm.MarkerId('kampala'),
                  position: gm.LatLng(origin.lat, origin.lng),
                  infoWindow: const gm.InfoWindow(title: 'Kampala test pin'),
                ),
              },
            ),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      final controller = await created.future.timeout(
        const Duration(seconds: 30),
      );
      await Future<void>.delayed(const Duration(seconds: 7));
      await tester.pump();
      final visible = await controller.getVisibleRegion();
      expect(visible.southwest.latitude, lessThan(visible.northeast.latitude));
      final png = await controller.takeSnapshot();
      expect(png, isNotNull);
      expect(
        png!.length,
        greaterThan(20000),
        reason:
            'Satellite tiles should contain image detail, not an empty map.',
      );
      final path = '${Directory.systemTemp.path}/gabla-satellite-emulator.png';
      await File(path).writeAsBytes(png);
      binding.reportData = {
        'configured': true,
        'geocoding': true,
        'reverseGeocoding': true,
        'placesAutocomplete': true,
        'placeDetails': true,
        'roadRoute': true,
        'snapshot': path,
      };
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: GooglePlacePicker(title: 'Emulator location check'),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 2));
      await tester.enterText(find.byType(TextField), 'Kampala');
      await tester.pump(const Duration(seconds: 1));
      await Future<void>.delayed(const Duration(seconds: 3));
      await tester.pump();
      expect(find.byType(ListTile), findsWidgets);
      await tester.tap(find.byType(ListTile).first);
      await tester.pump(const Duration(seconds: 1));
      await Future<void>.delayed(const Duration(seconds: 3));
      await tester.pump();
      final useButton = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Use this location'),
      );
      expect(
        useButton.onPressed,
        isNotNull,
        reason:
            'Selecting a real Google place must enable location confirmation.',
      );
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
    },
  );
}
