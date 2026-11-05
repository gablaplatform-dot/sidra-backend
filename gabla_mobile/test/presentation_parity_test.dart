import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:video_player_platform_interface/video_player_platform_interface.dart';
import 'package:gabla_mobile/core/media/sound_video_screen.dart';
import 'package:gabla_mobile/core/location/map_mode.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/network/network_providers.dart';
import 'package:gabla_mobile/core/router/app_router.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/auth/presentation/login_screen.dart';
import 'package:gabla_mobile/features/auth/presentation/welcome_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_onboarding_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_operator_portal_screen.dart';
import 'package:gabla_mobile/features/bus/presentation/bus_route_editor.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/categories/presentation/category_detail_screen.dart';
import 'package:gabla_mobile/features/profile/presentation/profile_screen.dart';
import 'package:gabla_mobile/features/provider/presentation/listing_form_screen.dart';
import 'package:gabla_mobile/features/provider/presentation/provider_onboarding_screen.dart';
import 'package:gabla_mobile/features/search/application/search_providers.dart';
import 'package:gabla_mobile/features/search/presentation/search_results_screen.dart';
import 'package:gabla_mobile/features/services/domain/availability.dart';
import 'package:gabla_mobile/features/services/domain/booking_config.dart';
import 'package:gabla_mobile/features/services/domain/booking_selection.dart';
import 'package:gabla_mobile/features/services/presentation/booking_screen.dart';
import 'package:gabla_mobile/features/services/presentation/my_bookings_screen.dart';
import 'package:gabla_mobile/features/services/presentation/services_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/workspace/presentation/workspace_screen.dart';
import 'package:gabla_mobile/features/workspace/presentation/document_design_screen.dart';

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class _Session extends SessionController {
  @override
  Future<Session?> build() async => const Session(
    accessToken: 'fixture',
    user: AppUser(
      id: 'fixture',
      name: 'Grace',
      email: 'grace@example.test',
      roles: ['provider', 'user', 'bus_operator'],
    ),
  );
  void becomeCustomer() => state = const AsyncData(
    Session(
      accessToken: 'fixture',
      user: AppUser(
        id: 'fixture',
        name: 'Grace',
        email: 'grace@example.test',
        roles: ['user'],
      ),
    ),
  );
}

Map<String, dynamic> get _service => {
  'id': 'service',
  'name': 'A weekend by the lake',
  'type': 'service',
  'price': '50000',
  'providerId': 'business',
  'bookable': true,
  'bookingMode': 'request',
  'booking': {
    'unit': 'night',
    'inventory': 2,
    'capacity': 2,
    'advanceDays': 90,
    'minUnits': 1,
    'maxUnits': 5,
    'depositPercent': 30,
  },
};
Map<String, dynamic> get _business => {
  'id': 'business',
  'businessName': 'Lake House',
  'description': 'A quiet place for your next weekend.',
  'contact': {'phone': '0772123456'},
  'media': <String, dynamic>{},
  'location': <String, dynamic>{},
};

