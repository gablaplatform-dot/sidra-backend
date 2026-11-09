import 'package:flutter/material.dart';
import '../../domain/category.dart';
import '../../domain/category_artwork.dart';

/// New offline artwork for the seven selected directory categories; all other
/// categories continue to display the URL supplied by the admin API.
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
    final name = category.name.toLowerCase();
    final asset = name.contains('job')
        ? 'assets/categories/jobs.jpg'
        : name.contains('rental') ||
              name.contains('propert') ||
              name.contains('accom')
        ? 'assets/categories/properties.jpg'
        : name.contains('entertain')
        ? 'assets/categories/entertainment.jpg'
        : name.contains('venue') || name.contains('event')
        ? 'assets/categories/venue.jpg'
        : name.contains('media') || name.contains('technolog')
        ? 'assets/categories/media.jpg'
        : 'assets/artwork/services.jpg';
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(asset, fit: BoxFit.cover),
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
