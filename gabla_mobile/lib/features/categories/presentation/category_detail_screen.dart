import '../../shop/application/commerce_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/discovery/discovery_widgets.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../provider/domain/provider_summary.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/category_providers.dart';
import '../domain/category.dart';
import 'widgets/category_cover.dart';

Category? findDirectoryCategory(List<Category> items, String id) {
  for (final c in items) {
    if (c.id == id) return c;
    final found = findDirectoryCategory(c.children, id);
    if (found != null) return found;
  }
  return null;
}

final directoryContentProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
      final api = ref.watch(apiClientProvider);
      final uri = Uri.parse(id);
      final query = <String, dynamic>{
        'categoryId': uri.path,
        'limit': 50,
        ...uri.queryParameters,
      };
      final results = await Future.wait([
        api.getList('/providers', query: query),
        api.getList('/listings', query: query),
      ]);
      return {'providers': results[0], 'listings': results[1]};
    });

class CategoryDetailScreen extends ConsumerStatefulWidget {
  const CategoryDetailScreen({super.key, required this.categoryId});
  final String categoryId;
  @override
  ConsumerState<CategoryDetailScreen> createState() =>
      _CategoryDetailScreenState();
}

class _CategoryDetailScreenState extends ConsumerState<CategoryDetailScreen> {
  String _country = '', _culture = '';
  String get categoryId => widget.categoryId;
  @override
  Widget build(BuildContext context) {
    final queryKey = Uri(
      path: categoryId,
      queryParameters: {
        if (_country.isNotEmpty) 'countryId': _country,
        if (_culture.isNotEmpty) 'cultureId': _culture,
      },
    ).toString();
    final audiences = ref.watch(audienceCatalogProvider).valueOrNull ?? {};
    final tree = ref.watch(directoryCategoriesProvider);
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Explore the directory'),
      body: AsyncValueView(
        value: tree,
        onRetry: () => ref.invalidate(directoryCategoriesProvider),
        data: (context, items) {
          final category = findDirectoryCategory(items, categoryId);
          if (category == null)
            return CommerceEmpty(
              title: 'Category unavailable',
              message: 'Explore the directory for more businesses.',
              onAction: () => context.go('/home'),
              action: 'Go home',
            );
          return ListView(
            padding: const EdgeInsets.all(18),
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(
                  commerceRadius(commerceStyle(ref)),
                ),
                child: Stack(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 230,
                      child: CategoryCover(category: category),
                    ),
                    const Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.transparent, Colors.black87],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 20,
                      bottom: 20,
                      right: 20,
                      child: Text(
                        category.name,
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (category.children.isNotEmpty) ...[
                const CommerceTitle('Explore a little deeper'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final c in category.children)
                      ActionChip(
                        label: Text(c.name),
                        onPressed: () => context.push('/category/${c.id}'),
                      ),
                  ],
                ),
              ],
              const CommerceTitle('Discover local expertise'),
              for (final group in ['countries', 'cultures'])
                if ((audiences[group] as List? ?? []).isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: DropdownButtonFormField<String>(
                      initialValue: null,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: group == 'countries'
                            ? 'Country served'
                            : 'Culture served',
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('All communities'),
                        ),
                        for (final a in audiences[group] as List)
                          DropdownMenuItem(
                            value: '${a['id']}',
                            child: Text('${a['name']}'),
                          ),
                      ],
                      onChanged: (v) => setState(() {
                        if (group == 'countries') {
                          _country = v ?? '';
                        } else {
                          _culture = v ?? '';
                        }
                      }),
                    ),
                  ),

              AsyncValueView(
                value: ref.watch(directoryContentProvider(queryKey)),
                onRetry: () =>
                    ref.invalidate(directoryContentProvider(queryKey)),
                data: (context, data) {
                  final providers = (data['providers'] as List)
                      .map(
                        (v) => ProviderSummary.fromJson(
                          Map<String, dynamic>.from(v),
                        ),
                      )
                      .toList();
                  final listings = (data['listings'] as List)
                      .map(
                        (v) => Product.fromJson(Map<String, dynamic>.from(v)),
                      )
                      .toList();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final p in providers)
                        ProviderDiscoveryCard(provider: p),
                      if (listings.isNotEmpty)
                        const CommerceTitle('Products & services'),
                      for (final p in listings)
                        ListingDiscoveryCard(product: p),
                      if (providers.isEmpty && listings.isEmpty)
                        CommerceEmpty(
                          title: 'More discoveries ahead',
                          message:
                              'This category has no published listings yet. Try another category or search nearby.',
                          action: 'Search nearby',
                          onAction: () => context.push('/nearby'),
                          icon: Icons.explore_outlined,
                        ),
                    ],
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
