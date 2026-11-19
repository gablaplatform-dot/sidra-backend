import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/network/api_exception.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/shop/application/commerce_providers.dart';
import 'package:gabla_mobile/features/shop/application/photo_search.dart';
import 'package:gabla_mobile/features/shop/application/shop_providers.dart';
import 'package:gabla_mobile/features/shop/data/shop_repository.dart';
import 'package:gabla_mobile/features/shop/domain/browse_query.dart';
import 'package:gabla_mobile/features/shop/presentation/shop_screen.dart';

ApiClient client([Dio? dio]) => ApiClient(
  dio: dio,
  getToken: () => null,
  onTokenRenewed: (_) {},
  onUnauthorized: () {},
);
const categories = [
  {'id': 'electronics', 'name': 'Electronics'},
  {'id': 'fashion', 'name': 'Fashion'},
];

Future<Uint8List> makePhoto(int width, int height) async {
  final recorder = ui.PictureRecorder();
  Canvas(recorder).drawColor(Colors.blue, BlendMode.src);
  final picture = recorder.endRecording();
  final image = await picture.toImage(width, height);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  picture.dispose();
  return data!.buffer.asUint8List();
}

class _Theme extends ThemeController {
  _Theme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class _Photos extends PhotoSearchService {
  _Photos(this.photo) : super(client());
  final Uint8List photo;
  bool cancel = false;
  ApiException? error;
  int calls = 0;
  final sources = <ImageSource>[];
  Completer<PhotoSearchMatch>? pending;
  @override
  Future<Uint8List?> recover() async => null;
  @override
  Future<Uint8List?> pick(ImageSource source) async {
    sources.add(source);
    return cancel ? null : photo;
  }

  @override
  Future<PhotoSearchMatch> identify(Uint8List bytes) async {
    calls++;
    if (error != null) throw error!;
    return pending?.future ??
        const PhotoSearchMatch(
          query: 'white sneakers',
          intent: 'Running Shoes',
        );
  }
}

class _Shop extends ShopRepository {
  _Shop() : super(client());
  final requests = <BrowseQuery>[];
  bool empty = false;
  @override
  Future<Map<String, dynamic>> browse(BrowseQuery query) async {
    requests.add(query);
    return {
      'total': empty ? 0 : 1,
      'items': empty
          ? []
          : [
              {
                'id': 'shoe',
                'name': query.q.toLowerCase().contains('laptop')
                    ? 'HP EliteBook laptop'
                    : 'White running sneakers',
                'price': 95000,
                'productCategoryId': 'shoes',
              },
            ],
    };
  }
}

Future<void> _pumpShop(
  WidgetTester tester,
  _Photos photos,
  _Shop shop, [
  AppThemeStyle style = AppThemeStyle.gabla,
]) async {
  tester.view.physicalSize = const Size(320, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        themeControllerProvider.overrideWith(() => _Theme(style)),
        photoSearchServiceProvider.overrideWithValue(photos),
        shopRepositoryProvider.overrideWithValue(shop),
        rootCategoriesProvider.overrideWith(
          (ref) async => categories.map(Category.fromJson).toList(),
        ),
        productTreeProvider.overrideWith((ref) async => categories),
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
}

Future<void> _choosePhoto(WidgetTester tester, {bool camera = false}) async {
  await tester.tap(find.byTooltip('Search by photo'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(camera ? 'Take photo' : 'Choose photo'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Uint8List photo;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    photo = await makePhoto(32, 24);
  });

  test(
    'preparation makes real PNG bytes and preserves portrait/landscape proportions',
    () async {
      for (final size in [(2048, 512), (512, 2048), (32, 24)]) {
        final bytes = await PhotoSearchService.preparePhoto(
          await makePhoto(size.$1, size.$2),
        );
        expect(bytes.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
        final codec = await ui.instantiateImageCodec(bytes);
        final image = (await codec.getNextFrame()).image;
        expect(image.width <= 1024 && image.height <= 1024, true);
        expect(image.width / image.height, closeTo(size.$1 / size.$2, .01));
        image.dispose();
        codec.dispose();
      }
    },
  );

  test('bad or oversized files are rejected before an HTTP request', () async {
    await expectLater(
      PhotoSearchService.preparePhoto(Uint8List.fromList([1, 2, 3])),
      throwsA(isA<ApiException>()),
    );
    await expectLater(
      PhotoSearchService.preparePhoto(Uint8List(26 * 1024 * 1024)),
      throwsA(isA<ApiException>()),
    );
  });

  test(
    'photo API sends binary PNG and handles an empty AI detection',
    () async {
      final dio = Dio();
      final api = client(dio);
      var query = 'white sneakers';
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            expect(o.path, '/search/image');
            expect(o.method, 'POST');
            expect(o.contentType, 'image/png');
            expect(o.data, photo);
            expect(o.receiveTimeout, const Duration(seconds: 40));
            h.resolve(
              Response(
                requestOptions: o,
                data: {
                  'data': {'query': query, 'intent': 'Running Shoes'},
                },
              ),
            );
          },
        ),
      );
      final service = PhotoSearchService(api);
      expect((await service.identify(photo)).query, 'white sneakers');
      query = '';
      await expectLater(
        service.identify(photo),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'NO_ITEM_RECOGNIZED',
          ),
        ),
      );
    },
  );

  for (final style in AppThemeStyle.values) {
    testWidgets(
      '${style.name}: ordinary language in the categories field opens product search',
      (tester) async {
        final photos = _Photos(photo);
        final shop = _Shop();
        await _pumpShop(tester, photos, shop, style);
        await tester.enterText(find.byType(TextField), 'I need a laptop');
        await tester.pump(const Duration(milliseconds: 700));
        await tester.pumpAndSettle();
        expect(shop.requests.last.q, 'I need a laptop');
        expect(shop.requests.last.kind, 'product');
        expect(shop.requests.last.categoryId, isNull);
        expect(find.text('HP EliteBook laptop'), findsOneWidget);
        expect(tester.testTextInput.isVisible, true);
        await tester.tap(find.byTooltip('Clear search'));
        await tester.pumpAndSettle();
        expect(find.text('Electronics'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
    testWidgets(
      '${style.name}: category photo search opens real product results and returns to categories',
      (tester) async {
        final photos = _Photos(photo);
        final shop = _Shop();
        await _pumpShop(tester, photos, shop, style);
        await _choosePhoto(tester, camera: true);
        expect(photos.sources, [ImageSource.camera]);
        expect(
          find.bySemanticsLabel('Photo selected for item search'),
          findsOneWidget,
        );
        await tester.tap(find.text('Search for this item'));
        await tester.pumpAndSettle();
        expect(photos.calls, 1);
        expect(shop.requests.last.q, 'white sneakers');
        expect(shop.requests.last.kind, 'product');
        expect(shop.requests.last.categoryId, isNull);
        expect(find.text('White running sneakers'), findsOneWidget);
        expect(find.text('Similar items'), findsOneWidget);
        expect(find.text('Running Shoes'), findsOneWidget);
        await tester.tap(find.byTooltip('Back to categories'));
        await tester.pumpAndSettle();
        expect(find.text('Electronics'), findsOneWidget);
        expect(find.text('Similar items'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'cancelling the picker leaves the typed category search untouched',
    (tester) async {
      final photos = _Photos(photo)..cancel = true;
      final shop = _Shop();
      await _pumpShop(tester, photos, shop);
      await tester.enterText(find.byType(TextField), 'electr');
      await _choosePhoto(tester);
      await tester.tap(find.byTooltip('Close photo search'));
      await tester.pumpAndSettle();
      expect(find.text('electr'), findsOneWidget);
      expect(photos.calls, 0);
      expect(shop.requests, isEmpty);
    },
  );

  testWidgets(
    'failed recognition keeps the photo and allows retry without choosing it again',
    (tester) async {
      final photos = _Photos(photo)
        ..error = ApiException(
          message: 'We couldn’t identify an item. Try a closer, clearer photo.',
        );
      final shop = _Shop();
      await _pumpShop(tester, photos, shop);
      await _choosePhoto(tester);
      expect(photos.sources, [ImageSource.gallery]);
      await tester.tap(find.text('Search for this item'));
      await tester.pumpAndSettle();
      expect(find.textContaining('We couldn’t identify'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Photo selected for item search'),
        findsOneWidget,
      );
      expect(shop.requests, isEmpty);
      photos.error = null;
      await tester.tap(find.text('Search for this item'));
      await tester.pumpAndSettle();
      expect(find.text('White running sneakers'), findsOneWidget);
      expect(photos.sources, hasLength(1));
    },
  );

  testWidgets(
    'a dismissed search cannot replace the screen when its AI request finishes later',
    (tester) async {
      final photos = _Photos(photo)..pending = Completer<PhotoSearchMatch>();
      final shop = _Shop();
      await _pumpShop(tester, photos, shop);
      await _choosePhoto(tester);
      await tester.tap(find.text('Search for this item'));
      await tester.pump();
      expect(find.text('Finding items…'), findsOneWidget);
      await tester.tap(find.byTooltip('Close photo search'));
      await tester.pumpAndSettle();
      photos.pending!.complete(
        const PhotoSearchMatch(query: 'stale', intent: 'Old result'),
      );
      await tester.pumpAndSettle();
      expect(shop.requests, isEmpty);
      expect(find.text('Electronics'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'no catalogue matches offers another photo instead of unrelated products',
    (tester) async {
      final photos = _Photos(photo);
      final shop = _Shop()..empty = true;
      await _pumpShop(tester, photos, shop);
      await _choosePhoto(tester);
      await tester.tap(find.text('Search for this item'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('No similar items found in Gabla'),
        findsOneWidget,
      );
      expect(find.text('White running sneakers'), findsNothing);
      expect(find.text('Try another photo'), findsOneWidget);
    },
  );
}
