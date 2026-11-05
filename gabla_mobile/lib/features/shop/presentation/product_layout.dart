import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../domain/product.dart';
import 'commerce_widgets.dart';
import 'widgets/product_card.dart';

class ProductLayout extends ConsumerWidget {
  const ProductLayout({super.key, required this.items, this.listView = false});
  final List<Product> items;
  final bool listView;
  @override
  Widget build(BuildContext context, WidgetRef ref) => LayoutBuilder(
    builder: (context, bounds) {
      final style = commerceStyle(ref);
      final scale = MediaQuery.textScalerOf(context).scale(1);
      void open(navigation) => context.push(
        '/shop/product/${navigation.product.id}',
        extra: navigation,
      );
      // Rows remain the user's explicit browse preference, and support large type.
      if (listView || bounds.maxWidth < 300 || scale > 1.5) {
        return Column(
          children: [
            for (final p in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ProductCard(product: p, onTap: open, listView: true),
              ),
          ],
        );
      }
      if (style == AppThemeStyle.cinematic) {
        return Column(
          children: [
            for (final p in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: SizedBox(
                  height: 320 + 150 * scale,
                  child: ProductCard(product: p, onTap: open),
                ),
              ),
          ],
        );
      }
      final columns = bounds.maxWidth > 650 ? 3 : 2;
      final cardWidth = (bounds.maxWidth - (columns - 1) * 12) / columns;
      if (style == AppThemeStyle.orbit) {
        // Staggered columns retain reading order inside each product card.
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var col = 0; col < columns; col++) ...[
              if (col > 0) const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(top: col.isOdd ? 24 : 0),
                  child: Column(
                    children: [
                      for (var i = col; i < items.length; i += columns)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: SizedBox(
                            height:
                                cardWidth * (i.isEven ? 1.1 : 1.35) +
                                185 * scale,
                            child: ProductCard(product: items[i], onTap: open),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        );
      }
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          crossAxisSpacing: 12,
          mainAxisSpacing: 18,
          mainAxisExtent:
              cardWidth * (style == AppThemeStyle.discover ? 1.35 : 1.05) +
              185 * scale,
        ),
        itemBuilder: (context, i) =>
            ProductCard(product: items[i], onTap: open),
      );
    },
  );
}
