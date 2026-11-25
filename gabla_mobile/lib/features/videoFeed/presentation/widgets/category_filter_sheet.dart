import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../categories/application/category_providers.dart';
import '../../../categories/domain/category.dart';

/// The same service categories shown as chips on the Services tab (`serviceCategoriesProvider`),
/// offered here as a flat pick-list so the video feed filters by the provider's own category.
Future<void> showVideoCategoryFilterSheet({
  required BuildContext context,
  required String? selectedCategoryId,
  required void Function(String? id, String? name) onSelected,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => _CategoryFilterSheet(
      selectedCategoryId: selectedCategoryId,
      onSelected: onSelected,
    ),
  );
}

class _CategoryFilterSheet extends ConsumerWidget {
  const _CategoryFilterSheet({required this.selectedCategoryId, required this.onSelected});
  final String? selectedCategoryId;
  final void Function(String? id, String? name) onSelected;

  void _pick(BuildContext context, String? id, String? name) {
    onSelected(id, name);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(serviceCategoriesProvider);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Filter by category', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Flexible(
              child: categories.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('Could not load categories.'),
                ),
                data: (items) => ListView(
                  shrinkWrap: true,
                  children: [
                    ListTile(
                      leading: const Icon(Icons.apps_rounded),
                      title: const Text('All categories'),
                      trailing: selectedCategoryId == null ? const Icon(Icons.check) : null,
                      onTap: () => _pick(context, null, null),
                    ),
                    for (final Category c in items)
                      ListTile(
                        leading: const Icon(Icons.local_offer_outlined),
                        title: Text(c.name),
                        trailing: selectedCategoryId == c.id ? const Icon(Icons.check) : null,
                        onTap: () => _pick(context, c.id, c.name),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
