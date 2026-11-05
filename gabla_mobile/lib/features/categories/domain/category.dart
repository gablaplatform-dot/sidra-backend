/// A node in the product/service category tree (`/product-categories`,
/// `/service-categories`, `/shop-categories`). Mirrors `mapCategoryDto` in
/// `public_app/src/lib/shopMappers.js`.
class Category {
  const Category({
    required this.id,
    required this.name,
    this.imageUrl,
    this.children = const [],
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    final settings = json['settings'] as Map<String, dynamic>?;
    return Category(
      id: json['id'] as String,
      children: (json['children'] as List? ?? [])
          .map((v) => Category.fromJson(Map<String, dynamic>.from(v)))
          .toList(),
      name: json['name'] as String? ?? 'Category',
      imageUrl:
          json['imageUrl'] as String? ??
          settings?['imageUrl'] as String? ??
          settings?['pictureUrl'] as String?,
    );
  }

  final String id;
  final String name;
  final String? imageUrl;
  final List<Category> children;
}
