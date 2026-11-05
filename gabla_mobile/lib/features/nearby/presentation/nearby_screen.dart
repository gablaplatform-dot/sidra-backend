import '../../../core/location/map_mode.dart';
import '../../../core/location/google_place_picker.dart';
import 'nearby_search_chrome.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/widgets/feature_visual.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../../core/network/api_exception.dart';
import '../../settings/application/theme_controller.dart';
import '../application/nearby_controller.dart';
import '../domain/nearby_result.dart';
import 'nearby_map.dart';

class NearbyScreen extends ConsumerStatefulWidget {
  const NearbyScreen({super.key});
  @override
  ConsumerState<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends ConsumerState<NearbyScreen> {
  final _query = TextEditingController();
  final _queryFocus = FocusNode();
  final _deck = PageController(viewportFraction: .91);
  final _listScroll = ScrollController();
  final _sheetController = DraggableScrollableController();
  ScrollController? _activeResultsScroll;
  double _resultsHeaderExtent = 0;
  bool _listOnly = false, _mapExpanded = false, _areaMoved = false;
  LatLng? _camera;
  double _zoom = 13;
  int _focusRevision = 0;
  double _sheetExtent = .28;
  bool _syncingDeck = false;
  @override
  void dispose() {
    _query.dispose();
    _queryFocus.dispose();
    _deck.dispose();
    _listScroll.dispose();
    _sheetController.dispose();
    super.dispose();
  }

  void _pick(NearbyItem item) {
    setState(() => _focusRevision++);
    ref.read(nearbyControllerProvider.notifier).select(item.id);
    final index = ref
        .read(nearbyControllerProvider)
        .items
        .indexWhere((i) => i.id == item.id);
    if (_deck.hasClients && index >= 0) {
      _syncingDeck = true;
      if (MediaQuery.disableAnimationsOf(context)) {
        _deck.jumpToPage(index);
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => _syncingDeck = false,
        );
      } else {
        _deck
            .animateToPage(
              index,
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeOutCubic,
            )
            .whenComplete(() => _syncingDeck = false);
      }
    }
    if (!_deck.hasClients) {
      if (_sheetController.isAttached && !_listOnly) {
        if (MediaQuery.disableAnimationsOf(context)) {
          _sheetController.jumpTo(.55);
        } else {
          _sheetController.animateTo(
            .55,
            duration: const Duration(milliseconds: 350),
            curve: Curves.easeOutCubic,
          );
        }
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final scroll = _activeResultsScroll;
        if (!mounted || scroll == null || !scroll.hasClients || index < 0) {
          return;
        }
        final scale = MediaQuery.textScalerOf(context).scale(1);
        final target = (_resultsHeaderExtent + index * 180 * scale)
            .clamp(0.0, scroll.positions.last.maxScrollExtent)
            .toDouble();
        if (MediaQuery.disableAnimationsOf(context)) {
          scroll.jumpTo(target);
        } else {
          scroll.animateTo(
            target,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutCubic,
          );
        }
      });
    }
  }

  void _open(NearbyItem item) {
    final route = item.type == 'service'
        ? item.product.bookable
              ? '/services/booking/${item.id}'
              : item.product.providerId != null
              ? '/provider/${item.product.providerId}'
              : '/shop/product/${item.id}'
        : '/shop/product/${item.id}';
    context.push(route);
  }

  Future<void> _chooseArea() async {
    final place = await pickGoogleLocation(
      context,
      title: 'Where would you like to look?',
    );
    if (place == null || !mounted) return;
    setState(() => _areaMoved = false);
    await ref.read(nearbyControllerProvider.notifier).usePlace(place);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(nearbyControllerProvider);
    final style = ref.watch(themeControllerProvider).style;
    final c = Theme.of(context).colorScheme;
    final selected = state.items
        .where((i) => i.id == state.selectedId)
        .firstOrNull;
    final focus =
        selected?.pin ?? state.result.valueOrNull?.centre ?? state.origin.point;
    final dark = style == AppThemeStyle.cinematic;
    final tools = NearbySearchChrome(
      style: style,
      state: state,
      controller: _query,
      focus: _queryFocus,
      listOnly: _listOnly,
      onBack: () => context.canPop() ? context.pop() : context.go('/home'),
      onQuery: ref.read(nearbyControllerProvider.notifier).setQuery,
      onSubmit: ref.read(nearbyControllerProvider.notifier).search,
      onClear: () {
        _query.clear();
        ref.read(nearbyControllerProvider.notifier).setQuery('');
      },
      onType: ref.read(nearbyControllerProvider.notifier).setType,
      onArea: _chooseArea,
      onLocate: () {
        setState(() => _areaMoved = false);
        ref.read(nearbyControllerProvider.notifier).useMyLocation();
      },
      onToggleView: () => setState(() => _listOnly = !_listOnly),
    );
    final map = NearbyMap(
      style: style,
      items: state.items,
      initialCentre:
          _camera ??
          state.result.valueOrNull?.centre ??
          state.origin.point ??
          NearbyOrigin.kampala.point!,
      initialZoom: _zoom,
      focus: focus,
      focusRevision: _focusRevision,
      you: state.origin.isGps ? state.origin.point : null,
      selectedId: state.selectedId,
      onSelect: (id) => _pick(state.items.firstWhere((i) => i.id == id)),
      onCameraChanged: (point, zoom, gesture) {
        _camera = point;
        _zoom = zoom;
        if (gesture && !_areaMoved) setState(() => _areaMoved = true);
      },
    );
    final mapWithControls = Stack(
      children: [
        Positioned.fill(child: map),
        const Positioned(top: 12, right: 12, child: MapModeButton()),
        if (_areaMoved)
          Positioned(
            top: 38,
            left: 16,
            right: 76,
            child: Center(
              child: FilledButton.tonalIcon(
                icon: const Icon(Icons.search, size: 16),
                label: const Text('Search this area'),
                onPressed: () {
                  if (_camera != null) {
                    setState(() => _areaMoved = false);
                    ref
                        .read(nearbyControllerProvider.notifier)
                        .searchArea(_camera!);
                  }
                },
              ),
            ),
          ),
      ],
    );
    final duration = Duration(
      milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 420,
    );
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: Column(
          children: [
            tools,
            Expanded(
              child: LayoutBuilder(
                builder: (context, bounds) => AnimatedSwitcher(
                  duration: duration,
                  child: _listOnly
                      ? KeyedSubtree(
                          key: const ValueKey('list'),
                          child: _results(state, style),
                        )
                      : KeyedSubtree(
                          key: ValueKey(style),
                          child: switch (style) {
                            AppThemeStyle.gabla => Stack(
                              children: [
                                Positioned.fill(
                                  child: NearbyMapInsets(
                                    padding: EdgeInsets.only(
                                      bottom: bounds.maxHeight * _sheetExtent,
                                    ),
                                    child: mapWithControls,
                                  ),
                                ),
                                NotificationListener<
                                  DraggableScrollableNotification
                                >(
                                  onNotification: (notification) {
                                    final extent = notification.extent;
                                    WidgetsBinding.instance
                                        .addPostFrameCallback((_) {
                                          if (mounted &&
                                              (_sheetExtent - extent).abs() >
                                                  .003)
                                            setState(
                                              () => _sheetExtent = extent,
                                            );
                                        });
                                    return false;
                                  },
                                  child: DraggableScrollableSheet(
                                    controller: _sheetController,
                                    initialChildSize: .28,
                                    minChildSize: .16,
                                    maxChildSize: .8,
                                    snap: true,
                                    snapSizes: const [.28, .55, .8],
                                    builder: (context, scroll) =>
                                        _sheet(state, style, scroll),
                                  ),
                                ),
                              ],
                            ),
                            AppThemeStyle.editorial => Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                  ),
                                  child: AnimatedContainer(
                                    duration: duration,
                                    height: _mapExpanded
                                        ? bounds.maxHeight * .65
                                        : (bounds.maxHeight * .4)
                                              .clamp(80, 145)
                                              .toDouble(),
                                    child: Stack(
                                      children: [
                                        Positioned.fill(
                                          child: ClipRRect(
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            child: mapWithControls,
                                          ),
                                        ),
                                        Positioned(
                                          bottom: 24,
                                          right: 10,
                                          child: IconButton.filled(
                                            tooltip: _mapExpanded
                                                ? 'Shrink map'
                                                : 'Expand map',
                                            onPressed: () => setState(
                                              () =>
                                                  _mapExpanded = !_mapExpanded,
                                            ),
                                            icon: Icon(
                                              _mapExpanded
                                                  ? Icons.fullscreen_exit
                                                  : Icons.fullscreen,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Expanded(child: _results(state, style)),
                              ],
                            ),
                            AppThemeStyle.discover => Stack(
                              children: [
                                Positioned.fill(
                                  bottom: (bounds.maxHeight * .42)
                                      .clamp(80, 210)
                                      .toDouble(),
                                  child: mapWithControls,
                                ),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: (bounds.maxHeight * .42)
                                      .clamp(80, 214)
                                      .toDouble(),
                                  child: _rail(state, style),
                                ),
                              ],
                            ),
                            AppThemeStyle.cinematic => Stack(
                              children: [
                                Positioned.fill(
                                  bottom: (bounds.maxHeight * .46)
                                      .clamp(
                                        80,
                                        state.items.isEmpty ? 150 : 245,
                                      )
                                      .toDouble(),
                                  child: mapWithControls,
                                ),
                                Positioned(
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  height: (bounds.maxHeight * .46)
                                      .clamp(
                                        80,
                                        state.items.isEmpty ? 160 : 245,
                                      )
                                      .toDouble(),
                                  child: _rail(state, style, cinematic: dark),
                                ),
                              ],
                            ),
                            AppThemeStyle.orbit => Column(
                              children: [
                                AnimatedContainer(
                                  duration: duration,
                                  height:
                                      bounds.maxHeight *
                                      (_mapExpanded ? .82 : .55),
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      16,
                                      0,
                                      16,
                                      8,
                                    ),
                                    child: AnimatedContainer(
                                      duration: duration,
                                      clipBehavior: Clip.antiAlias,
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                          color: c.primary.withValues(
                                            alpha: .25,
                                          ),
                                          width: 3,
                                        ),
                                        borderRadius: BorderRadius.circular(
                                          _mapExpanded ? 24 : 200,
                                        ),
                                      ),
                                      child: Stack(
                                        children: [
                                          Positioned.fill(
                                            child: mapWithControls,
                                          ),
                                          Positioned(
                                            bottom: 30,
                                            right: 22,
                                            child: IconButton.filled(
                                              tooltip: _mapExpanded
                                                  ? 'Circular view'
                                                  : 'Expand map',
                                              onPressed: () => setState(
                                                () => _mapExpanded =
                                                    !_mapExpanded,
                                              ),
                                              icon: Icon(
                                                _mapExpanded
                                                    ? Icons.circle_outlined
                                                    : Icons.open_in_full,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                Expanded(child: _results(state, style)),
                              ],
                            ),
                          },
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summary(NearbyState state) {
    final response = state.result.valueOrNull;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            state.query.trim().length < 2
                ? 'Search products & services'
                : state.result.isLoading
                ? 'Searching nearby…'
                : state.result.hasError
                ? 'Search unavailable'
                : response == null
                ? 'Search nearby'
                : '${response.total} matches for “${state.query.trim()}”',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            state.query.trim().length < 2
                ? 'Choose an area above, then enter a search.'
                : state.result.isLoading || state.result.hasError
                ? state.origin.label
                : response?.widened == true
                ? 'Search widened beyond 15 km · pins are approximate'
                : 'Nearest matches first · pins are approximate',
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty(NearbyState state) =>
      Center(child: SingleChildScrollView(child: _emptyContent(state)));

  Widget _emptyContent(NearbyState state) {
    if (state.result.isLoading) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text(
              'Searching products and services…',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    if (state.result.hasError) {
      final error = state.result.error;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off_outlined, size: 32),
              const SizedBox(height: 12),
              Text(
                error is ApiException
                    ? error.message
                    : 'Search could not load. Try again.',
                textAlign: TextAlign.center,
              ),
              TextButton(
                onPressed: ref.read(nearbyControllerProvider.notifier).search,
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.travel_explore, size: 34),
            const SizedBox(height: 12),
            Text(
              state.query.trim().length < 2
                  ? 'Enter at least 2 letters to search products and services.'
                  : 'No matches in this area. Try another search or location.',
              textAlign: TextAlign.center,
            ),
            if (state.query.trim().length < 2)
              Wrap(
                spacing: 8,
                children: [
                  for (final word in ['Food', 'Phones', 'Salon'])
                    ActionChip(
                      label: Text(word),
                      onPressed: () {
                        _query.text = word;
                        ref
                            .read(nearbyControllerProvider.notifier)
                            .setQuery(word);
                      },
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _results(
    NearbyState state,
    AppThemeStyle style, {
    ScrollController? scroll,
  }) {
    final controller = scroll ?? _listScroll;
    _activeResultsScroll = controller;
    if (state.items.isEmpty) {
      return ListView(
        controller: controller,
        children: [
          _summary(state),
          SizedBox(height: 235, child: _empty(state)),
        ],
      );
    }
    final scale = MediaQuery.textScalerOf(context).scale(1);
    return CustomScrollView(
      controller: controller,
      slivers: [
        SliverToBoxAdapter(child: _summary(state)),
        SliverLayoutBuilder(
          builder: (context, constraints) {
            // Measure the naturally wrapped summary rather than assuming a
            // fixed height; pin selection must still scroll to the right item.
            _resultsHeaderExtent = constraints.precedingScrollExtent;
            return SliverFixedExtentList(
              itemExtent: 180 * scale,
              delegate: SliverChildBuilderDelegate(
                (context, index) => Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  child: _ResultCard(
                    item: state.items[index],
                    selected: state.selectedId == state.items[index].id,
                    editorial: style == AppThemeStyle.editorial,
                    onPick: () => _pick(state.items[index]),
                    onOpen: () => _open(state.items[index]),
                  ),
                ),
                childCount: state.items.length,
              ),
            );
          },
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 22)),
      ],
    );
  }

  Widget _sheet(
    NearbyState state,
    AppThemeStyle style,
    ScrollController scroll,
  ) => Material(
    elevation: 8,
    color: Theme.of(context).colorScheme.surface,
    borderRadius: BorderRadius.vertical(
      top: Radius.circular(
        Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8,
      ),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        Center(
          child: Container(
            width: 38,
            height: 4,
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outlineVariant,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        Expanded(child: _results(state, style, scroll: scroll)),
      ],
    ),
  );
  Widget _rail(
    NearbyState state,
    AppThemeStyle style, {
    bool cinematic = false,
  }) {
    if (state.items.isEmpty) {
      return Material(
        color: Theme.of(context).colorScheme.surface,
        child: _empty(state),
      );
    }
    return LayoutBuilder(
      builder: (context, bounds) {
        if (bounds.maxHeight < 180 ||
            MediaQuery.textScalerOf(context).scale(1) > 1.2)
          return _results(state, style);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
              child: Text(
                '${state.items.length} matches · swipe to explore',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _deck,
                itemCount: state.items.length,
                onPageChanged: (index) {
                  if (!_syncingDeck) {
                    setState(() => _focusRevision++);
                    ref
                        .read(nearbyControllerProvider.notifier)
                        .select(state.items[index].id);
                  }
                },
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.fromLTRB(0, 0, 12, 12),
                  child: _ResultCard(
                    item: state.items[index],
                    selected: state.selectedId == state.items[index].id,
                    photo: cinematic,
                    onPick: () => _pick(state.items[index]),
                    onOpen: () => _open(state.items[index]),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.item,
    required this.selected,
    required this.onPick,
    required this.onOpen,
    this.photo = false,
    this.editorial = false,
  });
  final NearbyItem item;
  final bool selected, photo, editorial;
  final VoidCallback onPick, onOpen;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final radius = Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8;
    final p = item.product;
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${item.type == 'service' ? 'Service' : 'Product'}${item.related ? ' · Related' : ''}${p.distanceKm == null ? '' : ' · ${p.distanceKm! < 1 ? '<1' : p.distanceKm!.toStringAsFixed(1)} km'}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11,
            height: 1.15,
            fontWeight: FontWeight.w700,
            letterSpacing: .1,
            color: photo ? Colors.white70 : c.primary,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          p.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: editorial ? 21 : 17,
            height: 1.1,
            fontFamily: AppTypography.of(context).heading,
            fontWeight: FontWeight.w700,
            color: photo ? Colors.white : c.onSurface,
          ),
        ),
        const SizedBox(height: 5),
        if (p.providerName != null)
          Text(
            p.providerName!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              height: 1.15,
              color: photo ? Colors.white70 : c.onSurfaceVariant,
            ),
          ),
        const SizedBox(height: 6),
        Text(
          p.price > 0 ? formatUgx(p.price) : 'Contact for price',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 12,
            height: 1.15,
            color: photo ? Colors.white : c.onSurface,
          ),
        ),
      ],
    );
    final placeholder = FeatureVisual(kind: item.type);
    final image = p.imageUrl == null || p.imageUrl!.isEmpty
        ? placeholder
        : Image.network(
            p.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => placeholder,
          );

    return Semantics(
      selected: selected,
      child: Material(
        color: c.surfaceContainerLow,
        borderRadius: BorderRadius.circular(radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPick,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: selected ? c.primary : c.outlineVariant,
                width: selected ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(radius),
            ),
            child: photo
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      image,
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.black12, Colors.black87],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 18,
                        bottom: 18,
                        right: 62,
                        child: details,
                      ),
                      Positioned(
                        right: 12,
                        bottom: 12,
                        child: IconButton.filled(
                          tooltip: 'View details',
                          onPressed: onOpen,
                          icon: const Icon(Icons.north_east),
                        ),
                      ),
                    ],
                  )
                : Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(radius),
                          child: SizedBox(width: 68, height: 88, child: image),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: details),
                        IconButton(
                          tooltip: 'View details',
                          onPressed: onOpen,
                          icon: const Icon(Icons.north_east, size: 19),
                        ),
                      ],
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
