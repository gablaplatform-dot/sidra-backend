import 'package:gabla_mobile/features/ride/application/ride_providers.dart';
import 'package:gabla_mobile/features/ride/data/device_location_service.dart';
import 'package:gabla_mobile/features/ride/domain/ride_location.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/nearby/application/nearby_controller.dart';
import 'package:gabla_mobile/features/nearby/data/nearby_repository.dart';
import 'package:gabla_mobile/features/nearby/domain/nearby_result.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_map.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_screen.dart';
import 'package:gabla_mobile/features/nearby/presentation/nearby_entry.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';

class _Session extends SessionController {
  @override
  Future<Session?> build() async => null;
}

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() =>
      ThemePreferences(style: style, mode: ThemeMode.light);
}

class _WithResults extends NearbyController {
  @override
  NearbyState build() => NearbyState(
    query: 'phones',
    selectedId: 'a',
    result: AsyncData(
      NearbyResponse.fromJson({
        'items': [
          {
            'id': 'a',
            'name': 'Phone repair near you',
            'type': 'service',
            'price': '5000',
            'distanceKm': 1.2,
            'provider': {
              'id': 'provider',
              'businessName': 'Example repair shop',
            },
            'pin': {'lat': .35, 'lng': 32.58},
          },
          {
            'id': 'b',
            'name': 'Mobile phone',
            'type': 'product',
            'price': '250000',
            'distanceKm': 1.2,
            'provider': {'id': 'provider', 'businessName': 'Example shop'},
            'pin': {'lat': .35, 'lng': 32.58},
          },
        ],
        'total': 2,
        'widened': true,
      }),
    ),
  );
}

Widget _fakeNativeMap(NearbyMapConfiguration configuration) {
  expect(configuration.mapType, gm.MapType.satellite);
  return ColoredBox(
    key: const ValueKey('google-map-test-surface'),
    color: Colors.blueGrey,
    child: Center(
      child: Wrap(
        children: [
          for (final marker in configuration.markers)
            GestureDetector(
              onTap: marker.onTap,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Text(marker.infoWindow.snippet?.split(' ').first ?? ''),
              ),
            ),
        ],
      ),
    ),
  );
}

class _DeniedLocation extends DeviceLocationService {
  @override
  Future<RideLocation> currentLocation() async => throw StateError('Denied');
}

