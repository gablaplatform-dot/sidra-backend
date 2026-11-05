import 'package:flutter/material.dart';
import '../../shop/presentation/shop_browse_screen.dart';

class ServiceBrowseScreen extends StatelessWidget {
  const ServiceBrowseScreen({
    super.key,
    this.categoryId,
    this.parameters = const {},
  });
  final String? categoryId;
  final Map<String, String> parameters;
  @override
  Widget build(BuildContext context) => ShopBrowseScreen(
    categoryId: categoryId,
    kind: 'service',
    parameters: parameters,
  );
}
