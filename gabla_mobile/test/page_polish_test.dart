import 'helpers/load_test_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/categories/application/category_providers.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/categories/presentation/categories_screen.dart';
import 'package:gabla_mobile/features/home/presentation/home_screen.dart';
import 'package:gabla_mobile/features/provider/application/provider_providers.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/search/presentation/search_results_screen.dart';

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class _SignedOut extends SessionController {
  @override
  Future<Session?> build() async => null;
}

const _categories = [
  Category(
    id: 'repairs',
    name: 'Repairs',
    children: [Category(id: 'phone', name: 'Phone repairs')],
  ),
  Category(id: 'hospitality', name: 'Hospitality'),
];

void main() {
  setUpAll(loadTestFonts);
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  for (final style in AppThemeStyle.values) {
    for (final page in ['home', 'search', 'categories']) {
      testWidgets('${style.name} $page polished page preview', (tester) async {
        tester.view.physicalSize = const Size(430, 1100);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final key = GlobalKey();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => _Theme(style)),
              sessionControllerProvider.overrideWith(_SignedOut.new),
              directoryCategoriesProvider.overrideWith(
                (ref) async => _categories,
              ),
              topRatedProvidersProvider.overrideWith((ref) async => []),
            ],
            child: MaterialApp(
              theme: AppTheme.resolve(style, Brightness.light),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(disableAnimations: true),
                child: child!,
              ),
              home: RepaintBoundary(
                key: key,
                child: switch (page) {
                  'home' => const HomeScreen(),
                  'search' => const SearchResultsScreen(),
                  _ => const CategoriesScreen(),
                },
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final image = await boundary.toImage();
          final png = await image.toByteData(format: ui.ImageByteFormat.png);
          final dir = Directory('build/previews/polish');
          await dir.create(recursive: true);
          await File(
            '${dir.path}/${style.name}-$page.png',
          ).writeAsBytes(png!.buffer.asUint8List());
          image.dispose();
        });
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
  testWidgets(
    'home search opens global search and service categories stay in the service directory',
    (tester) async {
      tester.view.physicalSize = const Size(430, 1100);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          GoRoute(
            path: '/search',
            builder: (_, _) =>
                const Scaffold(body: Text('Global search destination')),
          ),
          GoRoute(
            path: '/categories',
            builder: (_, _) => const CategoriesScreen(),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            themeControllerProvider.overrideWith(
              () => _Theme(AppThemeStyle.orbit),
            ),
            sessionControllerProvider.overrideWith(_SignedOut.new),
            directoryCategoriesProvider.overrideWith(
              (ref) async => _categories,
            ),
            topRatedProvidersProvider.overrideWith((ref) async => []),
          ],
          child: MaterialApp.router(
            routerConfig: router,
            theme: AppTheme.resolve(AppThemeStyle.orbit, Brightness.light),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: child!,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Search products, services or businesses'));
      await tester.pumpAndSettle();
      expect(find.text('Global search destination'), findsOneWidget);
      router.pop();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('See all'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await Scrollable.ensureVisible(
        tester.element(find.text('See all')),
        alignment: .5,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('See all'));
      await tester.pumpAndSettle();
      expect(find.byType(CategoriesScreen), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'repair');
      await tester.pumpAndSettle();
      expect(find.text('Repairs'), findsOneWidget);
      expect(find.text('Hospitality'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
