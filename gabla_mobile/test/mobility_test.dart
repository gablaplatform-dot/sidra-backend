import 'dart:io';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/location/journey_map.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/ride/application/ride_flow_controller.dart';
import 'package:gabla_mobile/features/ride/domain/ride_estimate.dart';
import 'package:gabla_mobile/features/ride/domain/ride_trip.dart';
import 'package:gabla_mobile/features/ride/presentation/ride_screen.dart';
import 'package:gabla_mobile/features/bus/application/bus_providers.dart';
import 'package:gabla_mobile/features/bus/application/bus_checkout_controller.dart';
import 'package:gabla_mobile/features/bus/data/bus_repository.dart';
import 'package:gabla_mobile/features/bus/domain/bus_trip.dart';
import 'package:gabla_mobile/features/bus/domain/bus_ticket.dart';
import 'package:gabla_mobile/features/ride/data/ride_repository.dart';
import 'package:gabla_mobile/features/ride/application/ride_providers.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_home_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_search_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_trip_screen.dart';

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class _Ride extends RideFlowController {
  _Ride(this.stage);
  final RideStage stage;
  @override
  RideFlowState build() => RideFlowState(
    stage: stage,
    vehicleType: 'car',
    estimates: const {
      'car': RideEstimate(fare: 18000, distanceKm: 8.2, durationMin: 24),
      'boda': RideEstimate(fare: 7000, distanceKm: 8.2, durationMin: 18),
    },
    trip: stage.index > 1
        ? const RideTrip(
            id: 'demo',
            status: 'matched',
            vehicleType: 'car',
            estimatedFare: 18000,
            driver: RideDriver(
              name: 'Grace',
              vehicleModel: 'Toyota Corolla',
              licensePlate: 'UBG 124K',
              ratingAvg: 4.9,
            ),
          )
        : null,
  );
}

final trip = BusTrip(
  id: 'trip',
  originName: 'Kampala',
  destinationName: 'Fort Portal',
  departAt: DateTime.utc(2026, 11, 4, 5),
  price: 35000,
  companyName: 'Gabla Travel',
  seatsAvailable: 14,
  bookable: true,
  durationMinutes: 270,
  boardingPoint: 'Kisenyi Bus Terminal',
  ticketTypes: const [
    BusTicketType(id: 'standard', name: 'Standard', price: 35000),
  ],
  amenities: const ['Air conditioning', 'USB charging'],
);
ApiClient api() => ApiClient(
  getToken: () => null,
  onTokenRenewed: (_) {},
  onUnauthorized: () {},
);

class _Bus extends BusRepository {
  _Bus() : super(api());
  int submissions = 0;
  Map<String, dynamic>? submittedBody;
  bool offline = false;
  String status = 'pending_payment';
  @override
  Future<Map<String, dynamic>> createBooking(Map<String, dynamic> body) async {
    submittedBody = body;
    submissions++;
    return {'bookingId': 'booking', 'reference': 'GAB123', 'total': '35000'};
  }

  @override
  Future<Map<String, dynamic>> fetchBooking(String id) async {
    if (offline) throw StateError('offline');
    return {'id': id, 'status': status, 'expired': false, 'tickets': []};
  }
}

