import 'provider_engagement_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/utils/money.dart';
import '../../shop/application/commerce_providers.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../shop/presentation/product_gallery.dart';
import '../../shop/presentation/product_layout.dart';
import '../application/provider_providers.dart';
import 'provider_contact_panel.dart';

final providerListingsProvider = FutureProvider.family<List<Product>, String>(
  (ref, id) async =>
      (await ref
              .watch(apiClientProvider)
              .getList(
                '/listings/provider/${Uri.encodeComponent(id)}',
                query: {'limit': 100},
              ))
          .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
);
final providerCategoryTreeProvider = FutureProvider<List<dynamic>>(
  (ref) => ref.watch(apiClientProvider).getList('/categories'),
);

class ProviderDetailScreen extends ConsumerStatefulWidget {
  const ProviderDetailScreen({super.key, required this.providerId});
  final String providerId;
  @override
  ConsumerState<ProviderDetailScreen> createState() =>
      _ProviderDetailScreenState();
}

class _ProviderDetailScreenState extends ConsumerState<ProviderDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final api = ref.read(apiClientProvider);
        final device = await ref.read(commerceDeviceIdProvider.future);
        await api.post(
          '/engagement/providers/${Uri.encodeComponent(widget.providerId)}/visit',
          body: {'source': 'provider_detail', 'sessionId': device},
        );
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = ref.watch(providerDetailProvider(widget.providerId));
    final listings = ref.watch(providerListingsProvider(widget.providerId));
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final categories =
        ref.watch(providerCategoryTreeProvider).valueOrNull ?? [];
    return CommerceScaffold(
      appBar: const CommerceAppBar(title: 'Business profile'),
      body: provider.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(20),
          child: CommerceLoading(),
        ),
        error: (e, _) => CommerceEmpty(
          title: 'This shop couldn’t be loaded',
          message: 'Check your connection and try loading this business again.',
          action: 'Try again',
          onAction: () =>
              ref.invalidate(providerDetailProvider(widget.providerId)),
        ),
        data: (p) {
          final media = Map<String, dynamic>.from(p['media'] as Map? ?? {});
          final suppliedName = p['businessName']?.toString().trim() ?? '';
          final name = suppliedName.isEmpty ? 'Business' : suppliedName;
          final node = findShopNode(categories, p['categoryId']?.toString());
          final layout =
              (node?['settings'] as Map?)?['layout']?.toString() ?? 'default';
          final fields = (node?['effectiveProviderFields'] as List? ?? [])
              .cast<Map>();
          final answers = Map<String, dynamic>.from(
            p['customFields'] as Map? ?? {},
          );
          final gallery = (media['gallery'] as List? ?? [])
              .whereType<String>()
              .toList();
          final location = Map<String, dynamic>.from(
            p['location'] as Map? ?? {},
          );
          final stats = p['stats'] as Map? ?? {};
          final avatar = ClipRRect(
            borderRadius: BorderRadius.circular(
              style == AppThemeStyle.editorial ? 4 : 50,
            ),
            child: SizedBox(
              width: 80,
              height: 80,
              child: media['avatarUrl'] != null
                  ? CommerceImage(media['avatarUrl'].toString())
                  : ColoredBox(
                      color: c.primaryContainer,
                      child: Center(
                        child: Text(
                          name.substring(0, 1).toUpperCase(),
                          style: TextStyle(
                            fontSize: 34,
                            color: c.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ),
            ),
          );
          final heading = Column(
            crossAxisAlignment: style == AppThemeStyle.orbit
                ? CrossAxisAlignment.center
                : CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: AppTypography.of(
                  context,
                ).display(size: style == AppThemeStyle.editorial ? 30 : 24),
              ),
              const SizedBox(height: 8),
              Text(
                [
                  node?['name']?.toString(),
                  location['city']?.toString(),
                  location['region']?.toString(),
                ].whereType<String>().toSet().join(' · '),
                textAlign: style == AppThemeStyle.orbit
                    ? TextAlign.center
                    : TextAlign.start,
                style: TextStyle(color: c.onSurfaceVariant, fontSize: 12),
              ),
              if (p['isApproved'] == true)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.verified_outlined, size: 15, color: c.primary),
                      const SizedBox(width: 5),
                      const Flexible(
                        child: Text(
                          'Gabla approved',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(providerDetailProvider(widget.providerId));
              ref.invalidate(providerListingsProvider(widget.providerId));
              await ref.read(providerDetailProvider(widget.providerId).future);
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (media['coverUrl'] != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(
                        commerceRadius(style),
                      ),
                      child: SizedBox(
                        height: style == AppThemeStyle.cinematic ? 210 : 150,
                        width: double.infinity,
                        child: CommerceImage(media['coverUrl'].toString()),
                      ),
                    ),
                  ),
                if (style == AppThemeStyle.orbit)
                  Column(
                    children: [avatar, const SizedBox(height: 16), heading],
                  )
                else if (style == AppThemeStyle.editorial)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      heading,
                      const SizedBox(height: 18),
                      avatar,
                      const Divider(height: 30),
                    ],
                  )
                else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      avatar,
                      const SizedBox(width: 18),
                      Expanded(child: heading),
                    ],
                  ),
                const SizedBox(height: 24),
                CommercePanel(
                  child: Wrap(
                    alignment: WrapAlignment.spaceAround,
                    spacing: 24,
                    runSpacing: 16,
                    children: [
                      _Stat(
                        '${stats['listingCount'] ?? listings.valueOrNull?.length ?? 0}',
                        'Listings',
                      ),
                      _Stat(
                        (p['ratingCount'] as num? ?? 0) > 0
                            ? '${p['ratingAvg']}'
                            : 'New',
                        '${p['ratingCount'] ?? 0} reviews',
                      ),
                      if (p['createdAt'] != null)
                        _Stat(
                          DateTime.tryParse(
                                p['createdAt'].toString(),
                              )?.year.toString() ??
                              '—',
                          'Member since',
                        ),
                    ],
                  ),
                ),
                if ((p['audiences'] as List? ?? []).isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Wrap(
                      spacing: 6,
                      children: [
                        for (final a in p['audiences'] as List)
                          Chip(label: Text('Serves ${a['name']}')),
                      ],
                    ),
                  ),
                if (p['description'] != null &&
                    p['description'].toString().isNotEmpty) ...[
                  const CommerceTitle('About'),
                  Text(
                    p['description'].toString(),
                    style: const TextStyle(height: 1.6),
                  ),
                ],
                if (answers.isNotEmpty) ...[
                  const CommerceTitle('About this business'),
                  CommercePanel(
                    child: CommerceAttributes(values: answers, fields: fields),
                  ),
                ],
                const SizedBox(height: 24),
                ProviderContactPanel(providerId: widget.providerId),
                ProviderEngagementPanel(providerId: widget.providerId),
                if (gallery.isNotEmpty) ...[
                  CommerceTitle(
                    layout == 'portfolio' ? 'Their work' : 'Inside the shop',
                  ),
                  SizedBox(
                    height: 310,
                    child: ProductGallery(
                      images: gallery,
                      radius: commerceRadius(style),
                    ),
                  ),
                ],
                CommerceTitle(
                  layout == 'menu'
                      ? 'The menu'
                      : layout == 'booking'
                      ? 'Bookable services'
                      : 'Products and services',
                  action: () => context.push(
                    '/provider/${widget.providerId}/catalog?type=${(listings.valueOrNull ?? []).any((p) => p.type == 'product') ? 'product' : 'service'}',
                  ),
                  label: 'Filter & explore',
                ),
                listings.when(
                  loading: () => const CommerceLoading(),
                  error: (_, _) => TextButton(
                    onPressed: () => ref.invalidate(
                      providerListingsProvider(widget.providerId),
                    ),
                    child: const Text('Reload listings'),
                  ),
                  data: (items) => items.isEmpty
                      ? const CommerceEmpty(
                          title: 'No public listings',
                          message: 'This provider has no public listings yet.',
                        )
                      : layout == 'menu'
                      ? Column(
                          children: [
                            for (final item in items)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(item.name),
                                subtitle: item.description == null
                                    ? null
                                    : Text(
                                        item.description!,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                trailing: Text(formatUgx(item.price)),
                                onTap: () =>
                                    context.push('/shop/product/${item.id}'),
                              ),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${items.length} published ${items.length == 1 ? 'listing' : 'listings'}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 12),
                            ProductLayout(
                              items: items.take(8).toList(),
                              listView:
                                  style == AppThemeStyle.editorial ||
                                  layout == 'booking',
                            ),
                          ],
                        ),
                ),
                if (listings.valueOrNull?.any((p) => p.type == 'service') ??
                    false)
                  TextButton.icon(
                    onPressed: () => context.push(
                      '/provider/${widget.providerId}/catalog?type=service',
                    ),
                    icon: const Icon(Icons.handyman_outlined),
                    label: const Text('Browse & filter services'),
                  ),
                const SizedBox(height: 30),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label);
  final String value, label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(value, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 4),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}
