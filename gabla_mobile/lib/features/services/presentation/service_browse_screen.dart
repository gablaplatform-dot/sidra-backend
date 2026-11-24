import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/theme/style_tokens.dart';
import '../../auth/application/session_controller.dart';
import '../../categories/application/category_providers.dart';
import '../../ride/application/ride_providers.dart';
import '../../shop/application/commerce_providers.dart';
import '../../shop/domain/browse_query.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../shop/presentation/shop_browse_screen.dart' show ShopFilterSheet, shopSortLabels;
import 'widgets/service_category_chip.dart';
import 'widgets/service_pin_card.dart';

/// Services, browsed as a moodboard: a sticky search + round category rail
/// above a Pinterest-style masonry of bookable work - deliberately not the
/// product shelf (`ShopBrowseScreen`/`ProductLayout`) the two used to share.
/// Reuses the same `BrowseQuery`/facets/results providers as the shop (same
/// backend contract, same filter sheet), only the chrome and the result
/// cards are new.
class ServiceBrowseScreen extends ConsumerStatefulWidget {
  const ServiceBrowseScreen({
    super.key,
    this.categoryId,
    this.parameters = const {},
  });
  final String? categoryId;
  final Map<String, String> parameters;
  @override
  ConsumerState<ServiceBrowseScreen> createState() => _ServiceBrowseScreenState();
}

class _ServiceBrowseScreenState extends ConsumerState<ServiceBrowseScreen> {
  late BrowseQuery _query;
  final _search = TextEditingController();
  final _scroll = ScrollController();
  String? _notice;

