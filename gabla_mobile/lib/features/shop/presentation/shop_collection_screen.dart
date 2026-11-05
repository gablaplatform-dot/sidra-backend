import 'package:flutter/material.dart';
import 'shop_browse_screen.dart';

class ShopCollectionScreen extends StatelessWidget {
  const ShopCollectionScreen({
    super.key,
    required this.collection,
    this.parameters = const {},
  });
  final String collection;
  final Map<String, String> parameters;
  @override
  Widget build(BuildContext context) =>
      ShopBrowseScreen(collection: collection, parameters: parameters);
}
