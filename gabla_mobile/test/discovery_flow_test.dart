import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/shop/application/commerce_providers.dart';
import 'package:gabla_mobile/features/shop/application/discovery_feed.dart';
import 'package:gabla_mobile/features/shop/application/shop_providers.dart';
import 'package:gabla_mobile/features/shop/data/shop_repository.dart';
import 'package:gabla_mobile/features/shop/domain/browse_query.dart';
import 'package:gabla_mobile/features/shop/presentation/shop_screen.dart';

const tree = [
  {
    'id': 'electronics',
    'name': 'Electronics',
    'children': [
      {'id': 'phones', 'name': 'Phones'},
      {'id': 'laptops', 'name': 'Laptops'},
    ],
  },
  {'id': 'vehicles', 'name': 'Vehicles'},
];

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class _Repository extends ShopRepository {
  _Repository()
    : super(
        ApiClient(
          getToken: () => null,
          onTokenRenewed: (_) {},
          onUnauthorized: () {},
        ),
      );
  final requests = <BrowseQuery>[];
  final pending = <String, Completer<Map<String, dynamic>>>{};
  bool delay = false;

  @override
  Future<Map<String, dynamic>> browse(BrowseQuery query) async {
    requests.add(query);
    if (delay) {
      return pending
          .putIfAbsent(query.categoryId!, Completer<Map<String, dynamic>>.new)
          .future;
    }
    final start = (query.page - 1) * 24;
    return {
      'total': 28,
      'items': [
        for (var index = start; index < (start + 24).clamp(0, 28); index++)
          {
            'id': 'product$index',
            'name': 'Product $index',
            'price': 20000,
            'productCategoryId': query.categoryId == 'electronics'
                ? (index.isEven ? 'phones' : 'laptops')
                : query.categoryId,
          },
      ],
    };
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'disposed category requests cannot replace the selected category',
    () async {
      final repo = _Repository()..delay = true;
      final container = ProviderContainer(
        overrides: [shopRepositoryProvider.overrideWithValue(repo)],
      );
      addTearDown(container.dispose);
      const first = BrowseQuery(
        categoryId: 'phones',
        sort: 'discovery',
        discoverySeed: 'a',
      );
      const second = BrowseQuery(
        categoryId: 'laptops',
        sort: 'discovery',
        discoverySeed: 'a',
      );
      final old = container.listen(discoveryFeedProvider(first), (_, _) {});
      await Future<void>.delayed(Duration.zero);
      old.close();
      final current = container.listen(
        discoveryFeedProvider(second),
        (_, _) {},
      );
      addTearDown(current.close);
      await Future<void>.delayed(Duration.zero);
      repo.pending['laptops']!.complete({
        'items': [
          {'id': 'new', 'name': 'Laptop', 'price': 20},
        ],
        'total': 1,
      });
      await Future<void>.delayed(Duration.zero);
      repo.pending['phones']!.complete({
        'items': [
          {'id': 'old', 'name': 'Phone', 'price': 10},
        ],
        'total': 1,
      });
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(discoveryFeedProvider(second)).items.single.id,
        'new',
      );
      expect(repo.requests.map((q) => q.discoverySeed), everyElement('a'));
    },
  );

  for (final style in AppThemeStyle.values) {
    testWidgets(
      '${style.name} discovers categories, filters subcategories and appends products',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final repo = _Repository();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              themeControllerProvider.overrideWith(() => _Theme(style)),
              shopRepositoryProvider.overrideWithValue(repo),
              rootCategoriesProvider.overrideWith(
                (ref) async => tree.map(Category.fromJson).toList(),
              ),
              productTreeProvider.overrideWith((ref) async => tree),
              browseFacetsProvider.overrideWith(
                (ref, query) async => {'total': 28},
              ),
              audienceCatalogProvider.overrideWith((ref) async => {}),
            ],
            child: MaterialApp(
              theme: AppTheme.resolve(style, Brightness.light),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context).copyWith(
                  disableAnimations: true,
                  textScaler: const TextScaler.linear(1.3),
                ),
                child: child!,
              ),
              home: const ShopScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(AppBar), findsNothing);
        expect(find.byTooltip('Filters'), findsNothing);
        await tester.enterText(find.byType(TextField), 'electr');
        await tester.pumpAndSettle();
        expect(find.text('Vehicles'), findsNothing);
        await tester.tap(find.text('Electronics'));
        await tester.pumpAndSettle();
        expect(find.text('All'), findsOneWidget);
        expect(find.text('Phones'), findsOneWidget);
        expect(find.text('Laptops'), findsOneWidget);
        expect(find.textContaining('UGX'), findsNothing);
        expect(repo.requests.first.sort, 'discovery');
        expect(repo.requests.first.discoverySeed, isNotEmpty);
        await tester.tap(find.text('Phones'));
        await tester.pumpAndSettle();
        expect(repo.requests.last.categoryId, 'phones');
        final seed = repo.requests.last.discoverySeed;
        await tester.drag(
          find.byType(CustomScrollView),
          const Offset(0, -6000),
        );
        await tester.pumpAndSettle();
        expect(
          repo.requests.any((q) => q.categoryId == 'phones' && q.page == 2),
          true,
        );
        expect(repo.requests.map((q) => q.discoverySeed), everyElement(seed));
        await tester.tap(find.byTooltip('Filters'));
        await tester.pumpAndSettle();
        expect(find.text('Show matching finds · 28'), findsOneWidget);
        await tester.tap(find.text('Show matching finds · 28'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Back to categories'));
        await tester.pumpAndSettle();
        expect(find.text('Vehicles'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
}
