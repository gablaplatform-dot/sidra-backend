import 'product.dart';

/// Keeps the tapped image and its data available on the destination's first
/// frame, before the fresh detail request finishes.
class ProductNavigation {
  const ProductNavigation({required this.product, required this.heroTag});
  final Product product;
  final Object heroTag;
}
