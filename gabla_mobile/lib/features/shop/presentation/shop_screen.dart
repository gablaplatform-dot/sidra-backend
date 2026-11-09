import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../categories/domain/category.dart';
import '../application/shop_providers.dart';
import '../application/commerce_providers.dart';
import '../domain/product.dart';
import 'commerce_widgets.dart';
import 'product_layout.dart';
import 'shop_browse_screen.dart';
import 'shop_hero.dart';
import 'widgets/product_card.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key, this.categoryId, this.parameters = const {}});
  final String? categoryId;
  final Map<String, String> parameters;
  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(rootCategoriesProvider);
    ref.invalidate(newArrivalsProvider);
    ref.invalidate(bestSellersProvider);
    ref.invalidate(shopAdsProvider);
    ref.invalidate(shopPromotionsProvider);
    ref.invalidate(forYouProvider);
    await ref.read(newArrivalsProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.categoryId != null)
      return ShopBrowseScreen(
        categoryId: widget.categoryId,
        parameters: widget.parameters,
      );
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final cats = ref.watch(rootCategoriesProvider);
    final arrivals = ref.watch(newArrivalsProvider);
    final best = ref.watch(bestSellersProvider);
    final ads = ref.watch(shopAdsProvider);
    final promos = ref.watch(shopPromotionsProvider);
    final forYou = ref.watch(forYouProvider);
    final feed = forYou.valueOrNull;
    List<Product> products(dynamic value) => (value as List? ?? [])
        .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    Widget shelf(
      String title,
      AsyncValue<List<Product>> value,
      String path, {
      String? subtitle,
      bool horizontal = false,
    }) => Column(
      children: [
        CommerceTitle(
          title,
          subtitle: subtitle,
          action: () => context.push(path),
        ),
        value.when(
          loading: () => const CommerceLoading(rows: 2),
          error: (e, _) => CommerceEmpty(
            title: 'This collection is taking a moment',
            message: 'Pull down to refresh, or browse all finds.',
            onAction: () => context.push('/shop/all'),
          ),
          data: (items) => items.isEmpty
              ? const SizedBox.shrink()
              : horizontal
              ? SizedBox(
                  height:
                      370 +
                      (MediaQuery.textScalerOf(context).scale(1) - 1) * 180,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 14),
                    itemBuilder: (context, i) => SizedBox(
                      width: 220,
                      child: ProductCard(
                        product: items[i],
                        onTap: (n) => context.push(
                          '/shop/product/${n.product.id}',
                          extra: n,
                        ),
                      ),
                    ),
                  ),
                )
              : ProductLayout(items: items),
        ),
      ],
    );
    final personalized =
        feed == null ||
            (products(feed['items']).isEmpty &&
                products(feed['recentlyViewed']).isEmpty)
        ? const SizedBox.shrink()
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommerceTitle(
                'Picked for you',
                subtitle:
                    feed['headline']?.toString() ??
                    'Good finds, shaped around your interests.',
              ),
              if (feed['personalized'] == true)
                TextButton(
                  onPressed: () async {
                    final clear = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Clear shopping history?'),
                        content: const Text(
                          'Your personalized picks will start fresh.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Keep history'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Clear history'),
                          ),
                        ],
                      ),
                    );
                    if (clear == true) {
                      try {
                        await clearCommerceHistory(ref);
                      } catch (e) {
                        if (context.mounted)
                          ScaffoldMessenger.of(
                            context,
                          ).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    }
                  },
                  child: const Text('Clear browsing history'),
                ),
              Wrap(
                spacing: 7,
                children: [
                  for (final cat in feed['categories'] as List? ?? [])
                    ActionChip(
                      label: Text(cat['name'].toString()),
                      onPressed: () => context.push('/shop/${cat['id']}'),
                    ),
                  for (final q in feed['recentSearches'] as List? ?? [])
                    ActionChip(
                      avatar: const Icon(Icons.history, size: 14),
                      label: Text(q.toString()),
                      onPressed: () => context.push(
                        '/shop/all?q=${Uri.encodeComponent(q.toString())}',
                      ),
                    ),
                ],
              ),
              if (products(feed['recentlyViewed']).isNotEmpty)
                shelf(
                  'Take another look',
                  AsyncData(products(feed['recentlyViewed'])),
                  '/shop/all',
                  horizontal: true,
                ),
              if (products(feed['items']).isNotEmpty)
                ProductLayout(
                  items: products(feed['items']),
                  listView: style == AppThemeStyle.editorial,
                ),
            ],
          );
    final categories = Column(
      children: [
        CommerceTitle(
          'Shop by category',
          action: () => context.push('/shop/categories'),
        ),
        cats.when(
          loading: () => const CommerceLoading(rows: 1),
          error: (_, _) => TextButton(
            onPressed: () => ref.invalidate(rootCategoriesProvider),
            child: const Text('Reload categories'),
          ),
          data: (items) => style == AppThemeStyle.orbit
              ? Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    for (final cat in items)
                      ActionChip(
                        avatar: const Icon(Icons.category_outlined, size: 18),
                        label: Text(cat.name),
                        onPressed: () => context.push('/shop/${cat.id}'),
                      ),
                  ],
                )
              : SizedBox(
                  height: style == AppThemeStyle.editorial ? 145 : 115,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, i) => _CategoryTile(
                      category: items[i],
                      editorial: style == AppThemeStyle.editorial,
                    ),
                  ),
                ),
        ),
      ],
    );
    final promotions = Column(
      children: [
        for (final raw in promos.valueOrNull ?? [])
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: PromotionBanner(promotion: Map<String, dynamic>.from(raw)),
          ),
      ],
    );
    return Scaffold(
      appBar: CommerceAppBar(
        title: switch (style) {
          AppThemeStyle.editorial => 'Gabla / The shop',
          AppThemeStyle.cinematic => 'GABLA SELECT',
          AppThemeStyle.orbit => 'Your shopping orbit',
          _ => 'Gabla shop',
        },
        actions: [
          IconButton(
            tooltip: 'My orders',
            onPressed: () => context.push('/orders'),
            icon: const Icon(Icons.receipt_long_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _search,
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'What are you looking for?',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          tooltip: 'Browse and filter',
                          onPressed: () => context.push('/shop/all'),
                          icon: const Icon(Icons.tune),
                        ),
                      ),
                      onSubmitted: (q) {
                        if (q.trim().isNotEmpty) {
                          trackCommerce(ref, {
                            'type': 'search',
                            'query': q.trim(),
                          });
                          context.push(
                            '/shop/all?q=${Uri.encodeComponent(q.trim())}',
                          );
                        }
                      },
                    ),
                    const SizedBox(height: 18),
                    AnimatedBuilder(
                      animation: _scroll,
                      builder: (context, _) => ShopHero(
                        ads: ads.valueOrNull ?? [],
                        scrollOffset: _scroll.hasClients ? _scroll.offset : 0,
                      ),
                    ),
                    categories,
                    if (style == AppThemeStyle.discover ||
                        style == AppThemeStyle.orbit)
                      personalized,
                    if (style == AppThemeStyle.cinematic)
                      shelf(
                        'The most-loved edit',
                        best,
                        '/shop/best-sellers',
                        horizontal: true,
                      ),
                    shelf(
                      style == AppThemeStyle.editorial
                          ? 'Fresh off the shelf'
                          : 'New arrivals',
                      arrivals,
                      '/shop/new-arrivals',
                      subtitle: 'The latest from shops on Gabla.',
                      horizontal:
                          style == AppThemeStyle.discover ||
                          style == AppThemeStyle.orbit,
                    ),
                    if (style == AppThemeStyle.editorial) promotions,
                    if (style != AppThemeStyle.cinematic)
                      shelf(
                        'Best sellers',
                        best,
                        '/shop/best-sellers',
                        horizontal: style == AppThemeStyle.editorial,
                      ),
                    if (style != AppThemeStyle.discover &&
                        style != AppThemeStyle.orbit)
                      personalized,
                    if (style != AppThemeStyle.editorial) promotions,
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/shop/all'),
                        icon: Icon(Icons.arrow_outward, color: c.primary),
                        label: const Text('Explore every find'),
                      ),
                    ),
                    const SizedBox(height: 40),
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

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, this.editorial = false});
  final Category category;
  final bool editorial;
  @override
  Widget build(BuildContext context) => DesignEntrance(
    child: InkWell(
      onTap: () => context.push('/shop/${category.id}'),
      borderRadius: BorderRadius.circular(editorial ? 4 : 20),
      child: SizedBox(
        width: 110,
        child: Column(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(editorial ? 4 : 20),
                child: SizedBox.expand(
                  child: CategoryCover(category: category),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              category.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    ),
  );
}

class PromotionBanner extends StatefulWidget {
  const PromotionBanner({super.key, required this.promotion});
  final Map<String, dynamic> promotion;
  @override
  State<PromotionBanner> createState() => _PromotionBannerState();
}

class _PromotionBannerState extends State<PromotionBanner> {
  Timer? _timer;
  late DateTime? _end;
  @override
  void initState() {
    super.initState();
    _end = DateTime.tryParse(widget.promotion['endsAt']?.toString() ?? '');
    final seconds = num.tryParse(
      widget.promotion['remainingSecs']?.toString() ?? '',
    );
    if (_end == null && seconds != null && seconds > 0)
      _end = DateTime.now().add(Duration(seconds: seconds.toInt()));
    if (_end != null)
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.promotion;
    final remaining = _end?.difference(DateTime.now()).inSeconds;
    if (remaining != null && remaining <= 0) return const SizedBox.shrink();
    return CommercePanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (p['imageUrl'] != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 150,
                width: double.infinity,
                child: CommerceImage(p['imageUrl'].toString()),
              ),
            ),
          CommerceTitle(
            p['title']?.toString() ?? 'In the spotlight',
            subtitle: p['subtitle']?.toString(),
          ),
          if (remaining != null)
            Text(
              '${(remaining ~/ 3600).toString().padLeft(2, '0')} : ${(remaining ~/ 60 % 60).toString().padLeft(2, '0')} : ${(remaining % 60).toString().padLeft(2, '0')}',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
            ),
          TextButton.icon(
            onPressed: () =>
                openCommerceLink(context, p['ctaHref']?.toString()),
            icon: const Icon(Icons.arrow_outward),
            label: Text(p['ctaLabel']?.toString() ?? 'View collection'),
          ),
        ],
      ),
    );
  }
}
