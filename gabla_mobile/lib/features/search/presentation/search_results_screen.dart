import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/discovery/discovery_widgets.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../shop/application/commerce_providers.dart';
import '../application/search_providers.dart';

class SearchResultsScreen extends ConsumerStatefulWidget {
  const SearchResultsScreen({super.key, this.initialQuery});
  final String? initialQuery;
  @override
  ConsumerState<SearchResultsScreen> createState() =>
      _SearchResultsScreenState();
}

class _SearchResultsScreenState extends ConsumerState<SearchResultsScreen> {
  late final _controller = TextEditingController(
    text: widget.initialQuery ?? '',
  );
  late String _query = widget.initialQuery ?? '';
  String _tab = 'All';
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    setState(() => _query = _controller.text.trim());
    if (_query.isNotEmpty)
      trackCommerce(ref, {'type': 'search', 'query': _query});
  }

  @override
  Widget build(BuildContext context) {
    final result = ref.watch(searchResultsProvider(_query));
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Find it on Gabla'),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          TextField(
            controller: _controller,
            autofocus: _query.isEmpty,
            onSubmitted: (_) => _search(),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Products, services or businesses',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                tooltip: 'Search',
                onPressed: _search,
                icon: const Icon(Icons.arrow_forward),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_query.isEmpty) ...[
            const DiscoveryHeader(
              title: 'What are you\nlooking for?',
              subtitle:
                  'Discover a good find, a trusted professional, or a business nearby.',
            ),
            const CommerceTitle('Start exploring'),
            for (final item in [
              ('Shop products', '/shop', Icons.shopping_bag_outlined),
              ('Explore services', '/services', Icons.design_services_outlined),
              ('Search nearby', '/nearby', Icons.map_outlined),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  tileColor: Theme.of(context).colorScheme.surfaceContainerLow,
                  leading: Icon(item.$3),
                  title: Text(item.$1),
                  trailing: const Icon(Icons.arrow_forward),
                  onTap: () => context.push(item.$2),
                ),
              ),
          ] else ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final tab in [
                    'All',
                    'Products',
                    'Services',
                    'Providers',
                    'Categories',
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(tab),
                        selected: _tab == tab,
                        onSelected: (_) => setState(() => _tab = tab),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AsyncValueView(
              value: result,
              onRetry: () => ref.invalidate(searchResultsProvider(_query)),
              data: (context, r) {
                final listings = r.listings
                    .where(
                      (p) =>
                          _tab == 'All' ||
                          (_tab == 'Products' && p.type == 'product') ||
                          (_tab == 'Services' && p.type == 'service'),
                    )
                    .toList();
                final providers = _tab == 'All' || _tab == 'Providers'
                    ? r.providers
                    : r.providers.take(0).toList();
                final categories = _tab == 'All' || _tab == 'Categories'
                    ? r.categories
                    : r.categories.take(0).toList();
                if (listings.isEmpty && providers.isEmpty && categories.isEmpty)
                  return CommerceEmpty(
                    title: 'Try another search',
                    message:
                        'No matches for “$_query” in this section. Try a broader term.',
                    action: 'Browse services',
                    onAction: () => context.push('/services'),
                    icon: Icons.search_off,
                  );
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (categories.isNotEmpty) ...[
                      const CommerceTitle('Categories'),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final c in categories)
                            ActionChip(
                              label: Text(c.name),
                              onPressed: () =>
                                  context.push('/category/${c.id}'),
                            ),
                        ],
                      ),
                    ],
                    if (providers.isNotEmpty) ...[
                      const CommerceTitle('Businesses & professionals'),
                      for (final p in providers)
                        ProviderDiscoveryCard(provider: p),
                    ],
                    if (listings.isNotEmpty) ...[
                      const CommerceTitle('Products & services'),
                      for (final p in listings)
                        ListingDiscoveryCard(product: p),
                    ],
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
