import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/money.dart';
import '../../../core/widgets/page_band.dart';
import '../../categories/domain/category.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/workspace_providers.dart';
import 'workspace_form.dart';

const _statuses = {
  '': 'All statuses',
  'approved': 'Approved',
  'pending': 'Pending review',
  'suspended': 'Suspended',
};

enum _ListingSort {
  newest('Newest first'),
  oldest('Oldest first'),
  priceLow('Price: low to high'),
  priceHigh('Price: high to low'),
  name('Name: A to Z');

  const _ListingSort(this.label);
  final String label;

  int compare(Product a, Product b) {
    final dateA = a.createdAt?.millisecondsSinceEpoch ?? 0;
    final dateB = b.createdAt?.millisecondsSinceEpoch ?? 0;
    return switch (this) {
      newest => dateB.compareTo(dateA),
      oldest => dateA.compareTo(dateB),
      priceLow => a.price.compareTo(b.price),
      priceHigh => b.price.compareTo(a.price),
      name => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
    };
  }
}

class WorkspaceListings extends ConsumerStatefulWidget {
  const WorkspaceListings({
    super.key,
    required this.rows,
    required this.onRemove,
  });

  final List<Map<String, dynamic>> rows;
  final ValueChanged<Map<String, dynamic>> onRemove;

  @override
  ConsumerState<WorkspaceListings> createState() => _WorkspaceListingsState();
}

class _WorkspaceListingsState extends ConsumerState<WorkspaceListings> {
  final _search = TextEditingController();
  String? _kind;
  bool _grid = true;
  String _status = '', _category = '';
  double? _min, _max;
  _ListingSort _sort = _ListingSort.newest;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _resetFilters() {
    _search.clear();
    _status = '';
    _category = '';
    _min = null;
    _max = null;
  }

  Iterable<({Category node, String label})> _categoryPaths(
    List<Category> nodes, [
    String parent = '',
  ]) sync* {
    for (final node in nodes) {
      final label = parent.isEmpty ? node.name : '$parent / ${node.name}';
      yield (node: node, label: label);
      yield* _categoryPaths(node.children, label);
    }
  }

