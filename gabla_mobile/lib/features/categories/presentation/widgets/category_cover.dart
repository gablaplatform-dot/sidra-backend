import 'package:flutter/material.dart';
import '../../domain/category.dart';
import '../../domain/category_artwork.dart';

/// Bundled directory covers and photo fallbacks for missing admin images.
class CategoryCover extends StatelessWidget {
  const CategoryCover({super.key, required this.category});
  final Category category;

  @override
  Widget build(BuildContext context) {
    final asset = providerCategoryArtwork[category.id];
    if (asset != null) {
      return Image.asset(
        asset,
        fit: BoxFit.cover,
        cacheWidth: 512,
        excludeFromSemantics: true,
        errorBuilder: (_, _, _) => _remote(context),
      );
    }
    return _remote(context);
  }

  Widget _remote(BuildContext context) {
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
    final asset = category.fallbackArtwork;
    if (asset != 'assets/artwork/services.jpg') {
      return Image.asset(
        asset,
        fit: BoxFit.cover,
        cacheWidth: 512,
        excludeFromSemantics: true,
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          asset,
          fit: BoxFit.cover,
          cacheWidth: 512,
          excludeFromSemantics: true,
        ),
        Positioned(
          right: 12,
          top: 12,
          child: CircleAvatar(
            radius: 17,
            backgroundColor: colors.surface.withValues(alpha: .9),
            child: Icon(
              Icons.category_outlined,
              size: 18,
              color: colors.primary,
            ),
          ),
        ),
      ],
    );
  }
}
