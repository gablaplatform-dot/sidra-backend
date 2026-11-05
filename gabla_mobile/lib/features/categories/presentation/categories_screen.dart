import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../settings/application/theme_controller.dart';
import '../application/category_providers.dart';
import '../domain/category.dart';
import 'widgets/category_cover.dart';

class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});
  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  String _query = '';
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = ref.watch(themeControllerProvider).style;
    final radius = theme.cardTheme.shape is RoundedRectangleBorder
        ? (theme.cardTheme.shape as RoundedRectangleBorder).borderRadius
        : BorderRadius.circular(8);
    return Scaffold(
      appBar: AppBar(title: const Text('Business categories')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: [
          Text(
            'Find a business by category',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Browse shops and service providers by category.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          TextField(
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            decoration: const InputDecoration(
              labelText: 'Search business categories',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: 20),
          AsyncValueView<List<Category>>(
            value: ref.watch(directoryCategoriesProvider),
            onRetry: () => ref.invalidate(directoryCategoriesProvider),
            data: (context, all) {
              final items = all
                  .where((c) => c.name.toLowerCase().contains(_query))
                  .toList();
              if (items.isEmpty)
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 28),
                  child: Text(
                    _query.isEmpty
                        ? 'No business categories are available right now.'
                        : 'No categories match your search. Try another name.',
                  ),
                );
              Widget item(int i) => DesignEntrance(
                index: i,
                child: Material(
                  color: theme.colorScheme.surfaceContainerLow,
                  borderRadius: radius,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/category/${items[i].id}'),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 76,
                          height: 84,
                          child: CategoryCover(category: items[i]),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  items[i].name,
                                  style: theme.textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (items[i].children.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    '${items[i].children.length} subcategories',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.all(12),
                          child: Icon(Icons.chevron_right, size: 20),
                        ),
                      ],
                    ),
                  ),
                ),
              );
              return Column(
                children: [
                  if (style == AppThemeStyle.editorial)
                    const Divider(height: 1),
                  for (var i = 0; i < items.length; i++) ...[
                    item(i),
                    if (style == AppThemeStyle.editorial)
                      const Divider(height: 16)
                    else
                      const SizedBox(height: 10),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
