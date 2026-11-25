import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/widgets/gabla_brand_mark.dart';
import '../../categories/domain/category.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../../videoFeed/presentation/widgets/video_feed_banner.dart';
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

    final c = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<StyleTokens>()!;

    return Scaffold(
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(
              12,
              MediaQuery.paddingOf(context).top + 10,
              12,
              20,
            ),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: tokens.heroGradient ?? [c.primaryContainer, c.primary],
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(tokens.cardRadius * 1.4),
                bottomRight: Radius.circular(tokens.cardRadius * 1.4),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconButton(
                      tooltip: 'Back',
                      onPressed: () =>
                          context.canPop() ? context.pop() : context.go('/shop'),
                      icon: Icon(
                        Icons.arrow_back_ios_new,
                        size: 22,
                        color: c.onPrimary,
                      ),
                    ),
                    Expanded(
                      child: GablaBrandMark(
                        foreground: c.onPrimary,
                        markBackground: c.onPrimary.withValues(alpha: .18),
                        compact: true,
                      ),
                    ),
                    const CommerceCartButton(),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'A world of good finds.',
                  style: TextStyle(
                    color: c.onPrimary,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Explore a category, then narrow it down to what you need.',
                  style: TextStyle(color: c.onPrimary.withValues(alpha: .85)),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const VideoFeedBanner(),
                const SizedBox(height: 14),
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
                      for (final category in items)
                        node(Category.fromJson(category)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