class FixtureApi extends ApiClient {
  FixtureApi()
    : super(
        getToken: () => null,
        onTokenRenewed: (_) {},
        onUnauthorized: () {},
      );
  final requests = <String>[];
  @override
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    requests.add(path);
    dynamic value;
    if (path == '/search') {
      value = {
        'categories': [
          {'id': 'directory', 'name': 'Accommodation'},
        ],
        'providers': [_business],
        'listings': [_service],
      };
    } else if (path == '/categories') {
      value = {
        'items': [
          {
            'id': 'directory',
            'name': 'Accommodation',
            'children': [
              {'id': 'child', 'name': 'Guest houses'},
            ],
          },
        ],
      };
    } else if (path == '/service-categories' || path == '/product-categories') {
      value = {
        'items': [
          {
            'id': 'category',
            'name': 'Guest houses',
            'effectiveListingFields': [
              {
                'key': 'rooms',
                'label': 'Rooms',
                'type': 'number',
                'required': true,
              },
            ],
          },
        ],
      };
    } else if (path == '/listings' || path == '/listings/me') {
      value = {
        'items': [_service],
      };
    } else if (path.startsWith('/listings/')) {
      value = _service;
    } else if (path == '/providers/me') {
      value = _business;
    } else if (path == '/providers/districts') {
      value = {
        'items': ['Kampala', 'Jinja'],
      };
    } else if (path == '/providers') {
      value = {
        'items': [_business],
      };
    } else if (path == '/documents/settings') {
      value = {
        'settings': {
          'brand': {'businessName': 'Lake House', 'accentColor': '#123456'},
          'quotation': {
            'title': 'Quotation',
            'prefix': 'QT',
            'validityDays': 14,
          },
          'receipt': {'title': 'Receipt', 'prefix': 'RC'},
          'tax': {'enabled': false, 'percent': 18},
          'options': {'showQrCode': true},
          'payment': {'instructions': ''},
          'email': {'sendQuotation': true},
        },
      };
    } else if (path == '/bookings/availability') {
      value = {
        'days': {
          for (var i = 0; i < 100; i++)
            bookingDate(eatToday().add(Duration(days: i))): {
              'free': 2,
              'partlyBooked': false,
            },
        },
        'slots': <dynamic>[],
      };
    } else if (path.startsWith('/bus/onboarding')) {
      value = {
        'operator': {
          'companyName': 'Gabla Travel',
          'parkName': 'Kisenyi',
          'parkDistrict': 'Kampala',
        },
        'email': 'travel@example.test',
        'questions': <dynamic>[],
        'busTypes': <dynamic>[],
      };
    } else if (path == '/bus/operator/stats') {
      value = {
        'today': {'revenue': 0, 'tickets': 0},
        'month': <String, dynamic>{},
        'walletBalance': 0,
        'upcomingTrips': 0,
      };
    } else if (path == '/payments/wallet') {
      value = {'balance': '0'};
    } else if (path == '/payments/subscription') {
      value = {'status': 'inactive', 'enabled': false};
    } else {
      value = {'items': <dynamic>[]};
    }
    return value as T;
  }

  @override
  Future<T> post<T>(String path, {Object? body}) async =>
      <String, dynamic>{} as T;
}

class _Video extends VideoPlayerPlatform {
  late final StreamController<VideoEvent> events =
      StreamController<VideoEvent>.broadcast(
        onListen: () => scheduleMicrotask(
          () => events.add(
            VideoEvent(
              eventType: VideoEventType.initialized,
              duration: const Duration(seconds: 10),
              size: const Size(640, 480),
            ),
          ),
        ),
      );
  double volume = 0;
  int played = 0, disposed = 0;
  @override
  Future<void> init() async {}
  @override
  Future<int?> createWithOptions(VideoCreationOptions options) async => 42;
  @override
  Stream<VideoEvent> videoEventsFor(int playerId) => events.stream;
  @override
  Future<void> setLooping(int playerId, bool looping) async {}
  @override
  Future<void> setVolume(int playerId, double volume) async {
    this.volume = volume;
  }

  @override
  Future<void> play(int playerId) async {
    played++;
  }

  @override
  Future<void> pause(int playerId) async {}
  @override
  Future<void> dispose(int playerId) async {
    disposed++;
    await events.close();
  }

