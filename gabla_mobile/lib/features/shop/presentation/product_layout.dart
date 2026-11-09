import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../domain/product.dart';
import 'widgets/product_card.dart';

class ProductLayout extends StatelessWidget {
  const ProductLayout({super.key, required this.items, this.listView = false});
  final List<Product> items;
  final bool listView;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, bounds) {
      final scale = MediaQuery.textScalerOf(context).scale(1);
      void open(navigation) => context.push(
        '/shop/product/${navigation.product.id}',
        extra: navigation,
      );
      if (listView)
        return Column(
          children: [
            for (final p in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: ProductCard(product: p, onTap: open, listView: true),
              ),
          ],
        );
      final columns = bounds.maxWidth > 650 ? 3 : 2;
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          crossAxisSpacing: 14,
          mainAxisSpacing: 20,
          mainAxisExtent: bounds.maxWidth / columns + 195 * scale,
        ),
        itemBuilder: (context, i) =>
            ProductCard(product: items[i], onTap: open),
      );
    },
  );
}
