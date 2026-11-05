import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/discovery/discovery_widgets.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../categories/application/category_providers.dart';
import '../../provider/application/provider_providers.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';

final featuredServicesProvider = FutureProvider<List<Product>>(
  (ref) async =>
      (await ref
              .watch(apiClientProvider)
              .getList(
                '/listings',
                query: {
                  'type': 'service',
                  'bookable': true,
                  'sort': 'featured',
                  'limit': 6,
                },
              ))
          .map((v) => Product.fromJson(Map<String, dynamic>.from(v)))
          .toList(),
);

class ServicesScreen extends ConsumerWidget {
  const ServicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => CommerceScaffold(
    appBar: CommerceAppBar(
      title: 'Services',
      actions: [
        IconButton(
          tooltip: 'My bookings',
          onPressed: () => context.push('/profile/bookings'),
          icon: const Icon(Icons.event_available_outlined),
        ),
      ],
    ),
    body: RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(serviceCategoriesProvider);
        ref.invalidate(featuredServicesProvider);
        ref.invalidate(topRatedProvidersProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          DiscoveryHeader(
            title: 'Services',
            subtitle:
                'Browse providers, compare services and check availability.',
            child: TextField(
              readOnly: true,
              onTap: () => context.push('/search'),
              decoration: const InputDecoration(
                hintText: 'Search services',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          CommerceTitle(
            'Explore services',
            action: () => context.push('/services/all'),
            label: 'Browse all',
          ),
          AsyncValueView(
            value: ref.watch(serviceCategoriesProvider),
            onRetry: () => ref.invalidate(serviceCategoriesProvider),
            data: (context, items) => items.isEmpty
                ? CommerceEmpty(
                    title: 'Find your next professional',
                    message:
                        'Browse all services to see what businesses are offering.',
                    action: 'Browse services',
                    onAction: () => context.push('/services/all'),
                    icon: Icons.design_services_outlined,
                  )
                : Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      for (var i = 0; i < items.length; i++)
                        SizedBox(
                          width: (MediaQuery.sizeOf(context).width - 48) / 2,
                          child: DesignEntrance(
                            index: i,
                            child: InkWell(
                              onTap: () =>
                                  context.push('/services/c/${items[i].id}'),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(
                                  commerceRadius(commerceStyle(ref)),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (items[i].imageUrl?.isNotEmpty == true)
                                      SizedBox(
                                        height: 100,
                                        child: CommerceImage(items[i].imageUrl),
                                      )
                                    else
                                      const CommerceIconArt(
                                        icon: Icons.design_services_outlined,
                                        height: 100,
                                      ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 12,
                                        horizontal: 8,
                                      ),
                                      child: Text(
                                        items[i].name,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.titleSmall,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
          CommerceTitle(
            'Featured services',
            action: () => context.push('/services/all?sort=featured'),
          ),
          AsyncValueView(
            value: ref.watch(featuredServicesProvider),
            onRetry: () => ref.invalidate(featuredServicesProvider),
            data: (context, items) => items.isEmpty
                ? const CommercePanel(
                    child: Text(
                      'Explore the service categories above and contact a provider to arrange your visit.',
                    ),
                  )
                : Column(
                    children: [
                      for (final p in items) ListingDiscoveryCard(product: p),
                    ],
                  ),
          ),
          TextButton.icon(
            onPressed: () => context.push('/provider/onboarding'),
            icon: const Icon(Icons.storefront_outlined),
            label: const Text('Open a business invitation'),
          ),
          const CommerceTitle('Service providers'),
          AsyncValueView(
            value: ref.watch(topRatedProvidersProvider),
            onRetry: () => ref.invalidate(topRatedProvidersProvider),
            data: (context, items) => Column(
              children: [
                for (final p in items) ProviderDiscoveryCard(provider: p),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
