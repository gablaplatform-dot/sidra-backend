import 'helpers/load_test_fonts.dart';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/network/network_providers.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/community/application/community_providers.dart';
import 'package:gabla_mobile/features/community/presentation/community_screens.dart';
import 'package:gabla_mobile/features/community/presentation/community_editor_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';

class FixedTheme extends ThemeController {
  FixedTheme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class SignedIn extends SessionController {
  @override
  Future<Session?> build() async => const Session(
    accessToken: 'fixture',
    user: AppUser(
      id: 'customer',
      name: 'Amina',
      email: 'amina@fixture.test',
      roles: ['user'],
    ),
  );
}

Map<String, dynamic> post(bool event) => {
  'id': event ? 'event' : 'job',
  'kind': event ? 'event' : 'job',
  'ownerId': 'owner',
  'title': event
      ? 'Live music at the Garden'
      : 'Sound engineer for local live shows',
  'organization': 'Garden Sessions',
  'category': event ? 'Music' : 'Creative',
  'district': 'Kampala',
  'address': 'The Garden, Kampala',
  'description':
      'A local opportunity to connect with good people and make something memorable together.',
  'payMin': 25000,
  'payMax': event ? 25000 : 150000,
  'currency': 'UGX',
  'employmentType': 'contract',
  'workplace': 'onsite',
  'jobType': 'task',
  'status': 'approved',
  'startsAt': '2027-01-08T16:00:00Z',
  'endsAt': '2027-01-08T21:00:00Z',
  'details': {
    'payPeriod': 'task',
    'requirements': 'Experience with live sound and a love of music.',
  },
  'media': <dynamic>[],
  'owner': {'name': 'Amina'},
  'canManage': false,
};

class FixtureApi extends ApiClient {
  FixtureApi()
    : super(
        getToken: () => null,
        onTokenRenewed: (_) {},
        onUnauthorized: () {},
      );
  @override
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    final event = path.startsWith('/events');
    final dynamic data = path == '/jobs' || path == '/events'
        ? {
            'items': [post(event)],
            'total': 1,
          }
        : post(event);
    return data as T;
  }
}

void main() {
  setUpAll(loadTestFonts);
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    for (final entry in {
      'Inter': 'Inter.ttf',
      'Manrope': 'Manrope.ttf',
      'DM Serif Display': 'DMSerifDisplay-Regular.ttf',
    }.entries) {
      await (FontLoader(
        entry.key,
      )..addFont(rootBundle.load('assets/fonts/${entry.value}'))).load();
    }
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  setUp(
    () => VisibilityDetectorController.instance.updateInterval = Duration.zero,
  );
  test(
    'community prices distinguish free events, negotiable pay and pay range',
    () {
      expect(
        communityPay({'kind': 'event', 'payMin': 0, 'payMax': 0}),
        'Free entry',
      );
      expect(
        communityPay({'kind': 'job', 'payMin': 0, 'payMax': 0}),
        'Pay negotiable',
      );
      expect(
        communityPay({'payMin': 25000, 'payMax': 150000, 'currency': 'UGX'}),
        'UGX 25,000 – 150,000',
      );
    },
  );
  for (final style in AppThemeStyle.values) {
    final screens = <String, Widget>{
      'jobs': const CommunityHubScreen(kind: 'jobs'),
      'events': const CommunityHubScreen(kind: 'events'),
      'job-detail': const CommunityDetailScreen(kind: 'jobs', id: 'job'),
      'event-detail': const CommunityDetailScreen(kind: 'events', id: 'event'),
      'post-job': const CommunityEditorScreen(kind: 'jobs'),
      'post-event': const CommunityEditorScreen(kind: 'events'),
    };
    for (final entry in screens.entries) {
      testWidgets('${style.name} ${entry.key} fits 320px with large text', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => FixedTheme(style)),
              sessionControllerProvider.overrideWith(SignedIn.new),
              apiClientProvider.overrideWithValue(FixtureApi()),
            ],
            child: MaterialApp(
              theme: AppTheme.resolve(style, Brightness.light),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  textScaler: const TextScaler.linear(1.3),
                  disableAnimations: true,
                ),
                child: child!,
              ),
              home: entry.value,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final lists = find.byType(Scrollable);
        if (lists.evaluate().isNotEmpty) {
          await tester.drag(lists.first, const Offset(0, -700));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
  for (final style in AppThemeStyle.values) {
    for (final kind in ['jobs', 'events', 'post-job', 'post-event']) {
      testWidgets('${style.name} $kind rendered preview', (tester) async {
        tester.view.physicalSize = const Size(430, 1100);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final key = GlobalKey();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => FixedTheme(style)),
              sessionControllerProvider.overrideWith(SignedIn.new),
              apiClientProvider.overrideWithValue(FixtureApi()),
            ],
            child: MaterialApp(
              theme: AppTheme.resolve(style, Brightness.light),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(disableAnimations: true),
                child: child!,
              ),
              home: RepaintBoundary(
                key: key,
                child: kind.startsWith('post-')
                    ? CommunityEditorScreen(
                        kind: kind == 'post-job' ? 'jobs' : 'events',
                      )
                    : CommunityHubScreen(kind: kind),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.pump();
        expect(tester.takeException(), isNull);
        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final picture = await boundary.toImage();
          final png = await picture.toByteData(format: ui.ImageByteFormat.png);
          final folder = Directory('build/previews/community');
          await folder.create(recursive: true);
          await File(
            '${folder.path}/${style.name}-$kind.png',
          ).writeAsBytes(png!.buffer.asUint8List());
          picture.dispose();
        });
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
}
