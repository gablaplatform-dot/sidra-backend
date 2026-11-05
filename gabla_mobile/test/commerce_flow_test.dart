import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:gabla_mobile/core/network/network_providers.dart';
import 'package:gabla_mobile/features/provider/application/provider_providers.dart';
import 'package:gabla_mobile/features/provider/presentation/provider_detail_screen.dart';
import 'package:gabla_mobile/features/shop/presentation/product_detail_screen.dart';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/cart/application/cart_controller.dart';
import 'package:gabla_mobile/features/cart/application/checkout_controller.dart';
import 'package:gabla_mobile/features/cart/presentation/cart_screen.dart';
import 'package:gabla_mobile/features/cart/presentation/checkout_screen.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/orders/application/order_providers.dart';
import 'package:gabla_mobile/features/orders/data/order_repository.dart';
import 'package:gabla_mobile/features/orders/domain/order.dart';
import 'package:gabla_mobile/features/orders/domain/order_input.dart';
import 'package:gabla_mobile/features/orders/presentation/my_orders_screen.dart';
import 'package:gabla_mobile/features/settings/application/theme_controller.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/shop/application/commerce_providers.dart';
import 'package:gabla_mobile/features/shop/application/shop_providers.dart';
import 'package:gabla_mobile/features/shop/data/shop_repository.dart';
import 'package:gabla_mobile/features/shop/domain/browse_query.dart';
import 'package:gabla_mobile/features/shop/domain/product.dart';
import 'package:gabla_mobile/features/shop/presentation/shop_screen.dart';
import 'package:gabla_mobile/features/shop/presentation/shop_browse_screen.dart';

class DemoTheme extends ThemeController {
  DemoTheme(this.style);
  final AppThemeStyle style;
  @override
  ThemePreferences build() => ThemePreferences.defaults.copyWith(style: style);
}

class DemoSession extends SessionController {
  @override
  Future<Session?> build() async => null;
}

class DemoCart extends CartController {
  @override
  Map<String, int> build() => {'a': 2, 'b': 1};
}

ApiClient client(Dio dio) => ApiClient(
  dio: dio,
  getToken: () => null,
  onTokenRenewed: (_) {},
  onUnauthorized: () {},
);

class Orders extends OrderRepository {
  Orders() : super(client(Dio()));
  final calls = <String>[];
  @override
  Future<Order> createOrder({
    required String providerId,
    required List<OrderItemInput> items,
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    String? notes,
    FulfillmentInput? fulfillment,
  }) async {
    calls.add(providerId);
    if (providerId == 'seller-b') throw StateError('Unavailable');
    return Order(
      id: 'order-a',
      status: OrderStatus.pending,
      total: 20000,
      createdAt: DateTime(2026, 11, 3),
    );
  }
}

