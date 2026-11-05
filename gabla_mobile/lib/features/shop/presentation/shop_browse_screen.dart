import '../../settings/application/theme_controller.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../../ride/application/ride_providers.dart';
import '../application/commerce_providers.dart';
import '../domain/browse_query.dart';
import '../domain/product.dart';
import 'commerce_widgets.dart';
import 'product_layout.dart';

const shopSortLabels = {
  'featured': 'Recommended',
  'newest': 'Newest first',
  'price_asc': 'Price: low to high',
  'price_desc': 'Price: high to low',
  'bestsellers': 'Best sellers',
};
final providerShopCategoriesProvider =
    FutureProvider.family<List<dynamic>, String>(
      (ref, id) => ref
          .watch(apiClientProvider)
          .getList('/shop-categories/provider/${Uri.encodeComponent(id)}'),
    );

class ShopBrowseScreen extends ConsumerStatefulWidget {
  const ShopBrowseScreen({
    super.key,
    this.categoryId,
    this.providerId,
    this.collection = 'all',
    this.kind = 'product',
    this.parameters = const {},
  });
  final String? categoryId, providerId;
  final String collection, kind;
  final Map<String, String> parameters;
  @override
  ConsumerState<ShopBrowseScreen> createState() => _ShopBrowseScreenState();
}

