import '../../../core/location/map_mode.dart';
import '../../../core/location/google_place_picker.dart';
import 'nearby_search_chrome.dart';
import 'nearby_events_rail.dart';
import '../../../core/theme/font_group.dart';
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
  final _listScroll = ScrollController();
  final _sheetController = DraggableScrollableController();
  ScrollController? _activeResultsScroll;
  bool _listOnly = false, _areaMoved = false;
  bool _searchHidden = false, _sheetHidden = false, _events = false;
  LatLng? _camera;
  double _zoom = 13, _sheetExtent = .34;
  int _focusRevision = 0;

  @override
  void dispose() {
    _query.dispose();
    _queryFocus.dispose();
    _listScroll.dispose();
    _sheetController.dispose();
    super.dispose();
  }

  void _setSheetExtent(double extent) {
    if (!_sheetController.isAttached) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _sheetController.jumpTo(extent);
    } else {
      _sheetController.animateTo(
        extent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _pick(NearbyItem item) {
    setState(() {
      _focusRevision++;
      _events = false;
      _sheetHidden = false;
    });
    ref.read(nearbyControllerProvider.notifier).select(item.id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_listOnly) _setSheetExtent(.65);
      final scroll = _activeResultsScroll;
      final index = ref
          .read(nearbyControllerProvider)
          .items
          .indexWhere((i) => i.id == item.id);
      if (scroll == null || !scroll.hasClients || index < 0) return;
      final scale = MediaQuery.textScalerOf(context).scale(1);
      final target = (100 * scale + index * 180 * scale)
          .clamp(0.0, scroll.position.maxScrollExtent)
          .toDouble();
      if (MediaQuery.disableAnimationsOf(context)) {
        scroll.jumpTo(target);
      } else {
        scroll.animateTo(
          target,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
      }
    });
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
    final safe = MediaQuery.paddingOf(context);
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final selected = state.items
        .where((i) => i.id == state.selectedId)
        .firstOrNull;
    final focus =
        selected?.pin ?? state.result.valueOrNull?.centre ?? state.origin.point;
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
      onArea: _chooseArea,
      onRadius: ref.read(nearbyControllerProvider.notifier).setRadius,
      onLocate: () {
        setState(() => _areaMoved = false);
        ref.read(nearbyControllerProvider.notifier).useMyLocation();
      },
      onHide: () {
        _queryFocus.unfocus();
        setState(() => _searchHidden = true);
      },
      onToggleView: () {
        _queryFocus.unfocus();
        setState(() {
          _listOnly = !_listOnly;
          _sheetHidden = false;
        });
      },
    );
    if (_listOnly) {
      return Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(padding: const EdgeInsets.all(8), child: tools),
              Expanded(child: _sheet(state, style, _listScroll)),
            ],
          ),
        ),
      );
    }
    final controlsTop = safe.top + (_searchHidden ? 62 : 150);
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: LayoutBuilder(
        builder: (context, bounds) => Stack(
          children: [
            Positioned.fill(
              child: NearbyMapInsets(
                padding: EdgeInsets.only(
                  top: controlsTop,
                  bottom: _sheetHidden
                      ? safe.bottom + 64
                      : bounds.maxHeight * _sheetExtent,
                ),
                child: NearbyMap(
                  style: style,
                  items: state.items,
                  initialCentre:
                      _camera ??
                      state.origin.point ??
                      NearbyOrigin.kampala.point!,
                  initialZoom: _zoom,
                  focus: focus,
                  focusRevision: _focusRevision,
                  you: state.origin.isGps ? state.origin.point : null,
                  selectedId: state.selectedId,
                  onSelect: (id) =>
                      _pick(state.items.firstWhere((i) => i.id == id)),
                  onCameraChanged: (point, zoom, gesture) {
                    _camera = point;
                    _zoom = zoom;
                    if (gesture && !_areaMoved)
                      setState(() => _areaMoved = true);
                  },
                ),
              ),
            ),
            Positioned(
              top: safe.top + 8,
              left: 12,
              right: 12,
              child: _searchHidden
                  ? Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FilledButton.tonalIcon(
                        onPressed: () => setState(() => _searchHidden = false),
                        icon: const Icon(Icons.search),
                        label: const Text('Show search'),
                      ),
                    )
                  : tools,
            ),
            Positioned(
              top: controlsTop + 118,
              right: 12,
              child: const MapModeButton(),
            ),
            if (_areaMoved)
              Positioned(
                top: controlsTop + 8,
                left: 12,
                right: 72,
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: FilledButton.tonalIcon(
                    icon: const Icon(Icons.search, size: 16),
                    label: const Text('Search this area'),
                    onPressed: () {
                      final camera = _camera;
                      if (camera == null) return;
                      setState(() => _areaMoved = false);
                      ref
                          .read(nearbyControllerProvider.notifier)
                          .searchArea(camera);
                    },
                  ),
                ),
              ),
            if (!_sheetHidden && keyboard == 0)
              NotificationListener<DraggableScrollableNotification>(
                onNotification: (notification) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted &&
                        (_sheetExtent - notification.extent).abs() > .003) {
                      setState(() => _sheetExtent = notification.extent);
                    }
                  });
                  return false;
                },
                child: DraggableScrollableSheet(
                  controller: _sheetController,
                  initialChildSize: .34,
                  minChildSize: .16,
                  maxChildSize: .86,
                  snap: true,
                  snapSizes: const [.16, .34, .65, .86],
                  builder: (context, scroll) => _sheet(state, style, scroll),
                ),
              ),
            if (_sheetHidden || keyboard > 0)
              Positioned(
                bottom: safe.bottom + keyboard + 16,
                left: 20,
                right: 20,
                child: Center(
                  child: FilledButton.icon(
                    onPressed: () {
                      _queryFocus.unfocus();
                      setState(() => _sheetHidden = false);
                    },
                    icon: const Icon(Icons.keyboard_arrow_up),
                    label: Text(
                      _events ? 'Show nearby events' : 'Show results',
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
                ? 'What would you like to find?'
                : response == null
                ? 'Finding your next stop…'
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
            response?.widened == true
                ? 'Search widened beyond ${state.origin.radiusKm.round()} km · pins are approximate'
                : 'Nearest matches first · pins are approximate',
            style: TextStyle(
              fontSize: 10,
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
      return const Center(child: CircularProgressIndicator());
    }
    if (state.result.hasError) {
      final error = state.result.error;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                error is ApiException
                    ? error.message
                    : 'Search could not load. Try again.',
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
                  ? 'Search for at least two letters to explore products and services.'
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
        SliverToBoxAdapter(
          child: SizedBox(height: 100 * scale, child: _summary(state)),
        ),
        SliverFixedExtentList(
          itemExtent: 180 * scale,
          delegate: SliverChildBuilderDelegate(
            (context, index) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: _ResultCard(
                item: state.items[index],
                selected: state.selectedId == state.items[index].id,
                editorial: style == AppThemeStyle.editorial,
                photo: style == AppThemeStyle.cinematic,
                onPick: () => _pick(state.items[index]),
                onOpen: () => _open(state.items[index]),
              ),
            ),
            childCount: state.items.length,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 22)),
      ],
    );
  }

  Widget _sheet(
    NearbyState state,
    AppThemeStyle style,
    ScrollController scroll,
  ) {
    final c = Theme.of(context).colorScheme;
    final radius = switch (style) {
      AppThemeStyle.editorial => 4.0,
      AppThemeStyle.orbit => 10.0,
      AppThemeStyle.cinematic => 12.0,
      AppThemeStyle.gabla => 20.0,
      AppThemeStyle.discover => 24.0,
    };
    return Material(
      elevation: 12,
      color: c.surface,
      borderRadius: BorderRadius.vertical(top: Radius.circular(radius)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onVerticalDragUpdate: _listOnly
                ? null
                : (details) {
                    if (!_sheetController.isAttached) return;
                    final extent =
                        _sheetController.size -
                        details.delta.dy / MediaQuery.sizeOf(context).height;
                    _sheetController.jumpTo(extent.clamp(.16, .86));
                  },
            child: Column(
              children: [
                if (!_listOnly)
                  Semantics(
                    button: true,
                    label: 'Expand or collapse results',
                    child: InkWell(
                      onTap: () =>
                          _setSheetExtent(_sheetExtent < .5 ? .65 : .16),
                      child: SizedBox(
                        height: 22,
                        width: double.infinity,
                        child: Center(
                          child: Container(
                            width: 36,
                            height: 4,
                            decoration: BoxDecoration(
                              color: c.outlineVariant,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 4, 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: SegmentedButton<bool>(
                          showSelectedIcon: false,
                          segments: const [
                            ButtonSegment(value: false, label: Text('Results')),
                            ButtonSegment(value: true, label: Text('Events')),
                          ],
                          selected: {_events},
                          onSelectionChanged: (selection) => setState(() {
                            _events = selection.single;
                            _activeResultsScroll = null;
                          }),
                        ),
                      ),
                      if (!_listOnly)
                        IconButton(
                          tooltip: 'Hide results',
                          onPressed: () => setState(() => _sheetHidden = true),
                          icon: const Icon(Icons.keyboard_arrow_down),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _events
                ? ListView(
                    controller: scroll,
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      NearbyEventsRail(origin: state.origin, style: style),
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          18,
                          8,
                          18,
                          MediaQuery.paddingOf(context).bottom + 18,
                        ),
                        child: Text(
                          'Within ${state.origin.radiusKm.round()} km · next 30 days',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  )
                : _results(state, style, scroll: scroll),
          ),
        ],
      ),
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
    final p = item.product;
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${item.type == 'service' ? 'SERVICE' : 'PRODUCT'}${item.related ? ' · RELATED' : ''}${p.distanceKm == null ? '' : ' · ${p.distanceKm! < 1 ? '<1' : p.distanceKm!.toStringAsFixed(1)} km'}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 9,
            height: 1.15,
            fontWeight: FontWeight.w700,
            letterSpacing: .6,
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
    final placeholder = ColoredBox(
      color: c.secondaryContainer,
      child: Icon(
        item.type == 'service'
            ? Icons.handyman_outlined
            : Icons.shopping_bag_outlined,
        color: c.onSecondaryContainer,
        size: 34,
      ),
    );
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
        borderRadius: BorderRadius.circular(editorial ? 8 : 24),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPick,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: selected ? c.primary : c.outlineVariant,
                width: selected ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(editorial ? 8 : 24),
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
                          borderRadius: BorderRadius.circular(14),
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
