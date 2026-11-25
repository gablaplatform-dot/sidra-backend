import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../categories/application/category_providers.dart';
import '../../provider/application/provider_providers.dart';
import '../../provider/domain/provider_summary.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import 'widgets/service_category_chip.dart';
import 'widgets/service_pin_card.dart';

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
                  'limit': 12,
                },
              ))
          .map((v) => Product.fromJson(Map<String, dynamic>.from(v)))
          .toList(),
);

/// A deliberately different home from the shop: a search-led, photo-forward
/// moodboard of bookable work (Pinterest / Fresha territory) instead of a
/// shelf of goods, so services reads as "find someone to do this for you",
/// not "buy a thing".
class ServicesScreen extends ConsumerWidget {
  const ServicesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = Theme.of(context).extension<StyleTokens>()!;
    final c = Theme.of(context).colorScheme;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(serviceCategoriesProvider);
          ref.invalidate(featuredServicesProvider);
          ref.invalidate(topRatedProvidersProvider);
        },
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Hero(tokens: tokens),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              sliver: SliverToBoxAdapter(
                child: _VideoFeedBanner(onTap: () => context.push('/services/videos')),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
              sliver: SliverToBoxAdapter(
                child: AsyncValueView(
                  value: ref.watch(serviceCategoriesProvider),
                  onRetry: () => ref.invalidate(serviceCategoriesProvider),
                  data: (context, items) => items.isEmpty
                      ? const SizedBox()
                      : SizedBox(
                          height: 96,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: items.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 6),
                            itemBuilder: (context, i) => ServiceCategoryChip(
                              category: items[i],
                              selected: false,
                              onTap: () => context.push('/services/c/${items[i].id}'),
                            ),
                          ),
                        ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
              sliver: SliverToBoxAdapter(
                child: CommerceTitle(
                  'Book your next experience',
                  action: () => context.push('/services/all?sort=featured'),
                  label: 'See all',
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverToBoxAdapter(
                child: AsyncValueView(
                  value: ref.watch(featuredServicesProvider),
                  onRetry: () => ref.invalidate(featuredServicesProvider),
                  data: (context, items) => items.isEmpty
                      ? CommerceEmpty(
                          title: 'Find your next professional',
                          message:
                              'Browse the categories above to see what businesses are offering.',
                          action: 'Browse services',
                          onAction: () => context.push('/services/all'),
                          icon: Icons.design_services_outlined,
                        )
                      : ServicePinBoxGrid(items: items),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextButton.icon(
                      onPressed: () => context.push('/provider/onboarding'),
                      icon: const Icon(Icons.storefront_outlined),
                      label: const Text('Bring your business to Gabla'),
                    ),
                    const CommerceTitle('Meet the professionals'),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              sliver: SliverToBoxAdapter(
                child: AsyncValueView(
                  value: ref.watch(topRatedProvidersProvider),
                  onRetry: () => ref.invalidate(topRatedProvidersProvider),
                  data: (context, items) => SizedBox(
                    height: 150,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (context, i) => _ProviderPuck(provider: items[i]),
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/profile/bookings'),
        icon: const Icon(Icons.event_available_outlined),
        label: const Text('My bookings'),
        backgroundColor: c.primaryContainer,
        foregroundColor: c.onPrimaryContainer,
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.tokens});
  final StyleTokens tokens;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 18, 20, 26),
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
              Icon(Icons.auto_awesome, size: 16, color: c.onPrimary.withValues(alpha: .85)),
              const SizedBox(width: 6),
              Text(
                'GOOD PEOPLE · GREAT WORK',
                style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.6,
                  fontWeight: FontWeight.w600,
                  color: c.onPrimary.withValues(alpha: .85),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Find a pro.\nBook in minutes.',
            style: TextStyle(
              fontSize: 30,
              height: 1.12,
              fontWeight: FontWeight.w800,
              color: c.onPrimary,
            ),
          ),
          const SizedBox(height: 18),
          Material(
            color: c.surface,
            borderRadius: BorderRadius.circular(tokens.pillRadius),
            child: InkWell(
              borderRadius: BorderRadius.circular(tokens.pillRadius),
              onTap: () => context.push('/search'),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                child: Row(
                  children: [
                    Icon(Icons.search, size: 19, color: c.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'What can we help with today?',
                        style: TextStyle(color: c.onSurfaceVariant, fontSize: 13),
                      ),
                    ),
                    IconButton(
                      tooltip: 'My bookings',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => context.push('/profile/bookings'),
                      icon: const Icon(Icons.event_available_outlined),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The entry point into the TikTok-style provider video feed (see features/videoFeed).
class _VideoFeedBanner extends StatelessWidget {
  const _VideoFeedBanner({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Material(
      color: c.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle),
                child: Icon(Icons.play_arrow_rounded, color: c.onPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Tap for videos',
                  style: TextStyle(fontWeight: FontWeight.w600, color: c.onSurface),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderPuck extends StatelessWidget {
  const _ProviderPuck({required this.provider});
  final ProviderSummary provider;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => context.push('/provider/${provider.id}'),
      child: SizedBox(
        width: 104,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 38,
              backgroundColor: c.primaryContainer,
              backgroundImage: provider.logoUrl != null
                  ? NetworkImage(provider.logoUrl!)
                  : null,
              child: provider.logoUrl == null
                  ? Text(
                      provider.businessName.isEmpty ? 'G' : provider.businessName[0],
                      style: const TextStyle(fontSize: 26),
                    )
                  : null,
            ),
            const SizedBox(height: 8),
            Text(
              provider.businessName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            Text(
              provider.ratingCount > 0
                  ? '★ ${provider.rating?.toStringAsFixed(1) ?? '—'}'
                  : 'New',
              style: TextStyle(fontSize: 10, color: c.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