class _Repository extends NearbyRepository {
  _Repository()
    : super(
        ApiClient(
          getToken: () => null,
          onTokenRenewed: (_) {},
          onUnauthorized: () {},
        ),
      );
  final requests = <String, Completer<NearbyResponse>>{};
  @override
  Future<NearbyResponse> search({
    required String query,
    required NearbyOrigin origin,
    String? type,
  }) => (requests[query] = Completer<NearbyResponse>()).future;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'parses approximate pins, preserves missing pins, and groups co-located matches',
    () {
      final response = NearbyResponse.fromJson({
        'items': [
          {
            'id': 'a',
            'name': 'Phones',
            'price': '500',
            'pin': {'lat': .35, 'lng': 32.58},
          },
          {
            'id': 'b',
            'name': 'Phone repair',
            'type': 'service',
            'matchedBy': 'related',
            'pin': {'lat': .35, 'lng': 32.58},
          },
          {'id': 'c', 'name': 'Unmapped listing', 'pin': null},
        ],
        'total': 3,
        'centre': {'lat': .34, 'lng': 32.58},
        'widened': true,
      });
      expect(response.items.first.product.price, 500);
      expect(response.items[1].related, isTrue);
      expect(response.items.last.pin, isNull);
      expect(groupNearbyPins(response.items).values.single.length, 2);
      expect(parsePoint({'lat': double.nan, 'lng': 32}), isNull);
      expect(parsePoint({'lat': 91, 'lng': 32}), isNull);
      expect(response.widened, isTrue);
    },
  );
  test('stale requests cannot replace a newer query result', () async {
    final repository = _Repository();
    final container = ProviderContainer(
      overrides: [
        nearbyRepositoryProvider.overrideWithValue(repository),
        sessionControllerProvider.overrideWith(_Session.new),
      ],
    );
    final subscription = container.listen(nearbyControllerProvider, (_, _) {});
    final notifier = container.read(nearbyControllerProvider.notifier);
    notifier.setQuery('phones');
    final first = notifier.search();
    notifier.setQuery('salon');
    final second = notifier.search();
    repository.requests['salon']!.complete(const NearbyResponse(total: 9));
    await second;
    repository.requests['phones']!.complete(const NearbyResponse(total: 2));
    await first;
    expect(container.read(nearbyControllerProvider).query, 'salon');
    expect(container.read(nearbyControllerProvider).result.value!.total, 9);
    notifier.setQuery('p');
    await notifier.search();
    expect(repository.requests.length, 2);
    expect(container.read(nearbyControllerProvider).items, isEmpty);
    subscription.close();
    container.dispose();
  });
  test(
    'denied GPS keeps the fallback and never claims a user position',
    () async {
      final container = ProviderContainer(
        overrides: [
          sessionControllerProvider.overrideWith(_Session.new),
          deviceLocationServiceProvider.overrideWithValue(_DeniedLocation()),
        ],
      );
      final subscription = container.listen(
        nearbyControllerProvider,
        (_, _) {},
      );
      await container.read(nearbyControllerProvider.notifier).useMyLocation();
      final state = container.read(nearbyControllerProvider);
      expect(state.origin.isGps, isFalse);
      expect(state.origin.label, 'Around Kampala');
      expect(state.locating, isFalse);
      expect(state.notice, contains('Location unavailable'));
      subscription.close();
      container.dispose();
    },
  );
  test('account district is retained without inventing a GPS position', () {
    final user = AppUser.fromJson({
      'id': 'u',
      'name': 'A',
      'email': '',
      'profile': {'district': 'Wakiso'},
    });
    expect(AppUser.fromJson(user.toJson()).district, 'Wakiso');
    const origin = NearbyOrigin(label: 'Around Wakiso', district: 'Wakiso');
    expect(origin.query, {'around': 'Wakiso'});
    expect(origin.isGps, isFalse);
    expect(NearbyOrigin.kampala.query['radiusKm'], 15);
  });
  testWidgets(
    'missing native key keeps nearby results usable without a platform map',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            themeControllerProvider.overrideWith(
              () => _Theme(AppThemeStyle.discover),
            ),
            nearbyControllerProvider.overrideWith(_WithResults.new),
            googleMapsConfiguredProvider.overrideWith((ref) async => false),
            nearbyNativeMapBuilderProvider.overrideWithValue(
              (_) => throw StateError(
                'Native map must not initialize without a key',
              ),
            ),
          ],
          child: const MaterialApp(home: NearbyScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Map unavailable right now'), findsOneWidget);
      expect(find.text('Phone repair near you'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final style in AppThemeStyle.values) {
    testWidgets(
      '${style.name} nearby screen fits a narrow phone with enlarged text',
      (tester) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => _Theme(style)),
              nearbyControllerProvider.overrideWith(_WithResults.new),
              googleMapsConfiguredProvider.overrideWith((ref) async => true),
              nearbyNativeMapBuilderProvider.overrideWithValue(_fakeNativeMap),
            ],
            child: MaterialApp(
              home: MediaQuery(
                data: const MediaQueryData(
                  size: Size(320, 800),
                  textScaler: TextScaler.linear(1.3),
                  disableAnimations: true,
                ),
                child: const NearbyScreen(),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('google-map-test-surface')),
          findsOneWidget,
        );
        expect(find.byTooltip('Use my location'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('2'));
        await tester.pumpAndSettle();
        final container = ProviderScope.containerOf(
          tester.element(find.byType(NearbyScreen)),
        );
        expect(container.read(nearbyControllerProvider).selectedId, 'b');
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
      },
    );
    testWidgets('${style.name} nearby entry fits a narrow phone', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 800),
              textScaler: TextScaler.linear(1.3),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: NearbyEntry(style: style),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }
}
