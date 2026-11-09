import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../categories/domain/category.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../application/commerce_providers.dart';
import 'commerce_widgets.dart';

class ShopCategoriesScreen extends ConsumerWidget {
  const ShopCategoriesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tree = ref.watch(productTreeProvider);
    Widget node(Category category) {
      final children = category.children;
      final cover = ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: SizedBox.square(
          dimension: 44,
          child: CategoryCover(category: category),
        ),
      );
      return children.isEmpty
          ? ListTile(
              leading: cover,
              title: Text(category.name),
              trailing: const Icon(Icons.arrow_outward, size: 17),
              onTap: () => context.push('/shop/${category.id}'),
            )
          : ExpansionTile(
              leading: cover,
              title: Text(category.name),
              children: [
                ListTile(
                  title: Text('All ${category.name}'),
                  onTap: () => context.push('/shop/${category.id}'),
                ),
                for (final child in children)
                  Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: node(child),
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
              children: [
                for (final category in items) node(Category.fromJson(category)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
