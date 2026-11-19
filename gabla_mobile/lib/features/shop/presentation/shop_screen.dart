import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme_style.dart';
import '../../categories/domain/category.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../application/commerce_providers.dart';
import '../application/discovery_feed.dart';
import '../application/shop_providers.dart';
import '../application/photo_search.dart';
import '../domain/browse_query.dart';
import 'commerce_widgets.dart';
import 'discovery_grid.dart';
import 'shop_browse_screen.dart' show ShopFilterSheet;
import 'photo_search_sheet.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key, this.categoryId, this.parameters = const {}});
  final String? categoryId;
  final Map<String, String> parameters;
  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;
  int _seed = Random.secure().nextInt(0x7fffffff);
  String? _rootId;
  BrowseQuery? _query;
  String _categorySearch = '';
  PhotoSearchSelection? _photoSelection;
  bool _openingPhotoSearch = false;

  @override
  void initState() {
    super.initState();
    _rootId = widget.categoryId;
    _search.text = widget.parameters['q'] ?? '';
    if (_rootId != null || _search.text.trim().isNotEmpty) {
      _query = BrowseQuery(
        categoryId: _rootId,
        q: _search.text,
        sort: 'discovery',
        discoverySeed: '$_seed',
        min: double.tryParse(widget.parameters['min'] ?? ''),
        max: double.tryParse(widget.parameters['max'] ?? ''),
        discount: widget.parameters['discount'] == '1',
      );
    }
    _scroll.addListener(_loadMore);
    WidgetsBinding.instance.addPostFrameCallback((_) => _recoverPhoto());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  void _loadMore() {
    final query = _query;
    if (query == null ||
        !_scroll.hasClients ||
        _scroll.position.extentAfter > 600) {
      return;
    }
    final feed = ref.read(discoveryFeedProvider(query));
    if (feed.error == null) {
      ref.read(discoveryFeedProvider(query).notifier).loadMore();
    }
  }

  void _change(BrowseQuery query) {
    _debounce?.cancel();
    setState(() => _query = query);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _searchProducts(String text, {bool dismissKeyboard = true}) {
    final value = text.trim();
    if (value.isEmpty) return;
    if (dismissKeyboard) FocusManager.instance.primaryFocus?.unfocus();
    _rootId = null;
    _photoSelection = null;
    _change(BrowseQuery(q: value, sort: 'discovery', discoverySeed: '$_seed'));
  }

  void _openCategory(Category category) {
    _debounce?.cancel();
    _search.clear();
    _rootId = category.id;
    _photoSelection = null;
    _change(
      BrowseQuery(
        categoryId: category.id,
        sort: 'discovery',
        discoverySeed: '$_seed',
      ),
    );
  }

  void _backToCategories() {
    _debounce?.cancel();
    _search.clear();
    setState(() {
      _query = null;
      _rootId = null;
      _categorySearch = '';
      _photoSelection = null;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  Future<void> _recoverPhoto() async {
    if (!mounted) return;
    try {
      final photo = await ref.read(photoSearchServiceProvider).recover();
      if (mounted && photo != null) await _openPhotoSearch(initialPhoto: photo);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'That photo couldn’t be restored. Please choose it again.',
            ),
          ),
        );
      }
    }
  }

  Future<void> _openPhotoSearch({Uint8List? initialPhoto}) async {
    if (_openingPhotoSearch) return;
    _debounce?.cancel();
    if (_query != null && _search.text.trim() != _query!.q) {
      _change(_query!.copyWith(q: _search.text.trim()));
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _openingPhotoSearch = true);
    ref.invalidate(photoSearchControllerProvider);
    try {
      final result = await showModalBottomSheet<PhotoSearchSelection>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (_) => PhotoSearchSheet(initialPhoto: initialPhoto),
      );
      if (!mounted || result == null) return;
      _search.text = result.match.query;
      _rootId = null;
      _categorySearch = '';
      _photoSelection = result;
      // A photo chosen on the category page searches actual products, not category
      // names. Reset old category/price/location filters so a chair isn't hidden
      // merely because the previous view happened to be Electronics.
      _change(
        BrowseQuery(
          q: result.match.query,
          sort: 'discovery',
          discoverySeed: '$_seed',
        ),
      );
    } finally {
      if (mounted) setState(() => _openingPhotoSearch = false);
    }
  }

  Category? _find(List<Category> tree, String? id) {
    for (final category in tree) {
      if (category.id == id) return category;
      final child = _find(category.children, id);
      if (child != null) return child;
    }
    return null;
  }

  Category? _rootFor(List<Category> tree, String? id) {
    for (final category in tree) {
      if (category.id == id || _find(category.children, id) != null) {
        return category;
      }
    }
    return null;
  }

  bool _matches(Category category, String query) =>
      category.name.toLowerCase().contains(query) ||
      category.children.any((child) => _matches(child, query));

  Future<void> _filters(List<Category> tree) async {
    final query = _query;
    if (query == null) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final result = await showModalBottomSheet<BrowseQuery>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => FractionallySizedBox(
        heightFactor: .94,
        child: ShopFilterSheet(query: query),
      ),
    );
    if (!mounted || result == null) return;
    final applied = result.copyWith(sort: 'discovery', discoverySeed: '$_seed');
    _search.text = applied.q;
    if (applied.categoryId == null) {
      final root = _rootFor(tree, _rootId)?.id ?? _rootId;
      _change(applied.copyWith(categoryId: root));
    } else {
      _rootId = _rootFor(tree, applied.categoryId)?.id ?? applied.categoryId;
      _change(applied);
    }
  }

  Future<void> _refresh() async {
    _debounce?.cancel();
    setState(() {
      _seed = Random.secure().nextInt(0x7fffffff);
      final old = _query;
      if (old != null) {
        _query = BrowseQuery(
          categoryId: old.categoryId,
          sort: old.sort,
          discoverySeed: '$_seed',
          q: old.q,
          min: old.min,
          max: old.max,
          discount: old.discount,
          district: old.district,
          lat: old.lat,
          lng: old.lng,
          country: old.country,
          culture: old.culture,
          attrs: old.attrs,
        );
      }
    });
    if (_query == null) {
      ref.invalidate(rootCategoriesProvider);
      ref.invalidate(productTreeProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final roots = ref.watch(rootCategoriesProvider);
    final fullTree = ref.watch(productTreeProvider);
    final tree = (fullTree.valueOrNull ?? []).map(Category.fromJson).toList();
    final categories = tree.isEmpty ? roots.valueOrNull ?? <Category>[] : tree;
    final shuffled = [...categories]..shuffle(Random(_seed));
    final visible = shuffled
        .where(
          (category) =>
              _matches(category, _categorySearch.trim().toLowerCase()),
        )
        .toList();
    final root = _rootFor(categories, _rootId) ?? _find(categories, _rootId);
    final radius = switch (style) {
      AppThemeStyle.editorial => 8.0,
      AppThemeStyle.orbit => 10.0,
      AppThemeStyle.cinematic => 12.0,
      AppThemeStyle.gabla => 16.0,
      AppThemeStyle.discover => 18.0,
    };
    final query = _query;
    final feed = query == null ? null : ref.watch(discoveryFeedProvider(query));
    if (query != null) {
      ref.listen(discoveryFeedProvider(query), (_, next) {
        if (!next.loading && next.hasMore && next.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadMore();
          });
        }
      });
    }
    return PopScope(
      canPop: query == null,
      onPopInvokedWithResult: (popped, _) {
        if (!popped) _backToCategories();
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                child: Row(
                  children: [
                    if (query != null)
                      IconButton(
                        tooltip: 'Back to categories',
                        onPressed: _backToCategories,
                        icon: const Icon(Icons.arrow_back_ios_new, size: 23),
                      ),
                    Expanded(
                      key: const ValueKey('shop-search-field'),
                      child: TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        onChanged: (value) {
                          _debounce?.cancel();
                          if (_photoSelection != null) {
                            setState(() => _photoSelection = null);
                          }
                          if (_query == null) {
                            setState(() => _categorySearch = value);
                            final term = value.trim();
                            if (term.length >= 2 &&
                                !categories.any(
                                  (category) =>
                                      _matches(category, term.toLowerCase()),
                                )) {
                              _debounce = Timer(
                                const Duration(milliseconds: 650),
                                () {
                                  if (mounted &&
                                      _query == null &&
                                      _search.text.trim() == term) {
                                    _searchProducts(
                                      term,
                                      dismissKeyboard: false,
                                    );
                                  }
                                },
                              );
                            }
                          } else {
                            _debounce = Timer(
                              const Duration(milliseconds: 350),
                              () {
                                if (mounted && _query != null) {
                                  _change(_query!.copyWith(q: value.trim()));
                                }
                              },
                            );
                          }
                        },
                        onSubmitted: (value) {
                          if (_query != null) {
                            _change(_query!.copyWith(q: value.trim()));
                          } else {
                            _searchProducts(value);
                          }
                        },
                        decoration: InputDecoration(
                          hintText: query == null
                              ? 'Search or describe an item'
                              : root?.name ?? 'Search products',
                          prefixIcon: query == null
                              ? const Icon(Icons.search)
                              : null,
                          suffixIcon: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_search.text.isNotEmpty)
                                IconButton(
                                  tooltip: 'Clear search',
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () {
                                    if (_query != null && _rootId == null) {
                                      _backToCategories();
                                      return;
                                    }
                                    _search.clear();
                                    if (_query == null) {
                                      setState(() => _categorySearch = '');
                                    } else {
                                      _change(_query!.copyWith(q: ''));
                                    }
                                  },
                                ),
                              IconButton(
                                tooltip: 'Search by photo',
                                onPressed: _openingPhotoSearch
                                    ? null
                                    : _openPhotoSearch,
                                icon: const Icon(
                                  Icons.image_search_outlined,
                                  size: 23,
                                ),
                              ),
                            ],
                          ),
                          isDense: true,
                          filled: false,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 16,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(22),
                            borderSide: BorderSide(color: c.outline),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(22),
                            borderSide: BorderSide(color: c.outlineVariant),
                          ),
                        ),
                      ),
                    ),
                    if (query != null)
                      IconButton(
                        tooltip: 'Filters',
                        onPressed: () => _filters(categories),
                        icon: Badge(
                          isLabelVisible: query.activeCount > 0,
                          label: Text('${query.activeCount}'),
                          child: const Icon(Icons.tune, size: 26),
                        ),
                      ),
                  ],
                ),
              ),
              if (_photoSelection case final selection?)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          selection.photo,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          semanticLabel: 'Your search photo',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Similar items',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            Text(
                              selection.match.intent.isEmpty
                                  ? selection.match.query
                                  : selection.match.intent,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Try another photo',
                        onPressed: _openPhotoSearch,
                        icon: const Icon(Icons.add_photo_alternate_outlined),
                      ),
                    ],
                  ),
                ),
              if (query != null && root != null)
                SizedBox(
                  height:
                      52 +
                      (MediaQuery.textScalerOf(context).scale(1) - 1).clamp(
                            0.0,
                            1.0,
                          ) *
                          20,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    scrollDirection: Axis.horizontal,
                    children: [
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: ChoiceChip(
                          label: const Text('All'),
                          selected: query.categoryId == root.id,
                          onSelected: (_) => _change(
                            query
                                .copyWith(clearCategory: true)
                                .copyWith(categoryId: root.id, attrs: const {}),
                          ),
                        ),
                      ),
                      for (final child in root.children)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 8),
                          child: ChoiceChip(
                            avatar: ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: SizedBox.square(
                                dimension: 28,
                                child: CategoryCover(category: child),
                              ),
                            ),
                            label: Text(child.name),
                            selected: query.categoryId == child.id,
                            onSelected: (_) => _change(
                              query
                                  .copyWith(clearCategory: true)
                                  .copyWith(
                                    categoryId: child.id,
                                    attrs: const {},
                                  ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: CustomScrollView(
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      if (query == null) ...[
                        if (categories.isEmpty &&
                            (roots.isLoading || fullTree.isLoading))
                          const SliverToBoxAdapter(child: DiscoverySkeleton())
                        else if (categories.isEmpty &&
                            (roots.hasError || fullTree.hasError))
                          SliverToBoxAdapter(
                            child: CommerceEmpty(
                              title: 'Couldn’t load categories',
                              message: 'Try again to browse the shop.',
                              action: 'Retry',
                              onAction: () {
                                ref.invalidate(rootCategoriesProvider);
                                ref.invalidate(productTreeProvider);
                              },
                            ),
                          )
                        else if (visible.isEmpty)
                          SliverToBoxAdapter(
                            child: CommerceEmpty(
                              title: 'No matching categories',
                              message:
                                  'Search products using this description.',
                              action: 'Search products',
                              onAction: () => _searchProducts(_search.text),
                            ),
                          )
                        else
                          DiscoveryGrid(
                            key: ValueKey('categories-$_seed'),
                            categories: visible,
                            radius: radius,
                            onCategory: _openCategory,
                          ),
                      ] else ...[
                        if (feed!.items.isNotEmpty)
                          DiscoveryGrid(
                            key: ValueKey(query),
                            products: feed.items,
                            radius: radius,
                          ),
                        if (feed.loading)
                          const SliverToBoxAdapter(child: DiscoverySkeleton())
                        else if (feed.error != null)
                          SliverToBoxAdapter(
                            child: CommerceEmpty(
                              title: feed.items.isEmpty
                                  ? 'Couldn’t load products'
                                  : 'Couldn’t load more products',
                              message: 'Your filters are saved. Try again.',
                              action: 'Retry',
                              onAction: () => ref
                                  .read(discoveryFeedProvider(query).notifier)
                                  .loadMore(),
                            ),
                          )
                        else if (feed.items.isEmpty)
                          SliverToBoxAdapter(
                            child: CommerceEmpty(
                              title: _photoSelection != null
                                  ? 'No similar items found'
                                  : 'No matching products',
                              message: _photoSelection != null
                                  ? 'No similar items found in Gabla yet. Try another photo or edit your search.'
                                  : 'Try another subcategory or adjust your filters.',
                              action: _photoSelection != null
                                  ? 'Try another photo'
                                  : 'Adjust filters',
                              onAction: _photoSelection != null
                                  ? _openPhotoSearch
                                  : () => _filters(categories),
                            ),
                          ),
                      ],
                      const SliverToBoxAdapter(child: SizedBox(height: 28)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
