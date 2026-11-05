import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gabla_mobile/core/location/google_location_service.dart';
import 'package:gabla_mobile/core/location/google_place_picker.dart';
import 'package:gabla_mobile/core/network/network_providers.dart';
import 'package:gabla_mobile/core/sharing/share_links.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/community/presentation/community_editor_screen.dart';
import 'package:gabla_mobile/features/community/presentation/community_location_input.dart';
import 'package:gabla_mobile/features/ride/domain/ride_location.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'community_test.dart' as fixtures;

class FakePlaces extends GoogleLocationService {
  @override
  Future<List<PlaceSuggestion>> suggestions(
    String query,
    String session,
  ) async => [
    const PlaceSuggestion(id: 'garden', label: 'Garden venue, Kampala'),
  ];
  @override
  Future<RideLocation> place(String id, String session) async =>
      const RideLocation(
        lat: .34,
        lng: 32.58,
        address: 'Garden venue, Kampala',
      );
  @override
  Future<RideLocation> geocode(String query) async =>
      RideLocation(lat: .34, lng: 32.58, address: query);
}

class CaptureApi extends fixtures.FixtureApi {
  Map<String, dynamic>? body;
  @override
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async =>
      ({
            ...fixtures.post(true),
            'canManage': true,
            'media': [
              {'type': 'image', 'url': 'https://example.test/poster.jpg'},
            ],
            'lat': .3,
            'lng': 32.5,
          }
          as T);
  @override
  Future<T> patch<T>(String path, {Object? body}) async {
    this.body = Map<String, dynamic>.from(body as Map);
    return {'id': 'event'} as T;
  }
}

void main() {
  test(
    'every shared type resolves to its corresponding native detail screen',
    () {
      for (final kind in sharedKinds) {
        final uri = gablaShareUrl(kind, 'fixture');
        expect(uri.host, 'gogabla.com');
        expect(
          sharedDestination(uri),
          kind == 'job'
              ? '/jobs/p/fixture'
              : kind == 'event'
              ? '/events/p/fixture'
              : '/shop/product/fixture',
        );
        expect(
          sharedDestination(Uri.parse('gabla:///share/$kind/fixture')),
          isNotNull,
        );
      }
      expect(sharedDestination(Uri.parse('/share/unknown/fixture')), isNull);
      expect(() => gablaShareUrl('job', '../secret'), throwsArgumentError);
    },
  );
  testWidgets(
    'location supports autocomplete selection and opening the map picker',
    (tester) async {
      final controller = TextEditingController();
      RideLocation? selected;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            googleLocationServiceProvider.overrideWithValue(FakePlaces()),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: CommunityLocationInput(
                controller: controller,
                event: true,
                onSelected: (v) => selected = v,
              ),
            ),
          ),
        ),
      );
      await tester.enterText(
        find.byKey(const ValueKey('community-location-search')),
        'Garden',
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      expect(find.text('Garden venue, Kampala'), findsOneWidget);
      await tester.tap(find.text('Garden venue, Kampala'));
      await tester.pumpAndSettle();
      expect(selected?.lat, .34);
      expect(controller.text, 'Garden venue, Kampala');
      await tester.tap(find.byKey(const ValueKey('community-pick-map')));
      await tester.pumpAndSettle();
      expect(find.byType(GooglePlacePicker), findsOneWidget);
      await tester.tap(find.byTooltip('Close location picker'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
  testWidgets(
    'editing an address clears stale coordinates and retains the complete post payload',
    (tester) async {
      final api = CaptureApi();
      final router = GoRouter(
        initialLocation: '/edit',
        routes: [
          GoRoute(
            path: '/edit',
            builder: (_, __) =>
                const CommunityEditorScreen(kind: 'events', id: 'event'),
          ),
          GoRoute(
            path: '/events/mine',
            builder: (_, __) => const Scaffold(body: Text('Submitted fixture')),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            sessionControllerProvider.overrideWith(fixtures.SignedIn.new),
            themeControllerProvider.overrideWith(
              () => fixtures.FixedTheme(AppThemeStyle.orbit),
            ),
            googleLocationServiceProvider.overrideWithValue(FakePlaces()),
          ],
          child: MaterialApp.router(
            theme: AppTheme.resolve(AppThemeStyle.orbit, Brightness.light),
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('community-tab-2')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('community-location-search')),
      );
      await tester.enterText(
        find.byKey(const ValueKey('community-location-search')),
        'A complete new address, Kampala',
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump();
      await tester.tap(find.text('Submit for review'));
      await tester.pumpAndSettle();
      expect(api.body?['address'], 'A complete new address, Kampala');
      expect(api.body?['lat'], isNull);
      expect(api.body?['lng'], isNull);
      expect((api.body?['media'] as List).length, 1);
      expect(find.text('Submitted fixture'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
    },
  );
}