class _RejectCancel extends RideRepository {
  _RejectCancel() : super(api());
  @override
  Future<void> cancelTrip(String tripId) async =>
      throw StateError('Connection interrupted');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    for (final entry in {
      'Inter': 'Inter.ttf',
      'Manrope': 'Manrope.ttf',
      'DM Serif Display': 'DMSerifDisplay-Regular.ttf',
      'MaterialIcons': null,
    }.entries) {
      final loader = FontLoader(entry.key)
        ..addFont(
          rootBundle.load(
            entry.value == null
                ? 'fonts/MaterialIcons-Regular.otf'
                : 'assets/fonts/${entry.value}',
          ),
        );
      await loader.load();
    }
  });
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  test('bus scheduled and popular DTOs follow the actual server contract', () {
    final t = BusTrip.fromJson({
      'id': 't',
      'departureAt': '2026-11-04T05:30:00Z',
      'priceFrom': '35000',
      'seatsLeft': 12,
      'bookable': true,
      'route': {
        'originName': 'Kampala',
        'destinationName': 'Gulu',
        'durationMinutes': 300,
      },
      'ticketTypes': [
        {'id': 'a', 'name': 'Adult', 'price': '35000'},
      ],
    });
    expect(t.departAtEat.hour, 8);
    expect(t.departAtEat.minute, 30);
    expect(t.price, 35000);
    expect(t.seatsAvailable, 12);
    expect(t.ticketTypes.first.id, 'a');
    expect(t.bookable, true);
    final popular = BusTrip.fromJson({
      'from': 'Kampala',
      'to': 'Gulu',
      'minPrice': '25000',
    });
    expect(popular.id, '');
    expect(popular.originName, 'Kampala');
    expect(popular.price, 25000);
    expect(normalizeBusPhone('+256 772 123456'), '256772123456');
    expect(normalizeBusPhone('0772123456'), '256772123456');
    expect(normalizeBusPhone('123'), '');
  });
  test(
    'ticket endpoints flatten bookings and parse detail envelope with EAT',
    () async {
      final booking = {
        'status': 'confirmed',
        'trip': {
          'departureAt': '2026-11-04T05:30:00Z',
          'route': {'originName': 'Kampala', 'destinationName': 'Gulu'},
        },
        'tickets': [
          {
            'ticketNumber': 'G123',
            'seatNumber': 4,
            'passengerName': 'Grace',
            'status': 'issued',
          },
        ],
      };
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) => h.resolve(
              Response(
                requestOptions: o,
                data: {
                  'data': o.path == '/bus/my-tickets'
                      ? {
                          'upcoming': [booking],
                          'past': [],
                        }
                      : {
                          'ticket': (booking['tickets'] as List).first,
                          'booking': booking,
                        },
                },
              ),
            ),
          ),
        );
      final repo = BusRepository(
        ApiClient(
          dio: dio,
          getToken: () => null,
          onTokenRenewed: (_) {},
          onUnauthorized: () {},
        ),
      );
      final tickets = await repo.fetchMyTickets();
      expect(tickets.single.seatLabel, '4');
      expect(tickets.single.trip.originName, 'Kampala');
      expect((await repo.fetchTicket('G123')).departAtEat.hour, 8);
    },
  );
  test(
    'pending checkout blocks a second charge and preserves ID on polling failure',
    () async {
      final repo = _Bus();
      final c = ProviderContainer(
        overrides: [
          googleMapsConfiguredProvider.overrideWith((_) async => true),
          journeyNativeMapProvider.overrideWithValue(
            (_) => const ColoredBox(color: Color(0xff1b3b43)),
          ),
          busRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      c.read(busCheckoutProvider('trip'));
      await Future<void>.delayed(Duration.zero);
      final flow = c.read(busCheckoutProvider('trip').notifier);
      await flow.submit({'tripId': 'trip'});
      repo.offline = true;
      await flow.refresh();
      await flow.submit({'tripId': 'trip'});
      expect(repo.submissions, 1);
      expect(c.read(busCheckoutProvider('trip')).phase, 'waiting');
      expect(
        (await SharedPreferences.getInstance()).getString(
          'gabla.bus.pending.trip',
        ),
        'booking',
      );
      repo.offline = false;
      repo.status = 'confirmed';
      await flow.refresh();
      expect(c.read(busCheckoutProvider('trip')).phase, 'confirmed');
      expect(
        (await SharedPreferences.getInstance()).getString(
          'gabla.bus.pending.trip',
        ),
        isNull,
      );
    },
  );
  test(
    'checkout restores an existing pending payment without creating another',
    () async {
      SharedPreferences.setMockInitialValues({
        'gabla.bus.pending.trip': 'booking',
      });
      final repo = _Bus();
      final c = ProviderContainer(
        overrides: [
          googleMapsConfiguredProvider.overrideWith((_) async => true),
          journeyNativeMapProvider.overrideWithValue(
            (_) => const ColoredBox(color: Color(0xff1b3b43)),
          ),
          busRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(c.dispose);
      c.read(busCheckoutProvider('trip'));
      await Future<void>.delayed(Duration.zero);
      expect(c.read(busCheckoutProvider('trip')).phase, 'waiting');
      expect(repo.submissions, 0);
    },
  );
  testWidgets(
    'bus checkout validates passenger input and sends ticket types with normalized phones',
    (tester) async {
      final repo = _Bus();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            googleMapsConfiguredProvider.overrideWith((_) async => true),
            journeyNativeMapProvider.overrideWithValue(
              (_) => const ColoredBox(color: Color(0xff1b3b43)),
            ),
            themeControllerProvider.overrideWith(
              () => _Theme(AppThemeStyle.gabla),
            ),
            isSignedInProvider.overrideWithValue(true),
            tripDetailProvider.overrideWith((_, _) async => trip),
            busRepositoryProvider.overrideWithValue(repo),
          ],
          child: MaterialApp(
            home: MediaQuery(
              data: const MediaQueryData(disableAnimations: true),
              child: const BusTripScreen(tripId: 'trip'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byTooltip('Add Standard'));
      await tester.tap(find.byTooltip('Add Standard'));
      await tester.pump();
      await tester.ensureVisible(find.text('Pay UGX 35,000'));
      await tester.tap(find.text('Pay UGX 35,000'));
      await tester.pump();
      expect(repo.submissions, 0);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Full name'),
        'Grace Namuli',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Passenger phone'),
        '0772123456',
      );
      await tester.ensureVisible(find.text('Pay UGX 35,000'));
      await tester.tap(find.text('Pay UGX 35,000'));
      await tester.pumpAndSettle();
      expect(repo.submissions, 1);
      expect(repo.submittedBody, {
        'tripId': 'trip',
        'items': [
          {'ticketTypeId': 'standard', 'quantity': 1},
        ],
        'passenger': {'name': 'Grace Namuli', 'phone': '256772123456'},
        'payPhone': '256772123456',
      });
      expect(find.text('Check your phone'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );
  test(
    'a rejected ride cancellation retains the driver and active trip',
    () async {
      final c = ProviderContainer(
        overrides: [
          googleMapsConfiguredProvider.overrideWith((_) async => true),
          journeyNativeMapProvider.overrideWithValue(
            (_) => const ColoredBox(color: Color(0xff1b3b43)),
          ),
          rideFlowControllerProvider.overrideWith(() => _Ride(RideStage.live)),
          rideRepositoryProvider.overrideWithValue(_RejectCancel()),
        ],
      );
      addTearDown(c.dispose);
      await c.read(rideFlowControllerProvider.notifier).cancel();
      expect(c.read(rideFlowControllerProvider).trip?.id, 'demo');
      expect(c.read(rideFlowControllerProvider).error, isNotNull);
    },
  );
  test(
    'resumed ride coordinates and cancelled boarding passes retain backend meaning',
    () {
      final t = RideTrip.fromJson({
        'id': 'ride',
        'pickup': {'lat': .32, 'lng': 32.58, 'address': 'Kampala'},
        'dropoff': {'lat': .05, 'lng': 32.45, 'address': 'Entebbe'},
      });
      expect(t.pickup?.address, 'Kampala');
      expect(t.dropoff?.lng, 32.45);
      final pass = BusTicket.fromJson(
        {'ticketNumber': 'G123', 'status': 'issued'},
        booking: {
          'status': 'confirmed',
          'trip': {
            'status': 'cancelled',
            'departureAt': '2099-01-01T00:00:00Z',
            'route': <String, dynamic>{},
          },
        },
      );
      expect(pass.canBoard, false);
    },
  );
  for (final style in AppThemeStyle.values) {
    for (final width in [320.0, 430.0]) {
      for (final screen in [
        'ride',
        'choosing',
        'confirm',
        'live',
        'bus',
        'results',
        'checkout',
      ]) {
        testWidgets('${style.name} $screen fits $width', (tester) async {
          tester.view.physicalSize = Size(width, 940);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final page = switch (screen) {
            'bus' => const BusHomeScreen(),
            'results' => const BusSearchScreen(
              query: BusSearchQuery(
                date: '2026-11-04',
                from: 'Kampala',
                to: 'Fort Portal',
              ),
            ),
            'checkout' => const BusTripScreen(tripId: 'trip'),
            _ => const RideScreen(),
          };
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                googleMapsConfiguredProvider.overrideWith((_) async => true),
                journeyNativeMapProvider.overrideWithValue(
                  (_) => const ColoredBox(color: Color(0xff1b3b43)),
                ),
                themeControllerProvider.overrideWith(() => _Theme(style)),
                rideFlowControllerProvider.overrideWith(
                  () => _Ride(switch (screen) {
                    'choosing' => RideStage.choosing,
                    'confirm' => RideStage.confirming,
                    'live' => RideStage.live,
                    _ => RideStage.setup,
                  }),
                ),
                popularRoutesProvider.overrideWith((_) async => [trip]),
                busPlacesProvider.overrideWith(
                  (_) async => {
                    'origins': ['Kampala'],
                    'destinations': ['Fort Portal'],
                  },
                ),
                busSearchResultsProvider.overrideWith((_, _) async => [trip]),
                tripDetailProvider.overrideWith((_, _) async => trip),
                busRepositoryProvider.overrideWithValue(_Bus()),
              ],
              child: MaterialApp(
                theme: AppTheme.resolve(style, Brightness.light),
                home: MediaQuery(
                  data: MediaQueryData(
                    size: Size(width, 940),
                    textScaler: const TextScaler.linear(1.2),
                    disableAnimations: true,
                  ),
                  child: RepaintBoundary(
                    key: const ValueKey('capture'),
                    child: page,
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          if (const bool.fromEnvironment('MOBILITY_PREVIEWS') &&
              width == 430 &&
              ['ride', 'bus', 'choosing', 'checkout'].contains(screen)) {
            await tester.runAsync(() async {
              final boundary = tester.renderObject<RenderRepaintBoundary>(
                find.byKey(const ValueKey('capture')),
              );
              final image = await boundary.toImage(pixelRatio: 1);
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              await File(
                '/tmp/gabla-${style.name}-$screen.png',
              ).writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }
          if (screen == 'ride') expect(find.text('See fares'), findsOneWidget);
          if (screen == 'bus') expect(find.text('Find my bus'), findsOneWidget);
          await tester.pumpWidget(const SizedBox.shrink());
          await tester.pump();
        });
      }
    }
  }
}