class _ShopBrowseScreenState extends ConsumerState<ShopBrowseScreen> {
  late BrowseQuery _query;
  final _search = TextEditingController();
  final _resultsScroll = ScrollController();
  bool _uriRead = false;
  bool _list = false;
  String? _notice;
  @override
  void initState() {
    super.initState();
    final p = widget.parameters;
    Map<String, List<String>> attrs = {};
    try {
      if (p['attrs'] != null)
        attrs = (jsonDecode(p['attrs']!) as Map).map(
          (k, v) => MapEntry(k.toString(), List<String>.from(v)),
        );
    } catch (_) {}
    _query = BrowseQuery(
      categoryId: widget.categoryId,
      providerId: widget.providerId,
      collection: widget.collection,
      kind: widget.kind,
      q: p['q'] ?? '',
      sort:
          p['sort'] ??
          (widget.collection == 'new'
              ? 'newest'
              : widget.collection == 'bestsellers'
              ? 'bestsellers'
              : 'featured'),
      district: p['district'] ?? '',
      min: double.tryParse(p['min'] ?? ''),
      max: double.tryParse(p['max'] ?? ''),
      discount: p['discount'] == '1',
      everywhere: p['loc'] == 'all',
      country: p['country'] ?? '',
      culture: p['culture'] ?? '',
      attrs: attrs,
      page: int.tryParse(p['page'] ?? '') ?? 1,
    );
    _search.text = _query.q;
    _restore();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (p['near'] == '1') _loadNear();
      if (widget.categoryId != null && widget.kind == 'product')
        trackCommerce(ref, {
          'type': 'category',
          'productCategoryId': widget.categoryId,
        });
    });
  }

  Future<void> _loadNear() async {
    try {
      final point = await ref
          .read(deviceLocationServiceProvider)
          .currentLocation();
      if (mounted)
        setState(
          () => _query = _query
              .copyWith(clearLocation: true)
              .copyWith(lat: point.lat, lng: point.lng),
        );
    } catch (_) {
      if (mounted)
        setState(() {
          _query = _query.copyWith(clearLocation: true, everywhere: true);
          _notice = 'Location unavailable. Showing results across Uganda.';
        });
    }
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(
      () => _list =
          prefs.getBool('gabla_shop_list') ??
          (ref.read(themeControllerProvider).style == AppThemeStyle.editorial),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_uriRead) return;
    _uriRead = true;
    if (GoRouter.maybeOf(context) != null) {
      final all = GoRouterState.of(context).uri.queryParametersAll;
      final attrs = <String, List<String>>{};
      for (final e in all.entries) {
        if (e.key.startsWith('a.')) attrs[e.key.substring(2)] = e.value;
      }
      if (attrs.isNotEmpty)
        _query = _query.copyWith(attrs: attrs, page: _query.page);
    }
  }

  @override
  void dispose() {
    _resultsScroll.dispose();
    _search.dispose();
    super.dispose();
  }

  void _change(BrowseQuery q) {
    final previous = _query;
    ModalRoute.of(context)?.addLocalHistoryEntry(
      LocalHistoryEntry(
        onRemove: () {
          if (mounted)
            setState(() {
              _query = previous;
              _search.text = previous.q;
            });
        },
      ),
    );
    setState(() => _query = q);
    if (_resultsScroll.hasClients) {
      if (MediaQuery.disableAnimationsOf(context)) {
        _resultsScroll.jumpTo(0);
      } else {
        _resultsScroll.animateTo(
          0,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutCubic,
        );
      }
    }
  }

  Future<void> _filters() async {
    final style = ref.read(themeControllerProvider).style;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final BrowseQuery? result;
    if (style == AppThemeStyle.gabla || style == AppThemeStyle.discover) {
      result = await showModalBottomSheet<BrowseQuery>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(style == AppThemeStyle.discover ? 32 : 20),
          ),
        ),
        builder: (_) => FractionallySizedBox(
          heightFactor: .94,
          child: ShopFilterSheet(query: _query),
        ),
      );
    } else {
      result = await showGeneralDialog<BrowseQuery>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'Dismiss filters',
        barrierColor: Colors.black54,
        transitionDuration: Duration(milliseconds: reduced ? 0 : 420),
        pageBuilder: (context, _, _) => SafeArea(
          child: Align(
            alignment: style == AppThemeStyle.editorial
                ? Alignment.centerRight
                : Alignment.center,
            child: FractionallySizedBox(
              widthFactor: style == AppThemeStyle.editorial ? .96 : .94,
              heightFactor: .94,
              child: Material(
                color: Theme.of(context).colorScheme.surface,
                clipBehavior: Clip.antiAlias,
                borderRadius: BorderRadius.circular(commerceRadius(style)),
                child: Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: ShopFilterSheet(query: _query),
                ),
              ),
            ),
          ),
        ),
        transitionBuilder: (context, animation, secondary, child) {
          if (reduced) return child;
          final eased = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          if (style == AppThemeStyle.editorial)
            return SlideTransition(
              position: Tween(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(eased),
              child: child,
            );
          return FadeTransition(
            opacity: eased,
            child: ScaleTransition(
              alignment: style == AppThemeStyle.orbit
                  ? Alignment.bottomRight
                  : Alignment.center,
              scale: Tween(
                begin: style == AppThemeStyle.orbit ? .82 : 1.04,
                end: 1.0,
              ).animate(eased),
              child: child,
            ),
          );
        },
      );
    }
    if (!mounted || result == null) return;
    _change(result);
  }

  @override
  Widget build(BuildContext context) {
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final tree =
        ref.watch(commerceCategoryTreeProvider(_query.kind)).valueOrNull ?? [];
    final node = findShopNode(tree, _query.categoryId);
    final district = ref
        .watch(sessionControllerProvider)
        .valueOrNull
        ?.user
        .district;
    final effective =
        _query.district.isEmpty &&
            _query.lat == null &&
            !_query.everywhere &&
            _query.providerId == null &&
            _query.sort == 'featured'
        ? _query.copyWith(around: district ?? '', page: _query.page)
        : _query;
    final result = ref.watch(browseResultsProvider(effective));
    final title =
        node?['name']?.toString() ??
        switch (widget.collection) {
          'new' => 'New arrivals',
          'bestsellers' => 'Best sellers',
          _ =>
            widget.providerId != null
                ? 'Business catalog'
                : widget.kind == 'service'
                ? 'Services'
                : 'All products',
        };
    final data = result.valueOrNull;
    final items = (data?['items'] as List? ?? [])
        .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return CommerceScaffold(
      appBar: CommerceAppBar(
        actions: [
          IconButton(
            tooltip: 'Share this collection',
            icon: const Icon(Icons.ios_share_outlined),
            onPressed: () async {
              final params = <String, dynamic>{
                if (_query.q.isNotEmpty) 'q': _query.q,
                'sort': _query.sort,
                if (_query.min != null) 'min': '${_query.min}',
                if (_query.max != null) 'max': '${_query.max}',
                if (_query.discount) 'discount': '1',
                if (_query.district.isNotEmpty) 'district': _query.district,
                if (_query.lat != null) 'near': '1',
                if (_query.everywhere) 'loc': 'all',
                if (_query.country.isNotEmpty) 'country': _query.country,
                if (_query.culture.isNotEmpty) 'culture': _query.culture,
                for (final e in _query.attrs.entries) 'a.${e.key}': e.value,
              };
              final path = _query.providerId != null
                  ? '/provider/${_query.providerId}'
                  : _query.categoryId != null
                  ? '/shop/${_query.categoryId}'
                  : '/shop/all';
              await Clipboard.setData(
                ClipboardData(
                  text: Uri.https('gogabla.com', path, params).toString(),
                ),
              );
              if (context.mounted)
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Collection link copied')),
                );
            },
          ),
        ],
        title: widget.providerId != null
            ? 'Business catalog'
            : widget.kind == 'service'
            ? 'Services'
            : 'Shop',
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(browseResultsProvider(effective));
          ref.invalidate(browseFacetsProvider(effective));
          await ref.read(browseResultsProvider(effective).future);
        },
        child: CustomScrollView(
          controller: _resultsScroll,
          key: PageStorageKey(
            'browse-${widget.categoryId}-${widget.providerId}',
          ),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: DesignEntrance(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: AppTypography.of(context).display(
                                size: style == AppThemeStyle.editorial
                                    ? 30
                                    : 26,
                              ),
                            ),
                          ),
                          if (style == AppThemeStyle.orbit)
                            CircleAvatar(
                              radius: 25,
                              backgroundColor: c.secondaryContainer,
                              child: Icon(
                                Icons.explore_outlined,
                                color: c.onSecondaryContainer,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 9),
                      Text(
                        '${data?['total'] ?? '…'} results · ${_query.lat != null
                            ? 'Within 15 km'
                            : _query.district.isNotEmpty
                            ? _query.district
                            : 'All Uganda'}',
                        style: TextStyle(
                          color: c.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          hintText: widget.kind == 'service'
                              ? 'Search services'
                              : 'Search products',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: IconButton(
                            tooltip: 'Search',
                            icon: const Icon(Icons.arrow_forward),
                            onPressed: () {
                              _change(_query.copyWith(q: _search.text));
                              trackCommerce(ref, {
                                'type': 'search',
                                'query': _search.text.trim(),
                              });
                            },
                          ),
                        ),
                        onSubmitted: (v) {
                          _change(_query.copyWith(q: v));
                          if (v.trim().isNotEmpty)
                            trackCommerce(ref, {
                              'type': 'search',
                              'query': v.trim(),
                            });
                        },
                      ),
                      const SizedBox(height: 14),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            FilledButton.tonalIcon(
                              onPressed: _filters,
                              icon: const Icon(Icons.tune, size: 18),
                              label: Text(
                                'Filters${_query.activeCount > 0 ? ' · ${_query.activeCount}' : ''}',
                              ),
                            ),
                            const SizedBox(width: 10),
                            PopupMenuButton<String>(
                              tooltip: 'Sort results',
                              initialValue: _query.sort,
                              onSelected: (s) =>
                                  _change(_query.copyWith(sort: s)),
                              itemBuilder: (_) => [
                                for (final entry in shopSortLabels.entries)
                                  PopupMenuItem(
                                    value: entry.key,
                                    child: Text(entry.value),
                                  ),
                              ],
                              child: Chip(
                                avatar: const Icon(Icons.swap_vert, size: 17),
                                label: Text(
                                  shopSortLabels[_query.sort] ?? 'Sort',
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: _list
                                  ? 'Switch to grid'
                                  : 'Switch to list',
                              onPressed: () async {
                                setState(() => _list = !_list);
                                final prefs =
                                    await SharedPreferences.getInstance();
                                await prefs.setBool('gabla_shop_list', _list);
                              },
                              icon: Icon(
                                _list
                                    ? Icons.grid_view
                                    : Icons.view_agenda_outlined,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_query.activeCount > 0 ||
                          _query.q.isNotEmpty ||
                          _query.district.isNotEmpty ||
                          _query.lat != null)
                        Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          children: [
                            if (_query.q.isNotEmpty)
                              InputChip(
                                label: Text('“${_query.q}”'),
                                onDeleted: () {
                                  _search.clear();
                                  _change(_query.copyWith(q: ''));
                                },
                              ),
                            if (_query.min != null || _query.max != null)
                              InputChip(
                                label: Text(
                                  'UGX ${_query.min?.round() ?? 0} – ${_query.max?.round() ?? 'any'}',
                                ),
                                onDeleted: () =>
                                    _change(_query.copyWith(clearPrice: true)),
                              ),
                            if (_query.discount)
                              InputChip(
                                label: const Text('On sale'),
                                onDeleted: () =>
                                    _change(_query.copyWith(discount: false)),
                              ),
                            if (_query.district.isNotEmpty ||
                                _query.lat != null)
                              InputChip(
                                label: Text(
                                  _query.lat != null
                                      ? 'Near me'
                                      : _query.district,
                                ),
                                onDeleted: () => _change(
                                  _query.copyWith(
                                    clearLocation: true,
                                    everywhere: true,
                                  ),
                                ),
                              ),
                            if (_query.country.isNotEmpty)
                              InputChip(
                                label: const Text('Country selected'),
                                onDeleted: () =>
                                    _change(_query.copyWith(country: '')),
                              ),
                            if (_query.culture.isNotEmpty)
                              InputChip(
                                label: const Text('Culture selected'),
                                onDeleted: () =>
                                    _change(_query.copyWith(culture: '')),
                              ),
                            for (final entry in _query.attrs.entries)
                              for (final value in entry.value)
                                InputChip(
                                  label: Text(value),
                                  onDeleted: () {
                                    final attrs = {..._query.attrs};
                                    attrs[entry.key] = entry.value
                                        .where((v) => v != value)
                                        .toList();
                                    attrs.removeWhere((k, v) => v.isEmpty);
                                    _change(_query.copyWith(attrs: attrs));
                                  },
                                ),
                          ],
                        ),
                      if (data?['widened'] == true)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'We widened your search to find more matches.',
                          ),
                        ),
                      if (_notice != null) Text(_notice!),
                      if (data?['arrangedAround'] != null)
                        Text('Arranged around ${data!['arrangedAround']}'),
                      if (district != null &&
                          _query.district.isEmpty &&
                          !_query.everywhere)
                        TextButton.icon(
                          icon: const Icon(
                            Icons.location_on_outlined,
                            size: 16,
                          ),
                          onPressed: () =>
                              _change(_query.copyWith(district: district)),
                          label: Text('Search around $district'),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverToBoxAdapter(
                child: result.when(
                  loading: () => const CommerceLoading(),
                  error: (e, _) => CommerceEmpty(
                    title: 'Couldn’t load results',
                    message: 'Check your connection and try again.',
                    action: 'Try again',
                    onAction: () =>
                        ref.invalidate(browseResultsProvider(effective)),
                  ),
                  data: (_) => items.isEmpty
                      ? CommerceEmpty(
                          title: 'No matching results',
                          message:
                              'Try a broader search or adjust your filters.',
                          action: 'Reset filters',
                          onAction: () => _change(
                            BrowseQuery(
                              categoryId: widget.categoryId,
                              providerId: widget.providerId,
                              collection: widget.collection,
                              kind: widget.kind,
                            ),
                          ),
                        )
                      : AnimatedSwitcher(
                          duration: MediaQuery.disableAnimationsOf(context)
                              ? Duration.zero
                              : const Duration(milliseconds: 300),
                          child: ProductLayout(
                            key: ValueKey(
                              '$_list-${_query.page}-${_query.sort}',
                            ),
                            items: items,
                            listView: _list,
                          ),
                        ),
                ),
              ),
            ),
            if (data != null && (data['total'] as num? ?? 0) > 24)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton(
                        onPressed: _query.page > 1
                            ? () => _change(
                                _query.copyWith(page: _query.page - 1),
                              )
                            : null,
                        child: const Text('Previous'),
                      ),
                      Text(
                        '${_query.page} / ${((data['total'] as num) / 24).ceil()}',
                      ),
                      FilledButton(
                        onPressed: _query.page * 24 < (data['total'] as num)
                            ? () => _change(
                                _query.copyWith(page: _query.page + 1),
                              )
                            : null,
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

class ShopFilterSheet extends ConsumerStatefulWidget {
  const ShopFilterSheet({super.key, required this.query});
  final BrowseQuery query;
  @override
  ConsumerState<ShopFilterSheet> createState() => _ShopFilterSheetState();
}

class _ShopFilterSheetState extends ConsumerState<ShopFilterSheet> {
  late BrowseQuery _draft = widget.query;
  late final _min = TextEditingController(
    text: _draft.min?.toStringAsFixed(0) ?? '',
  );
  late final _max = TextEditingController(
    text: _draft.max?.toStringAsFixed(0) ?? '',
  );
  final _district = TextEditingController();
  String? _notice;
  bool _locating = false;
  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    _district.dispose();
    super.dispose();
  }

  void _update(BrowseQuery q) => setState(() => _draft = q);
  Future<void> _near() async {
    setState(() => _locating = true);
    try {
      final p = await ref.read(deviceLocationServiceProvider).currentLocation();
      if (!mounted) return;
      _update(
        _draft.copyWith(clearLocation: true).copyWith(lat: p.lat, lng: p.lng),
      );
    } catch (_) {
      if (mounted)
        setState(
          () => _notice =
              'Location unavailable. Choose a district or search all Uganda.',
        );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final facets = ref.watch(browseFacetsProvider(_draft)).valueOrNull ?? {};
    final tree =
        ref.watch(commerceCategoryTreeProvider(_draft.kind)).valueOrNull ?? [];
    final node = findShopNode(tree, _draft.categoryId);
    final defs = (node?['effectiveListingFields'] as List? ?? []);
    final attrs = Map<String, dynamic>.from(facets['attributes'] as Map? ?? {});
    final audience = ref.watch(audienceCatalogProvider).valueOrNull ?? {};
    final shopCats = _draft.providerId != null
        ? ref
                  .watch(providerShopCategoriesProvider(_draft.providerId!))
                  .valueOrNull ??
              []
        : <dynamic>[];
    final categoryFacets =
        (_draft.providerId != null &&
            (_draft.categoryId != null || _draft.shopCategoryId != null))
        ? ref
                  .watch(
                    browseFacetsProvider(_draft.copyWith(clearCategory: true)),
                  )
                  .valueOrNull ??
              facets
        : facets;
    final counts = Map<String, dynamic>.from(
      categoryFacets[shopCats.isNotEmpty
                  ? 'shopCategoryCounts'
                  : _draft.kind == 'service'
                  ? 'serviceCategoryCounts'
                  : 'categoryCounts']
              as Map? ??
          {},
    );
    Widget heading(String t) => Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 12),
      child: Text(t, style: Theme.of(context).textTheme.titleMedium),
    );
    int subtreeCount(Map raw) =>
        (counts[raw['id']] as num? ?? 0).toInt() +
        (raw['children'] as List? ?? []).fold<int>(
          0,
          (n, c) => n + subtreeCount(c),
        );
    List<Widget> categories(List<dynamic> nodes, [int depth = 0]) => [
      for (final raw in nodes) ...[
        Padding(
          padding: EdgeInsets.only(left: depth * 14.0),
          child: RadioListTile<String>(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: raw['id'].toString(),
            groupValue: shopCats.isEmpty
                ? _draft.categoryId
                : _draft.shopCategoryId,
            title: Text(raw['name']?.toString() ?? 'Category'),
            secondary: Text(
              '${subtreeCount(raw)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            onChanged: (id) => _update(
              _draft
                  .copyWith(clearCategory: true)
                  .copyWith(
                    categoryId: shopCats.isEmpty ? id : null,
                    shopCategoryId: shopCats.isNotEmpty ? id : null,
                  ),
            ),
          ),
        ),
        ...categories(raw['children'] as List? ?? [], depth + 1),
      ],
    ];
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Filter results',
                  style: AppTypography.of(context).display(size: 29),
                ),
              ),
              TextButton(
                onPressed: () {
                  _min.clear();
                  _max.clear();
                  _update(
                    BrowseQuery(
                      categoryId: widget.query.categoryId,
                      providerId: widget.query.providerId,
                      kind: widget.query.kind,
                      collection: widget.query.collection,
                    ),
                  );
                },
                child: const Text('Reset'),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 30),
            children: [
              heading('Location'),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.near_me_outlined, size: 16),
                    label: Text(_locating ? 'Locating…' : 'Near me · 15 km'),
                    onPressed: _locating ? null : _near,
                  ),
                  ActionChip(
                    label: const Text('All Uganda'),
                    onPressed: () => _update(
                      _draft.copyWith(clearLocation: true, everywhere: true),
                    ),
                  ),
                ],
              ),
              if (_notice != null)
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _notice!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (_draft.district.isNotEmpty || _draft.lat != null)
                Text(
                  _draft.lat != null
                      ? 'Using your current position'
                      : _draft.district,
                ),
              Autocomplete<String>(
                optionsBuilder: (v) =>
                    ((facets['districts'] as List? ?? []).map(
                      (d) => d['name'].toString(),
                    )).where(
                      (d) => d.toLowerCase().contains(v.text.toLowerCase()),
                    ),
                onSelected: (v) => _update(
                  _draft.copyWith(clearLocation: true).copyWith(district: v),
                ),
                fieldViewBuilder: (context, controller, focus, submit) =>
                    TextField(
                      controller: controller,
                      focusNode: focus,
                      decoration: const InputDecoration(
                        labelText: 'Choose a district',
                      ),
                      onSubmitted: (v) {
                        if ((facets['districts'] as List? ?? []).any(
                          (d) => d['name'] == v,
                        ))
                          _update(
                            _draft
                                .copyWith(clearLocation: true)
                                .copyWith(district: v),
                          );
                      },
                    ),
              ),
              heading('Price range · UGX'),
              if (_notice?.contains('price') == true ||
                  _notice?.contains('numeric') == true)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      _notice!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _min,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Minimum'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _max,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Maximum'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                children: [
                  for (final b
                      in (facets['price'] as Map? ?? {})['buckets'] as List? ??
                          [])
                    ActionChip(
                      label: Text(
                        '${b['min'] ?? 0} – ${b['max'] ?? 'any'} · ${b['count']}',
                      ),
                      onPressed: () {
                        _min.text = b['min']?.toString() ?? '';
                        _max.text = b['max'] == null
                            ? ''
                            : ((b['max'] as num) - 1).toString();
                        _update(
                          _draft
                              .copyWith(clearPrice: true)
                              .copyWith(
                                min: double.tryParse(_min.text),
                                max: double.tryParse(_max.text),
                              ),
                        );
                      },
                    ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('On sale only'),
                subtitle: Text('${facets['discountCount'] ?? 0} available'),
                value: _draft.discount,
                onChanged: (v) => _update(_draft.copyWith(discount: v)),
              ),
              for (final kind in ['countries', 'cultures'])
                if ((audience[kind] as List? ?? []).isNotEmpty) ...[
                  heading(
                    kind == 'countries' ? 'Country served' : 'Culture served',
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final a in audience[kind] as List)
                        FilterChip(
                          label: Text(a['name'].toString()),
                          selected:
                              (kind == 'countries'
                                  ? _draft.country
                                  : _draft.culture) ==
                              a['id'],
                          onSelected: (v) => _update(
                            kind == 'countries'
                                ? _draft.copyWith(country: v ? a['id'] : '')
                                : _draft.copyWith(culture: v ? a['id'] : ''),
                          ),
                        ),
                    ],
                  ),
                ],
              for (final entry in attrs.entries) ...[
                heading(
                  defs
                          .cast<Map>()
                          .where((f) => f['key'] == entry.key)
                          .firstOrNull?['label']
                          ?.toString() ??
                      entry.key.replaceAllMapped(
                        RegExp(r'[A-Z]'),
                        (m) => ' ${m[0]}',
                      ),
                ),
                Wrap(
                  spacing: 6,
                  children: [
                    for (final option in entry.value as List)
                      FilterChip(
                        label: Text('${option['value']} · ${option['count']}'),
                        selected:
                            _draft.attrs[entry.key]?.contains(
                              option['value'].toString(),
                            ) ??
                            false,
                        onSelected: (selected) {
                          final next = {..._draft.attrs};
                          final values = [...?next[entry.key]];
                          if (selected) {
                            values.add(option['value'].toString());
                          } else {
                            values.remove(option['value'].toString());
                          }
                          if (values.isEmpty) {
                            next.remove(entry.key);
                          } else {
                            next[entry.key] = values;
                          }
                          _update(_draft.copyWith(attrs: next));
                        },
                      ),
                  ],
                ),
              ],
              heading('Categories'),
              TextButton(
                onPressed: () => _update(_draft.copyWith(clearCategory: true)),
                child: const Text('All categories'),
              ),
              ...categories(shopCats.isNotEmpty ? shopCats : tree),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              12,
              20,
              12 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  final min = double.tryParse(_min.text.trim()),
                      max = double.tryParse(_max.text.trim());
                  if ((_min.text.trim().isNotEmpty &&
                          (min == null || !min.isFinite)) ||
                      (_max.text.trim().isNotEmpty &&
                          (max == null || !max.isFinite))) {
                    setState(
                      () =>
                          _notice = 'Enter numeric minimum and maximum prices.',
                    );
                    return;
                  }
                  if ((min != null && min < 0) ||
                      (max != null && max < 0) ||
                      (min != null && max != null && min > max)) {
                    setState(() => _notice = 'Enter a valid price range.');
                    return;
                  }
                  Navigator.pop(
                    context,
                    _draft
                        .copyWith(clearPrice: true)
                        .copyWith(min: min, max: max),
                  );
                },
                child: const Text('Apply filters'),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
