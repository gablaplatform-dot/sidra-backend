import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../application/commerce_providers.dart';
import 'commerce_widgets.dart';

class ShopCategoriesScreen extends ConsumerWidget {
  const ShopCategoriesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tree = ref.watch(productTreeProvider);
    Widget node(Map<String, dynamic> n) {
      final children = n['children'] as List? ?? [];
      return children.isEmpty
          ? ListTile(
              title: Text(n['name']?.toString() ?? 'Category'),
              trailing: const Icon(Icons.arrow_outward, size: 17),
              onTap: () => context.push('/shop/${n['id']}'),
            )
          : ExpansionTile(
              title: Text(n['name']?.toString() ?? 'Category'),
              children: [
                ListTile(
                  title: Text('All ${n['name']}'),
                  onTap: () => context.push('/shop/${n['id']}'),
                ),
                for (final child in children)
                  Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: node(Map<String, dynamic>.from(child)),
                  ),
              ],
            );
    }

    return Scaffold(
      appBar: const CommerceAppBar(title: 'Find your category'),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const CommerceTitle(
            'A world of good finds.',
            subtitle:
                'Explore a category, then narrow it down to what you need.',
          ),
          tree.when(
            loading: () => const CommerceLoading(),
            error: (e, _) => CommerceEmpty(
              title: 'Couldn’t load categories',
              message: '$e',
              action: 'Try again',
              onAction: () => ref.invalidate(productTreeProvider),
            ),
            data: (items) => Column(
              children: [for (final category in items) node(category)],
            ),
          ),
        ],
      ),
    );
  }
}