  void _openFilters(Map<String, String> categories) {
    showWorkspaceForm(
      context,
      title: 'Filter listings',
      action: 'Apply filters',
      fields: [
        WorkspaceField(
          'category',
          'Category',
          options: categories.keys.toList(),
          labels: categories,
          value: _category,
        ),
        WorkspaceField(
          'status',
          'Status',
          options: _statuses.keys.toList(),
          labels: _statuses,
          value: _status,
        ),
        WorkspaceField(
          'min',
          'Minimum price (UGX)',
          type: 'number',
          value: _min,
        ),
        WorkspaceField(
          'max',
          'Maximum price (UGX)',
          type: 'number',
          value: _max,
        ),
      ],
      save: (values) async {
        final min = (values['min'] as num?)?.toDouble();
        final max = (values['max'] as num?)?.toDouble();
        if ((min != null && (!min.isFinite || min < 0)) ||
            (max != null && (!max.isFinite || max < 0)) ||
            (min != null && max != null && min > max)) {
          throw const FormatException('Enter a valid price range.');
        }
        if (!mounted) return;
        setState(() {
          _category = values['category'] as String? ?? '';
          _status = values['status'] as String? ?? '';
          _min = min;
          _max = max;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final productCount = widget.rows
        .where((row) => row['type'] == 'product')
        .length;
    final serviceCount = widget.rows.length - productCount;
    final kind =
        _kind ??
        (productCount == 0 && serviceCount > 0 ? 'service' : 'product');
    final product = kind == 'product';
    final path = product ? '/product-categories' : '/service-categories';
    final tree = workspaceItems(
      ref.watch(workspaceDataProvider(path)).valueOrNull,
    ).map(Category.fromJson).toList();
    final paths = _categoryPaths(tree).toList();
    final categories = {
      '': 'All categories',
      for (final p in paths) p.node.id: p.label,
    };
    final selected = paths.where((p) => p.node.id == _category).firstOrNull;
    final categoryIds = {
      if (_category.isNotEmpty) _category,
      if (selected != null)
        ..._categoryPaths(selected.node.children).map((p) => p.node.id),
    };
    final query = _search.text.trim().toLowerCase();
    final rows =
        [
            for (final row in widget.rows)
              if ((row['type'] == 'product') == product)
                (data: row, listing: Product.fromJson(row)),
          ].where((entry) {
            final row = entry.data;
            final listing = entry.listing;
            final category =
                row[product ? 'productCategoryId' : 'serviceCategoryId'];
            return (_status.isEmpty || row['status'] == _status) &&
                (categoryIds.isEmpty || categoryIds.contains(category)) &&
                (_min == null || listing.price >= _min!) &&
                (_max == null || listing.price <= _max!) &&
                '${listing.name} ${listing.description ?? ''} ${row['sku'] ?? ''}'
                    .toLowerCase()
                    .contains(query);
          }).toList()
          ..sort((a, b) => _sort.compare(a.listing, b.listing));
    final filterCount = [
      _category.isNotEmpty,
      _status.isNotEmpty,
      _min != null || _max != null,
    ].where((active) => active).length;
    final addLabel = product ? 'Add product' : 'Add service';
    void add() => context.push('/profile/listings/new?type=$kind');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PageBand(
          color: colors.surfaceContainerLow,
          children: [
            Text('My listings', style: theme.textTheme.headlineSmall),
            const SizedBox(height: 12),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FilledButton.icon(
                onPressed: add,
                icon: const Icon(Icons.add),
                label: Text(addLabel),
              ),
            ),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'product',
                  label: Text(
                    'Products ($productCount)',
                    textAlign: TextAlign.center,
                  ),
                ),
                ButtonSegment(
                  value: 'service',
                  label: Text(
                    'Services ($serviceCount)',
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
              selected: {kind},
              showSelectedIcon: false,
              onSelectionChanged: (selection) => setState(() {
                _kind = selection.single;
                _resetFilters();
              }),
            ),
          ],
        ),
        PageBand(
          color: colors.surfaceContainer,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
          children: [
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Search listings',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 6,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _openFilters(categories),
                  icon: const Icon(Icons.tune, size: 18),
                  label: Text(
                    filterCount == 0 ? 'Filters' : 'Filters ($filterCount)',
                  ),
                ),
                PopupMenuButton<_ListingSort>(
                  tooltip: 'Sort listings',
                  initialValue: _sort,
                  onSelected: (value) => setState(() => _sort = value),
                  itemBuilder: (_) => [
                    for (final sort in _ListingSort.values)
                      PopupMenuItem(value: sort, child: Text(sort.label)),
                  ],
                  icon: const Icon(Icons.swap_vert),
                ),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(
                      value: true,
                      icon: Icon(Icons.grid_view),
                      tooltip: 'Grid view',
                    ),
                    ButtonSegment(
                      value: false,
                      icon: Icon(Icons.view_list_outlined),
                      tooltip: 'List view',
                    ),
                  ],
                  selected: {_grid},
                  showSelectedIcon: false,
                  onSelectionChanged: (selection) =>
                      setState(() => _grid = selection.single),
                ),
              ],
            ),
            if (filterCount > 0 || query.isNotEmpty)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: () => setState(_resetFilters),
                  child: const Text('Clear filters'),
                ),
              ),
          ],
        ),
        PageBand(
          color: colors.surface,
          children: [
            Text(
              '${rows.length} ${product ? 'products' : 'services'}',
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 12),
            if (rows.isEmpty)
              CommerceEmpty(
                title: (product ? productCount : serviceCount) == 0
                    ? (product ? 'No products yet' : 'No services yet')
                    : 'No matching listings',
                message: filterCount > 0 || query.isNotEmpty
                    ? 'Try another search or clear the filters.'
                    : 'Add a listing to your business profile.',
                icon: Icons.inventory_2_outlined,
              )
            else
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = constraints.maxWidth >= 640 ? 3 : 2;
                  final width = _grid
                      ? (constraints.maxWidth - 10 * (columns - 1)) / columns
                      : constraints.maxWidth;
                  return Wrap(
                    spacing: 10,
                    runSpacing: 12,
                    children: [
                      for (final entry in rows)
                        SizedBox(
                          width: width,
                          child: _ListingCard(
                            key: ValueKey(entry.listing.id),
                            listing: entry.listing,
                            status:
                                entry.data['status']?.toString() ?? 'pending',
                            grid: _grid,
                            onRemove: () => widget.onRemove(entry.data),
                          ),
                        ),
                    ],
                  );
                },
              ),
          ],
        ),
      ],
    );
  }
}

class _ListingCard extends StatelessWidget {
  const _ListingCard({
    super.key,
    required this.listing,
    required this.status,
    required this.grid,
    required this.onRemove,
  });

  final Product listing;
  final String status;
  final bool grid;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final picture = CommerceImage(listing.imageUrl);
    final info = Padding(
      padding: const EdgeInsets.fromLTRB(10, 9, 4, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _statuses[status] ?? status,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: status == 'suspended' ? colors.error : colors.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            listing.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall,
          ),
          Text(
            listing.price > 0 ? formatUgx(listing.price) : 'Contact for price',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (!grid && listing.description?.isNotEmpty == true)
            Text(
              listing.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: 'Edit listing',
                onPressed: () =>
                    context.push('/profile/listings/${listing.id}/edit'),
                icon: const Icon(Icons.edit_outlined, size: 19),
              ),
              PopupMenuButton<String>(
                tooltip: 'Listing actions',
                onSelected: (action) {
                  if (action == 'view') {
                    context.push('/shop/product/${listing.id}');
                  } else {
                    onRemove();
                  }
                },
                itemBuilder: (_) => [
                  if (status == 'approved')
                    const PopupMenuItem(
                      value: 'view',
                      child: Text('View listing'),
                    ),
                  const PopupMenuItem(
                    value: 'remove',
                    child: Text('Remove listing'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: grid
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AspectRatio(aspectRatio: 1.35, child: picture),
                info,
              ],
            )
          : Row(
              children: [
                SizedBox(width: 92, height: 104, child: picture),
                Expanded(child: info),
              ],
            ),
    );
  }
}