  @override
  void initState() {
    super.initState();
    final p = widget.parameters;
    _query = BrowseQuery(
      kind: 'service',
      categoryId: widget.categoryId ?? p['cat'],
      q: p['q'] ?? '',
      sort: p['sort'] ?? 'featured',
      district: p['district'] ?? '',
      min: double.tryParse(p['min'] ?? ''),
      max: double.tryParse(p['max'] ?? ''),
      everywhere: p['loc'] == 'all',
      country: p['country'] ?? '',
      culture: p['culture'] ?? '',
      page: int.tryParse(p['page'] ?? '') ?? 1,
    );
    _search.text = _query.q;
    if (p['near'] == '1') {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadNear());
    }
  }

  Future<void> _loadNear() async {
    try {
      final point = await ref.read(deviceLocationServiceProvider).currentLocation();
      if (mounted) {
        setState(
          () => _query = _query.copyWith(clearLocation: true).copyWith(lat: point.lat, lng: point.lng),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _query = _query.copyWith(clearLocation: true, everywhere: true);
          _notice = 'Location unavailable. Showing services across Uganda.';
        });
      }
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  void _change(BrowseQuery q) {
    final previous = _query;
    ModalRoute.of(context)?.addLocalHistoryEntry(
      LocalHistoryEntry(
        onRemove: () {
          if (mounted) setState(() {
            _query = previous;
            _search.text = previous.q;
          });
        },
      ),
    );
    setState(() => _query = q);
    if (_scroll.hasClients) {
      if (MediaQuery.disableAnimationsOf(context)) {
        _scroll.jumpTo(0);
      } else {
        _scroll.animateTo(0, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
      }
    }
  }

  Future<void> _filters() async {
    final result = await showModalBottomSheet<BrowseQuery>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => FractionallySizedBox(
        heightFactor: .94,
        child: ShopFilterSheet(query: _query),
      ),
    );
    if (!mounted || result == null) return;
    _change(result);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<StyleTokens>()!;
    final c = Theme.of(context).colorScheme;
    final tree = ref.watch(commerceCategoryTreeProvider('service')).valueOrNull ?? [];
    final node = findShopNode(tree, _query.categoryId);
    final district = ref.watch(sessionControllerProvider).valueOrNull?.user.district;
    final effective = _query.district.isEmpty && _query.lat == null && !_query.everywhere && _query.sort == 'featured'
        ? _query.copyWith(around: district ?? '', page: _query.page)
        : _query;
    final result = ref.watch(browseResultsProvider(effective));
    final data = result.valueOrNull;
    final items = (data?['items'] as List? ?? [])
        .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final title = node?['name']?.toString() ?? 'Services';
    final categories = ref.watch(serviceCategoriesProvider).valueOrNull ?? [];
    final filterCount = _query.activeCount + (_query.categoryId == null ? 0 : 1) +
        (_query.district.isEmpty && _query.lat == null ? 0 : 1);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: 'Share this search',
            icon: const Icon(Icons.ios_share_outlined),
            onPressed: () async {
              final params = <String, dynamic>{
                if (_query.q.isNotEmpty) 'q': _query.q,
                'sort': _query.sort,
                if (_query.district.isNotEmpty) 'district': _query.district,
                if (_query.lat != null) 'near': '1',
                if (_query.everywhere) 'loc': 'all',
              };
              final path = _query.categoryId != null ? '/services/c/${_query.categoryId}' : '/services/all';
              await Clipboard.setData(
                ClipboardData(text: Uri.https('gogabla.com', path, params).toString()),
              );
              if (context.mounted) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('Search link copied')));
              }
            },
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(browseResultsProvider(effective));
          ref.invalidate(browseFacetsProvider(effective));
          await ref.read(browseResultsProvider(effective).future);
        },
        child: CustomScrollView(
          controller: _scroll,
          key: PageStorageKey('service-browse-${widget.categoryId}'),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Material(
                  color: c.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(tokens.pillRadius),
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      hintText: 'Search services or professionals',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _query.q.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _search.clear();
                                _change(_query.copyWith(q: ''));
                              },
                            ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onSubmitted: (v) => _change(_query.copyWith(q: v)),
                  ),
                ),
              ),
            ),
            if (categories.isNotEmpty)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 96,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(width: 6),
                    itemBuilder: (context, i) {
                      if (i == 0) {
                        return Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            InkWell(
                              borderRadius: BorderRadius.circular(999),
                              onTap: () => _change(_query.copyWith(clearCategory: true)),
                              child: Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: _query.categoryId == null ? c.primary : c.surfaceContainerHigh,
                                ),
                                child: Icon(
                                  Icons.apps_rounded,
                                  color: _query.categoryId == null ? c.onPrimary : c.onSurfaceVariant,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'All',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: _query.categoryId == null ? FontWeight.w700 : FontWeight.w500,
                                color: _query.categoryId == null ? c.primary : c.onSurface,
                              ),
                            ),
                          ],
                        );
                      }
                      final category = categories[i - 1];
                      return ServiceCategoryChip(
                        category: category,
                        selected: _query.categoryId == category.id,
                        onTap: () => _change(
                          _query.copyWith(clearCategory: true).copyWith(categoryId: category.id),
                        ),
                      );
                    },
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 4),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      '${data?['total'] ?? '…'} pros found',
                      style: AppTypography.of(context).display(size: 18),
                    ),
                    const SizedBox(width: 4),
                    ActionChip(
                      avatar: Icon(Icons.tune, size: 16, color: c.onSurfaceVariant),
                      label: Text('Filters${filterCount > 0 ? ' · $filterCount' : ''}'),
                      onPressed: _filters,
                    ),
                    PopupMenuButton<String>(
                      tooltip: 'Sort',
                      initialValue: _query.sort,
                      onSelected: (s) => _change(_query.copyWith(sort: s)),
                      itemBuilder: (_) => [
                        for (final entry in shopSortLabels.entries)
                          PopupMenuItem(value: entry.key, child: Text(entry.value)),
                      ],
                      child: Chip(
                        avatar: const Icon(Icons.swap_vert, size: 16),
                        label: Text(shopSortLabels[_query.sort] ?? 'Sort'),
                      ),
                    ),
                    if (district != null && _query.district.isEmpty && !_query.everywhere)
                      ActionChip(
                        avatar: const Icon(Icons.location_on_outlined, size: 16),
                        label: Text('Near $district'),
                        onPressed: () => _change(_query.copyWith(district: district)),
                      ),
                  ],
                ),
              ),
            ),
            if (_query.q.isNotEmpty ||
                _query.min != null ||
                _query.max != null ||
                _query.district.isNotEmpty ||
                _query.lat != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 4),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 4,
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
                          label: Text('UGX ${_query.min?.round() ?? 0} – ${_query.max?.round() ?? 'any'}'),
                          onDeleted: () => _change(_query.copyWith(clearPrice: true)),
                        ),
                      if (_query.district.isNotEmpty || _query.lat != null)
                        InputChip(
                          label: Text(_query.lat != null ? 'Near me' : _query.district),
                          onDeleted: () => _change(_query.copyWith(clearLocation: true, everywhere: true)),
                        ),
                    ],
                  ),
                ),
              ),
            if (_notice != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: Text(_notice!, style: TextStyle(color: c.onSurfaceVariant, fontSize: 12)),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              sliver: SliverToBoxAdapter(
                child: result.when(
                  loading: () => items.isEmpty ? const CommerceLoading() : ServicePinBoxGrid(items: items),
                  error: (e, _) => items.isEmpty
                      ? CommerceEmpty(
                          title: 'Couldn’t load services',
                          message: e.toString(),
                          action: 'Try again',
                          onAction: () => ref.invalidate(browseResultsProvider(effective)),
                        )
                      : ServicePinBoxGrid(items: items),
                  data: (_) => items.isEmpty
                      ? CommerceEmpty(
                          title: 'Nobody here yet',
                          message: 'Try a broader search, another district, or a different category.',
                          action: 'Reset filters',
                          onAction: () => _change(BrowseQuery(kind: 'service', categoryId: widget.categoryId)),
                          icon: Icons.design_services_outlined,
                        )
                      : ServicePinBoxGrid(items: items),
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
                        onPressed: _query.page > 1 ? () => _change(_query.copyWith(page: _query.page - 1)) : null,
                        child: const Text('Previous'),
                      ),
                      Text('${_query.page} / ${((data['total'] as num) / 24).ceil()}'),
                      FilledButton(
                        onPressed: _query.page * 24 < (data['total'] as num)
                            ? () => _change(_query.copyWith(page: _query.page + 1))
                            : null,
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ),
              ),
            SliverToBoxAdapter(child: SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom)),
          ],
        ),
      ),
    );
  }
}
