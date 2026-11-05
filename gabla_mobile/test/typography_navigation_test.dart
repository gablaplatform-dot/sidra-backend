import 'package:visibility_detector/visibility_detector.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gabla_mobile/core/theme/app_theme.dart';
import 'package:gabla_mobile/core/theme/app_theme_style.dart';
import 'package:gabla_mobile/core/theme/font_group.dart';
import 'package:gabla_mobile/features/settings/data/theme_preferences_store.dart';
import 'package:gabla_mobile/features/settings/domain/theme_preferences.dart';
import 'package:gabla_mobile/features/shop/application/shop_providers.dart';
import 'package:gabla_mobile/features/shop/domain/product.dart';
import 'package:gabla_mobile/features/shop/presentation/product_detail_screen.dart';
import 'package:gabla_mobile/features/shop/presentation/widgets/product_card.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
  });
  test(
    'font pairing persists independently of design and custom palette',
    () async {
      final store = ThemePreferencesStore();
      final preferences = ThemePreferences.defaults.copyWith(
        style: AppThemeStyle.orbit,
        fontGroup: FontGroup.luxury,
        palettes: {
          'orbit': [0xffcc0000, 0xff00cc00, 0xffeeeeee],
        },
      );
      await store.write(preferences);
      final restored = await store.read();
      expect(restored.fontGroup, FontGroup.luxury);
      expect(restored.style, AppThemeStyle.orbit);
      expect(restored.palettes, preferences.palettes);
      for (final group in FontGroup.values) {
        for (final style in AppThemeStyle.values) {
          final theme = AppTheme.resolve(style, Brightness.light, null, group);
          expect(
            theme.textTheme.headlineLarge!.fontFamily,
            group.heading(style),
          );
          expect(theme.textTheme.bodyMedium!.fontFamily, group.body);
        }
      }
    },
  );
  testWidgets(
    'product image flies to preview before request completes and returns',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      const product = Product(
        id: 'preview',
        name: 'Fresh market find',
        price: 10000,
      );
      final pending = Completer<Product>();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            productDetailProvider(
              'preview',
            ).overrideWith((ref) => pending.future),
          ],
          child: MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 190,
                    height: 360,
                    child: ProductCard(
                      product: product,
                      onTap: (navigation) {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => ProductDetailScreen(
                              listingId: product.id,
                              heroTag: navigation.heroTag,
                              previewProduct: navigation.product,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text(product.name));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      expect(find.byType(Hero), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpAndSettle();
      expect(find.text(product.name), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(ProductCard), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