const product = Product(
  id: 'a',
  name: 'Everyday market tote',
  price: 20000,
  providerId: 'seller-a',
  providerName: 'Kampala makers',
  district: 'Kampala',
);
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  test(
    'browse and facets share exact scopes and filters, retaining pagination metadata',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            requests.add(o);
            h.resolve(
              Response(
                requestOptions: o,
                data: {
                  'data': {'items': [], 'total': 57, 'widened': true},
                },
              ),
            );
          },
        ),
      );
      final repo = ShopRepository(client(dio));
      const q = BrowseQuery(
        categoryId: 'electronics',
        providerId: 'seller',
        shopCategoryId: 'phones',
        q: 'phone',
        min: 100,
        max: 900,
        discount: true,
        country: 'ug',
        culture: 'culture',
        attrs: {
          'brand': ['A', 'B'],
        },
        lat: .3,
        lng: 32.5,
        page: 2,
        sort: 'price_asc',
      );
      final result = await repo.browse(q);
      await repo.facets(q);
      expect(
        const BrowseQuery(
          collection: 'new',
          sort: 'featured',
        ).parameters['sort'],
        'featured',
      );
      expect(result['total'], 57);
      expect(result['widened'], true);
      final list = {...requests[0].queryParameters}
        ..remove('page')
        ..remove('limit')
        ..remove('sort');
      expect(list, requests[1].queryParameters);
      expect(list['productCategoryId'], 'electronics');
      expect(list.containsKey('categoryId'), false);
      expect(list['attrs'], '{"brand":["A","B"]}');
      expect(list['radiusKm'], 15);
      expect(q.copyWith(discount: false).page, 1);
      expect(q.copyWith(page: 3).page, 3);
      expect(
        q.copyWith(clearPrice: true).filters.containsKey('minPrice'),
        false,
      );
      expect(
        q
            .copyWith(clearLocation: true, everywhere: true)
            .filters
            .containsKey('lat'),
        false,
      );
      expect(
        const BrowseQuery(
          kind: 'service',
          categoryId: 'repairs',
        ).filters['serviceCategoryId'],
        'repairs',
      );
    },
  );
  test(
    'booking config and online payment restrictions follow backend payloads',
    () {
      final p = Product.fromJson({
        'id': 's',
        'type': 'service',
        'bookingMode': 'instant',
        'booking': {'unit': 'hour'},
        'provider': {'id': 'seller', 'onlinePaymentsEnabled': false},
        'media': {
          'imageUrl': 'a',
          'gallery': ['a', 'b'],
        },
      });
      expect(p.bookable, true);
      expect(p.canPayOnline, false);
      expect(p.images, ['a', 'b']);
      final o = Order.fromJson({
        'id': 'order',
        'status': 'accepted',
        'paymentMethod': 'online',
        'paymentStatus': 'payable',
        'items': [
          {'name': 'A', 'quantity': 2},
        ],
        'documents': [
          {'id': 'd', 'type': 'receipt'},
        ],
      });
      expect(o.canPay, true);
      expect(o.bucket, 'open');
      expect(o.items.length, 1);
      expect(o.documents.first['id'], 'd');
      expect(
        Order.fromJson({
          'id': 'closed',
          'status': 'canceled',
          'paymentStatus': 'closed',
        }).canPay,
        false,
      );
    },
  );
  test(
    'partial checkout clears only successful sellers; quick buy preserves the bag',
    () async {
      final repo = Orders();
      final container = ProviderContainer(
        overrides: [
          cartControllerProvider.overrideWith(DemoCart.new),
          orderRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      final keep = container.listen(checkoutControllerProvider, (_, _) {});
      addTearDown(keep.close);
      const groups = [
        ProviderOrderGroup(
          providerId: 'seller-a',
          providerName: 'A',
          items: [
            OrderItemInput(
              listingId: 'a',
              name: 'A',
              quantity: 2,
              unitPrice: 20,
            ),
          ],
        ),
        ProviderOrderGroup(
          providerId: 'seller-b',
          providerName: 'B',
          items: [
            OrderItemInput(
              listingId: 'b',
              name: 'B',
              quantity: 1,
              unitPrice: 10,
            ),
          ],
        ),
      ];
      await container
          .read(checkoutControllerProvider.notifier)
          .submit(
            groups: groups,
            paymentMethod: 'online',
            name: 'Customer',
            phone: '0700000000',
          );
      expect(container.read(cartControllerProvider), {'b': 1});
      expect(
        container.read(checkoutControllerProvider).value!.failedProviderNames,
        ['B'],
      );
      container.read(cartControllerProvider.notifier).add('a');
      await container
          .read(checkoutControllerProvider.notifier)
          .submit(
            groups: [groups.first],
            paymentMethod: 'cash',
            name: 'Customer',
            phone: '0700000000',
            clearCart: false,
          );
      expect(container.read(cartControllerProvider), {'b': 1, 'a': 1});
    },
  );
  for (final style in AppThemeStyle.values) {
    testWidgets(
      '${style.name}: shop, browse, filters, cart, checkout and receipt fit 320px at larger text',
      (tester) async {
        tester.view.physicalSize = const Size(
          const bool.fromEnvironment('COMMERCE_PREVIEWS') ? 390 : 320,
          900,
        );
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        if (const bool.fromEnvironment('COMMERCE_PREVIEWS')) {
          await tester.runAsync(() async {
            for (final e in {
              'Manrope': 'Manrope.ttf',
              'Inter': 'Inter.ttf',
              'DM Serif Display': 'DMSerifDisplay-Regular.ttf',
            }.entries) {
              await (FontLoader(
                e.key,
              )..addFont(rootBundle.load('assets/fonts/${e.value}'))).load();
            }
            await (FontLoader('MaterialIcons')
                  ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
                .load();
          });
        }
        final boundary = GlobalKey();
        final demoDio = Dio()
          ..interceptors.add(
            InterceptorsWrapper(
              onRequest: (o, h) =>
                  h.resolve(Response(requestOptions: o, data: {'data': {}})),
            ),
          );
        final prefs = ThemePreferences.defaults.copyWith(style: style);
        Widget scene(Widget child) => ProviderScope(
          overrides: [
            apiClientProvider.overrideWithValue(client(demoDio)),
            themeControllerProvider.overrideWith(() => DemoTheme(style)),
            sessionControllerProvider.overrideWith(DemoSession.new),
            rootCategoriesProvider.overrideWith(
              (ref) async => [
                const Category(id: 'c', name: 'Everyday essentials'),
              ],
            ),
            newArrivalsProvider.overrideWith((ref) async => [product]),
            bestSellersProvider.overrideWith((ref) async => [product]),
            shopAdsProvider.overrideWith((ref) async => []),
            shopPromotionsProvider.overrideWith((ref) async => []),
            forYouProvider.overrideWith((ref) async => {}),
            providerDetailProvider.overrideWith(
              (ref, id) async => {
                'id': id,
                'businessName': 'Kampala makers',
                'isApproved': true,
                'ratingCount': 3,
                'ratingAvg': 4.5,
                'description':
                    'Everyday essentials, made and sourced around Kampala.',
                'contactLocked': true,
                'contactFee': '1000',
                'stats': {'listingCount': 1},
              },
            ),
            providerListingsProvider.overrideWith((ref, id) async => [product]),
            providerCategoryTreeProvider.overrideWith((ref) async => []),
            productDetailProvider('a').overrideWith((ref) async => product),
            similarProductsProvider('a').overrideWith((ref) async => []),
            sellerProductsProvider('seller-a').overrideWith((ref) async => []),
            productTreeProvider.overrideWith((ref) async => []),
            commerceCategoryTreeProvider(
              'product',
            ).overrideWith((ref) async => []),
            audienceCatalogProvider.overrideWith((ref) async => {}),
            browseResultsProvider.overrideWith(
              (ref, q) async => {
                'items': [
                  {'id': 'a', 'name': 'A find', 'price': 20000},
                ],
                'total': 1,
              },
            ),
            browseFacetsProvider.overrideWith(
              (ref, q) async => {
                'total': 1,
                'price': {'buckets': []},
                'attributes': {
                  'condition': [
                    {'value': 'New', 'count': 1},
                  ],
                },
                'districts': [
                  {'name': 'Kampala', 'count': 1},
                ],
              },
            ),
            cartControllerProvider.overrideWith(DemoCart.new),
            cartProductsProvider.overrideWith(
              (ref) async => {'a': product, 'b': product},
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.resolve(style, Brightness.light, prefs.colors),
            home: MediaQuery(
              data: const MediaQueryData(
                size: Size(
                  bool.fromEnvironment('COMMERCE_PREVIEWS') ? 390 : 320,
                  900,
                ),
                textScaler: TextScaler.linear(
                  bool.fromEnvironment('COMMERCE_PREVIEWS') ? 1 : 1.3,
                ),
                disableAnimations: true,
              ),
              child: RepaintBoundary(key: boundary, child: child),
            ),
          ),
        );
        await tester.pumpWidget(scene(const ShopScreen()));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        if (const bool.fromEnvironment('COMMERCE_PREVIEWS')) {
          await tester.runAsync(
            () => precacheImage(
              const AssetImage('assets/artwork/shop.png'),
              tester.element(find.byType(ShopScreen)),
            ),
          );
          await tester.pumpAndSettle();
          await tester.runAsync(() async {
            final image =
                await (boundary.currentContext!.findRenderObject()!
                        as RenderRepaintBoundary)
                    .toImage(pixelRatio: 2);
            final bytes = await image.toByteData(
              format: ui.ImageByteFormat.png,
            );
            await Directory('build/previews/shop').create(recursive: true);
            await File(
              'build/previews/shop/${style.name}.png',
            ).writeAsBytes(bytes!.buffer.asUint8List());
            image.dispose();
          });
        }
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(scene(const ShopBrowseScreen()));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Filters'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('New · 1'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Show matching finds · 1'));
        await tester.pumpAndSettle();
        expect(find.text('New'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(
          scene(const ProviderDetailScreen(providerId: 'seller-a')),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(
          scene(const ProductDetailScreen(listingId: 'a')),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(scene(const CartScreen()));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(scene(const CheckoutScreen()));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
        await tester.pumpWidget(
          scene(
            Scaffold(
              body: ListView(
                children: [
                  OrderReceiptCard(
                    order: Order.fromJson({
                      'id': 'order',
                      'status': 'accepted',
                      'total': 40000,
                      'provider': {
                        'id': 'seller',
                        'businessName': 'Kampala makers',
                      },
                      'paymentMethod': 'online',
                      'paymentStatus': 'payable',
                      'items': [
                        {
                          'name': 'Everyday tote',
                          'quantity': 2,
                          'total': 40000,
                        },
                      ],
                      'documents': [
                        {
                          'id': 'd',
                          'type': 'quotation',
                          'number': 'Q-1',
                          'revision': 2,
                        },
                      ],
                    }),
                  ),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
      },
    );
  }
}
