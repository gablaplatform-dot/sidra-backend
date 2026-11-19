import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/bus/application/bus_providers.dart';
import 'package:gabla_mobile/features/bus/domain/bus_booking.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_tickets_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';

class FixedBusTheme extends ThemeController {
  FixedBusTheme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(
    style: style,
  );
}

BusBooking fixture({bool locked = false}) => BusBooking.fromJson({
  'id': 'b1',
  'reference': 'GB-TEST',
  'status': 'confirmed',
  'passengerName': 'Passenger',
  'seatCount': 2,
  'total': '80000',
  'canCancel': !locked,
  'lockedAt': locked ? DateTime.now().toIso8601String() : null,
  'cancellationClosesAt': DateTime.now()
      .add(const Duration(hours: 2))
      .toIso8601String(),
  'trip': {
    'departureAt': DateTime.now()
        .add(const Duration(hours: 4))
        .toIso8601String(),
    'route': {
      'originName': 'Kampala',
      'destinationName': 'Gulu',
      'boardingPoint': 'Kisenyi Bus Terminal',
    },
  },
  'operator': {'companyName': 'Uganda Coaches'},
  'tickets': [],
});
void main() {
  setUpAll(() {VisibilityDetectorController.instance.updateInterval=Duration.zero;});
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'booking parser preserves grouping and checks the deadline on the device',
    () {
      final b = fixture();
      expect(b.seatCount, 2);
      expect(b.cancellableAt(DateTime.now()), true);
      expect(b.cancellableAt(b.cancellationClosesAt!), false);
      expect(fixture(locked: true).cancellableAt(DateTime.now()), false);
    },
  );
  test('countdown handles days, hours and departure boundary', () {
    final n = DateTime.utc(2026, 11, 19);
    expect(
      busDepartureCountdown(n.add(const Duration(days: 2, hours: 3)), n),
      '2d 3h until departure',
    );
    expect(
      busDepartureCountdown(n.add(const Duration(minutes: 65)), n),
      '1h 5m until departure',
    );
    expect(
      busDepartureCountdown(n.subtract(const Duration(seconds: 1)), n),
      'Departure time reached',
    );
  });
  for (final style in AppThemeStyle.values) {
    testWidgets('grouped bus booking fits ${style.name} at narrow width', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 1100);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            themeControllerProvider.overrideWith(() => FixedBusTheme(style)),
            isSignedInProvider.overrideWithValue(true),
            myBusBookingsProvider.overrideWith((ref) async => [fixture()]),
            busPassengerMessagesProvider.overrideWith((ref) async => []),
          ],
          child: MaterialApp(
            theme: AppTheme.resolve(style, Brightness.light),
            home: const BusTicketsScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('GB-TEST'), findsOneWidget);
      expect(find.text('Cancellation available'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Cancel booking'),
        100,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Cancel booking'));
      await tester.pumpAndSettle();
      expect(find.text('Cancel this journey?'), findsOneWidget);
      expect(find.textContaining('Cancel 2 ticket(s)'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
  testWidgets('locked booking has policy copy and no cancellation action', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          myBusBookingsProvider.overrideWith(
            (ref) async => [fixture(locked: true)],
          ),
          busPassengerMessagesProvider.overrideWith((ref) async => []),
        ],
        child: MaterialApp(home: const BusTicketsScreen()),
      ),
    );
    await tester.pump();
    await tester.pumpAndSettle();
    expect(find.text('Cancellation period closed'), findsOneWidget);
    expect(find.text('Cancel booking'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
