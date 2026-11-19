import 'provider_engagement_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/page_band.dart';
import '../../../core/motion/design_transitions.dart';
import '../../shop/application/commerce_providers.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../shop/presentation/product_gallery.dart';
import '../../shop/presentation/shop_browse_screen.dart';
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
  const ProviderDetailScreen({
    super.key,
    required this.providerId,
    this.parameters = const {},
  });
  final Map<String, String> parameters;
  final String providerId;
  @override
  ConsumerState<ProviderDetailScreen> createState() =>
      _ProviderDetailScreenState();
}

class _ProviderDetailScreenState extends ConsumerState<ProviderDetailScreen> {
  final _catalogue = GlobalKey();
  final _contact = GlobalKey();
  String? _selectedKind;

  void _jumpTo(GlobalKey key) {
    final target = key.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

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
    return provider.when(
      loading: () => const Scaffold(
        appBar: CommerceAppBar(title: 'Storefront'),
        body: CommerceLoading(),
      ),
      error: (error, _) => Scaffold(
        appBar: const CommerceAppBar(title: 'Storefront'),
        body: CommerceEmpty(
          title: 'Couldn’t load this shop',
          message: error.toString(),
          action: 'Try again',
          onAction: () =>
              ref.invalidate(providerDetailProvider(widget.providerId)),
        ),
      ),
      data: (p) {
        final name = p['businessName']?.toString().trim() ?? '';
        final business = name.isEmpty ? 'Storefront' : name;
        final media = p['media'] as Map? ?? {};
        final location = p['location'] as Map? ?? {};
        final node = findShopNode(categories, p['categoryId']?.toString());
        final stats = p['stats'] as Map? ?? {};
        final answers = Map<String, dynamic>.from(
          p['customFields'] as Map? ?? {},
        );
        final fields = (node?['effectiveProviderFields'] as List? ?? [])
            .cast<Map>();
        final gallery = (media['gallery'] as List? ?? [])
            .whereType<String>()
            .toList();
        final description = p['description']?.toString().trim() ?? '';
        final items = listings.valueOrNull ?? [];
        final products = items.where((p) => p.type == 'product').length;
        final services = items.length - products;
        final requested =
            _selectedKind ??
            widget.parameters['type'] ??
            (widget.parameters['tab'] == 'services' ? 'service' : null);
        final kind =
            (requested == 'service' && (services > 0 || items.isEmpty)) ||
                (products == 0 && services > 0)
            ? 'service'
            : 'product';
        var parameters = _selectedKind == null
            ? widget.parameters
            : const <String, String>{};
        if (kind == 'product' && parameters.containsKey('cat')) {
          final collections = ref.watch(
            providerShopCategoriesProvider(widget.providerId),
          );
          if (collections.isLoading && !collections.hasValue) {
            return const Scaffold(
              appBar: CommerceAppBar(title: 'Storefront'),
              body: CommerceLoading(),
            );
          }
          if (collections.valueOrNull?.isNotEmpty == true) {
            parameters = {...parameters};
            parameters['shopCat'] = parameters.remove('cat')!;
          }
        }
        final radius = BorderRadius.circular(commerceRadius(style));
        final cover = media['coverUrl']?.toString();
        final avatarUrl = media['avatarUrl']?.toString();
        final meta = [node?['name'], location['city'], location['region']]
            .whereType<String>()
            .where((value) => value.trim().isNotEmpty)
            .toSet()
            .join(' · ');
        final avatar = CircleAvatar(
          radius: style == AppThemeStyle.orbit ? 36 : 30,
          backgroundColor: c.surface,
          child: CircleAvatar(
            radius: style == AppThemeStyle.orbit ? 33 : 27,
            backgroundColor: c.primaryContainer,
            foregroundColor: c.onPrimaryContainer,
            foregroundImage: avatarUrl?.isNotEmpty == true
                ? NetworkImage(avatarUrl!)
                : null,
            onForegroundImageError: avatarUrl?.isNotEmpty == true
                ? (_, _) {}
                : null,
            child: Text(
              business.characters.first.toUpperCase(),
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            ),
          ),
        );
        final heading = Column(
          crossAxisAlignment: style == AppThemeStyle.orbit
              ? CrossAxisAlignment.center
              : CrossAxisAlignment.start,
          children: [
            if (meta.isNotEmpty)
              Text(
                meta,
                textAlign: style == AppThemeStyle.orbit
                    ? TextAlign.center
                    : TextAlign.start,
                style: TextStyle(color: c.onSurfaceVariant),
              ),
            Text(
              business,
              textAlign: style == AppThemeStyle.orbit
                  ? TextAlign.center
                  : TextAlign.start,
              style: AppTypography.of(
                context,
              ).display(size: style == AppThemeStyle.editorial ? 34 : 28),
            ),
          ],
        );
        final identity = PageBand(
          color: c.surface,
          elevation: 4,
          borderRadius: radius,
          children: [
            if (style == AppThemeStyle.orbit) ...[
              avatar,
              const SizedBox(height: 8),
              heading,
            ] else
              Row(
                children: [
                  avatar,
                  const SizedBox(width: 12),
                  Expanded(child: heading),
                ],
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 14,
              runSpacing: 8,
              children: [
                if (p['isApproved'] == true)
                  const _StoreFact(
                    Icons.verified_outlined,
                    'Verified business',
                  ),
                _StoreFact(
                  Icons.star_outline,
                  (p['ratingCount'] as num? ?? 0) > 0
                      ? '${p['ratingAvg']} · ${p['ratingCount']} reviews'
                      : 'No reviews yet',
                ),
                _StoreFact(
                  Icons.inventory_2_outlined,
                  '${stats['listingCount'] ?? items.length} listings',
                ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 6,
              children: [
                FilledButton(
                  onPressed: () => _jumpTo(_catalogue),
                  child: const Text('Browse listings'),
                ),
                OutlinedButton(
                  onPressed: () => _jumpTo(_contact),
                  child: const Text('Contact seller'),
                ),
              ],
            ),
          ],
        );
        final storefront = Column(
          children: [
            Stack(
              children: [
                SizedBox(
                  height: style == AppThemeStyle.cinematic ? 214 : 165,
                  width: double.infinity,
                  child: cover?.isNotEmpty == true
                      ? CommerceImage(cover)
                      : ColoredBox(
                          color: c.primaryContainer,
                          child: Icon(
                            Icons.storefront_outlined,
                            size: 52,
                            color: c.onPrimaryContainer,
                          ),
                        ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    style == AppThemeStyle.cinematic ? 180 : 130,
                    16,
                    0,
                  ),
                  child: DesignEntrance(child: identity),
                ),
              ],
            ),
          ],
        );
        final tabs = KeyedSubtree(
          key: _catalogue,
          child: products > 0 && services > 0
              ? SizedBox(
                  width: double.infinity,
                  child: SegmentedButton<String>(
                    segments: [
                      ButtonSegment(
                        value: 'product',
                        icon: const Icon(Icons.shopping_bag_outlined),
                        label: Text('Products ($products)'),
                      ),
                      ButtonSegment(
                        value: 'service',
                        icon: const Icon(Icons.handyman_outlined),
                        label: Text('Services ($services)'),
                      ),
                    ],
                    showSelectedIcon: false,
                    selected: {kind},
                    onSelectionChanged: (value) {
                      setState(() => _selectedKind = value.single);
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted) _jumpTo(_catalogue);
                      });
                    },
                  ),
                )
              : listings.hasError
              ? TextButton(
                  onPressed: () => ref.invalidate(
                    providerListingsProvider(widget.providerId),
                  ),
                  child: const Text('Reload listing types'),
                )
              : const SizedBox.shrink(),
        );
        Widget section(String title, List<Widget> children, {Color? color}) =>
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: PageBand(
                color: color ?? c.surface,
                elevation: 2,
                borderRadius: radius,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  ...children,
                ],
              ),
            );
        final footer = Column(
          children: [
            if (description.isNotEmpty ||
                answers.isNotEmpty ||
                (p['audiences'] as List? ?? []).isNotEmpty)
              section('About $business', [
                if (description.isNotEmpty)
                  Text(description, style: const TextStyle(height: 1.55)),
                if (answers.isNotEmpty)
                  CommerceAttributes(values: answers, fields: fields),
                if ((p['audiences'] as List? ?? []).isNotEmpty)
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final a in (p['audiences'] as List).whereType<Map>())
                        Chip(label: Text('Serves ${a['name']}')),
                    ],
                  ),
              ]),
            Padding(
              key: _contact,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: ProviderContactPanel(providerId: widget.providerId),
            ),
            if (gallery.isNotEmpty)
              section('Gallery', [
                SizedBox(
                  height: 250,
                  child: ProductGallery(
                    images: gallery,
                    radius: commerceRadius(style),
                  ),
                ),
              ]),
            section('Business reviews & inquiries', [
              ProviderEngagementPanel(providerId: widget.providerId),
            ], color: c.surfaceContainerLow),
          ],
        );
        return ShopBrowseScreen(
          key: ValueKey((widget.providerId, kind)),
          providerId: widget.providerId,
          kind: kind,
          parameters: parameters,
          storefrontHeader: storefront,
          storefrontTabs: tabs,
          storefrontFooter: footer,
          storefrontName: business,
          onStorefrontRefresh: () async {
            await Future.wait([
              ref.refresh(providerDetailProvider(widget.providerId).future),
              ref.refresh(providerListingsProvider(widget.providerId).future),
            ]);
          },
        );
      },
    );
  }
}

class _StoreFact extends StatelessWidget {
  const _StoreFact(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 5),
      Flexible(
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
      ),
    ],
  );
}
