import 'package:flutter/material.dart';
import '../../domain/category.dart';
import '../../domain/category_artwork.dart';

/// Displays the original category photograph, with a relevant symbol fallback.
class CategoryCover extends StatelessWidget {
  const CategoryCover({super.key, required this.category});
  final Category category;
  @override
  Widget build(BuildContext context) {
    final url = category.imageUrl;
    if (url == null || url.isEmpty) return _fallback(context);
    return Image.network(
      url,
      fit: BoxFit.cover,
      cacheWidth: 512,
      excludeFromSemantics: true,
      errorBuilder: (_, _, _) => _fallback(context),
    );
  }

  Widget _fallback(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ColoredBox(
      color: colors.surfaceContainerLow,
      child: Center(
        child: Icon(
          providerCategoryIcon(category.name),
          color: colors.primary,
          size: 38,
        ),
      ),
    );
  }
}
