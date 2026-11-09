import 'category_artwork.dart';

/// A node in the product/service category tree (`/product-categories`,
/// `/service-categories`, `/shop-categories`). Mirrors `mapCategoryDto` in
/// `public_app/src/lib/shopMappers.js`.
class Category {
  const Category({
    required this.id,
    required this.name,
    this.imageUrl,
    this.inheritedArtwork,
    this.children = const [],
  });

  factory Category.fromJson(
    Map<String, dynamic> json, {
    String? inheritedArtwork,
  }) {
    final settings = json['settings'] as Map<String, dynamic>?;
    final id = json['id'] as String;
    final name = json['name'] as String? ?? 'Category';
    final artwork =
        providerCategoryArtwork[id] ??
        categoryArtworkForName(name) ??
        inheritedArtwork;
    return Category(
      id: id,
      inheritedArtwork: inheritedArtwork,
      children: (json['children'] as List? ?? [])
          .map(
            (v) => Category.fromJson(
              Map<String, dynamic>.from(v),
              inheritedArtwork: artwork,
            ),
          )
          .toList(),
      name: name,
      imageUrl:
          json['imageUrl'] as String? ??
          settings?['imageUrl'] as String? ??
          settings?['pictureUrl'] as String?,
    );
  }

  final String id;
  final String name;
  final String? imageUrl;
  final String? inheritedArtwork;

  String get fallbackArtwork =>
      categoryArtworkForName(name) ??
      inheritedArtwork ??
      'assets/artwork/services.jpg';
  final List<Category> children;
}