  @override
  Future<Duration> getPosition(int playerId) async => Duration.zero;
  @override
  Future<void> seekTo(int playerId, Duration position) async {}
  @override
  Future<void> setPlaybackSpeed(int playerId, double speed) async {}
  @override
  Widget buildViewWithOptions(VideoViewOptions options) => const SizedBox();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  setUpAll(() async {
    for (final e in {
      'Inter': 'Inter.ttf',
      'Manrope': 'Manrope.ttf',
      'DM Serif Display': 'DMSerifDisplay-Regular.ttf',
      'MaterialIcons': null,
    }.entries) {
      final font = FontLoader(e.key)
        ..addFont(
          rootBundle.load(
            e.value == null
                ? 'fonts/MaterialIcons-Regular.otf'
                : 'assets/fonts/${e.value}',
          ),
        );
      await font.load();
    }
  });
  test(
    'global search preserves all three result groups and nested directory categories',
    () async {
      final api = FixtureApi();
      final c = ProviderContainer(
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      addTearDown(c.dispose);
      final result = await c.read(searchResultsProvider('Lake').future);
      expect(result.providers.single.businessName, 'Lake House');
      expect(result.categories.single.id, 'directory');
      expect(result.listings.single.bookable, true);
      final category = Category.fromJson({
        'id': 'root',
        'children': [
          {'id': 'child', 'name': 'Guest houses'},
        ],
      });
      expect(category.children.single.name, 'Guest houses');
      expect(AppUser.fromJson({'id': 'user', 'role': 'provider'}).roles, [
        'provider',
      ]);
    },
  );
  test(
    'service days are inclusive, nights exclusive, and inventory spans the whole stay',
    () {
      final now = DateTime.utc(2026, 11, 3, 6), date = DateTime(2026, 11, 4);
      final availability = Availability(
        days: {
          '2026-11-04': const DayAvailability(free: 2, partlyBooked: false),
          '2026-11-05': const DayAvailability(free: 1, partlyBooked: true),
        },
      );
      BookingSelection pick(BookingUnit unit, int quantity, int guests) =>
          evaluateBooking(
            config: BookingConfig(unit: unit, inventory: 2, capacity: 2),
            start: date,
            units: 2,
            quantity: quantity,
            guests: guests,
            availability: availability,
            now: now,
          );
      expect(bookingDate(pick(BookingUnit.day, 1, 2).endDate!), '2026-11-05');
      expect(bookingDate(pick(BookingUnit.night, 1, 2).endDate!), '2026-11-06');
      expect(pick(BookingUnit.night, 2, 2).error, contains('Only 1'));
      expect(pick(BookingUnit.day, 1, 3).error, contains('2 guests'));
      expect(eatToday(DateTime.utc(2026, 11, 3, 23)), DateTime(2026, 11, 4));
    },
  );
  test('hour booking rejects gaps and unloaded availability', () {
    final result = evaluateBooking(
      config: const BookingConfig(unit: BookingUnit.hour),
      start: DateTime(2026, 11, 4),
      units: 2,
      quantity: 1,
      guests: 1,
      availability: const Availability(),
      startTime: '10:00',
      hourly: const Availability(
        slots: [
          TimeSlot(time: '10:00', free: 1),
          TimeSlot(time: '12:00', free: 1),
        ],
      ),
      now: DateTime.utc(2026, 11, 3),
    );
    expect(result.error, isNotNull);
    expect(result.maxQuantity, 0);
    expect(
      evaluateBooking(
        config: const BookingConfig(unit: BookingUnit.day),
        start: DateTime(2026, 11, 4),
        units: 1,
        quantity: 1,
        guests: 1,
        availability: null,
        now: DateTime.utc(2026, 11, 3),
      ).error,
      contains('availability'),
    );
  });
  test(
    'bus draft payload preserves real ticket and recurring-day contracts',
    () {
      final route = emptyBusRoute()
        ..addAll({'originName': 'Kampala', 'destinationName': 'Gulu'});
      expect(validateBusRoute(route), isNull);
      final payload = busRoutePayload(route);
      expect((payload['departures'] as List).first['daysOfWeek'], [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
      ]);
      expect(payload.containsKey('id'), false);
      route['destinationName'] = 'Kampala';
      expect(validateBusRoute(route), isNotNull);
    },
  );
  test('map mode defaults to satellite and persists the user choice', () async {
    final c = ProviderContainer();
    expect(c.read(mapModeProvider), gm.MapType.satellite);
    c.read(mapModeProvider.notifier).select(gm.MapType.hybrid);
    await Future<void>.delayed(Duration.zero);
    c.dispose();
    final restored = ProviderContainer();
    addTearDown(restored.dispose);
    restored.read(mapModeProvider);
    await Future<void>.delayed(Duration.zero);
    expect(restored.read(mapModeProvider), gm.MapType.hybrid);
  });
  test(
    'authentication refresh keeps the router and pending destination alive',
    () async {
      final c = ProviderContainer(
        overrides: [sessionControllerProvider.overrideWith(_Session.new)],
      );
      addTearDown(c.dispose);
      await c.read(sessionControllerProvider.future);
      final before = c.read(appRouterProvider);
      before.go('/checkout?buy=service');
      (c.read(sessionControllerProvider.notifier) as _Session).becomeCustomer();
      await Future<void>.delayed(Duration.zero);
      expect(identical(before, c.read(appRouterProvider)), true);
      expect(
        before.routeInformationProvider.value.uri.queryParameters['buy'],
        'service',
      );
    },
  );
  testWidgets(
    'a tapped video opens with sound and releases the player when closed',
    (tester) async {
      final original = VideoPlayerPlatform.instance, video = _Video();
      VideoPlayerPlatform.instance = video;
      addTearDown(() => VideoPlayerPlatform.instance = original);
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () =>
                    openSoundVideo(context, 'https://example.test/video.mp4'),
                child: const Text('Open video'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open video'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(video.volume, 1);
      expect(video.played, greaterThan(0));
      await tester.tap(find.byTooltip('Mute'));
      await tester.pump();
      expect(video.volume, 0);
      await tester.tap(find.byTooltip('Enable sound'));
      await tester.pump();
      expect(video.volume, 1);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.byType(SoundVideoScreen), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await tester.pump();
      expect(video.disposed, 1);
    },
  );
  final pages = <String, Widget>{
    'services': const ServicesScreen(),
    'search': const SearchResultsScreen(initialQuery: 'Lake'),
    'directory': const CategoryDetailScreen(categoryId: 'directory'),
    'profile': const ProfileScreen(),
    'bookings': const MyBookingsScreen(),
    'booking': const BookingScreen(listingId: 'service'),
    'listing-form': const ListingFormScreen(),
    'wallet': const WorkspaceScreen(section: 'wallet'),
    'documents': const WorkspaceScreen(section: 'documents'),
    'document-design': const DocumentDesignScreen(),
    'business': const WorkspaceScreen(section: 'business'),
    'analytics': const WorkspaceScreen(section: 'analytics'),
    'promotions': const WorkspaceScreen(section: 'ads'),
    'operator': const BusOperatorPortalScreen(),
    'operator-invitation': const BusOnboardingScreen(token: 'fixture-invite'),
    'provider-invitation': const ProviderOnboardingScreen(),
    'welcome': const WelcomeScreen(),
    'login': const LoginScreen(),
  };
  for (final style in AppThemeStyle.values) {
    for (final entry in pages.entries) {
      testWidgets('${style.name} ${entry.key} fits a narrow phone', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => _Theme(style)),
              sessionControllerProvider.overrideWith(_Session.new),
              apiClientProvider.overrideWithValue(FixtureApi()),
            ],
            child: MaterialApp(
              theme: AppTheme.resolve(style, Brightness.light),
              home: MediaQuery(
                data: const MediaQueryData(
                  size: Size(320, 900),
                  textScaler: TextScaler.linear(1.2),
                  disableAnimations: true,
                ),
                child: entry.value,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final scrollable = find.byType(Scrollable);
        if (scrollable.evaluate().isNotEmpty) {
          await tester.drag(scrollable.first, const Offset(0, -650));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
        expect(find.textContaining('coming soon'), findsNothing);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
      });
    }
  }
}
