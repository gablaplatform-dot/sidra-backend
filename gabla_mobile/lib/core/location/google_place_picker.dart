import 'map_mode.dart';
import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import '../../features/nearby/presentation/nearby_map.dart';
import '../../features/ride/application/ride_providers.dart';
import '../../features/ride/domain/ride_location.dart';
import 'google_location_service.dart';

Future<RideLocation?> pickGoogleLocation(
  BuildContext context, {
  required String title,
  RideLocation? initial,
}) => showModalBottomSheet<RideLocation>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  builder: (_) => GooglePlacePicker(title: title, initial: initial),
);

class GooglePlacePicker extends ConsumerStatefulWidget {
  const GooglePlacePicker({super.key, required this.title, this.initial});
  final String title;
  final RideLocation? initial;
  @override
  ConsumerState<GooglePlacePicker> createState() => _GooglePlacePickerState();
}

class _GooglePlacePickerState extends ConsumerState<GooglePlacePicker> {
  final _query = TextEditingController();
  final _session =
      '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(99999999)}';
  gm.GoogleMapController? _map;
  Timer? _debounce;
  RideLocation? _selected;
  List<PlaceSuggestion> _suggestions = [];
  String? _error;
  bool _busy = false;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    _selected = widget.initial;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _search(String value) {
    _debounce?.cancel();
    final revision = ++_revision;
    if (value.trim().length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final results = await ref
            .read(googleLocationServiceProvider)
            .suggestions(value.trim(), _session);
        if (mounted && revision == _revision)
          setState(() {
            _suggestions = results;
            _error = null;
          });
      } catch (_) {
        if (mounted && revision == _revision)
          setState(
            () => _error =
                'Suggestions unavailable. Search the full address or choose on the map.',
          );
      }
    });
  }

  Future<void> _resolve(Future<RideLocation> Function() lookup) async {
    final revision = ++_revision;
    _debounce?.cancel();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final place = await lookup();
      if (!mounted || revision != _revision) return;
      setState(() {
        _selected = place;
        _suggestions = [];
      });
      _query.text = place.address;
      FocusScope.of(context).unfocus();
      final update = gm.CameraUpdate.newLatLngZoom(
        gm.LatLng(place.lat, place.lng),
        16,
      );
      if (MediaQuery.disableAnimationsOf(context)) {
        await _map?.moveCamera(update);
      } else {
        await _map?.animateCamera(
          update,
          duration: const Duration(milliseconds: 500),
        );
      }
    } catch (_) {
      if (mounted && revision == _revision)
        setState(
          () => _error =
              'Could not locate that place. Try another address or select a map pin.',
        );
    } finally {
      if (mounted && revision == _revision) setState(() => _busy = false);
    }
  }

  Future<void> _pin(gm.LatLng p) async {
    setState(
      () => _selected = RideLocation(
        lat: p.latitude,
        lng: p.longitude,
        address: 'Selected map location',
      ),
    );
    await _resolve(
      () => ref
          .read(deviceLocationServiceProvider)
          .locationAt(p.latitude, p.longitude),
    );
  }

  @override
  Widget build(BuildContext context) {
    final configured =
        ref.watch(googleMapsConfiguredProvider).valueOrNull == true;
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .9,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 10, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close location picker',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  TextField(
                    controller: _query,
                    decoration: InputDecoration(
                      labelText: 'Search a place or address',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        tooltip: 'Locate address',
                        onPressed: _busy
                            ? null
                            : () => _resolve(
                                () => ref
                                    .read(deviceLocationServiceProvider)
                                    .geocodeAddress(_query.text.trim()),
                              ),
                        icon: const Icon(Icons.arrow_forward),
                      ),
                    ),
                    onChanged: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (q) => _resolve(
                      () => ref
                          .read(deviceLocationServiceProvider)
                          .geocodeAddress(q.trim()),
                    ),
                  ),
                  for (final suggestion in _suggestions.take(5))
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.place_outlined),
                      title: Text(suggestion.label, maxLines: 2),
                      onTap: _busy
                          ? null
                          : () => _resolve(
                              () => ref
                                  .read(googleLocationServiceProvider)
                                  .place(suggestion.id, _session),
                            ),
                    ),
                  TextButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _resolve(
                            () => ref
                                .read(deviceLocationServiceProvider)
                                .currentLocation(),
                          ),
                    icon: const Icon(Icons.my_location),
                    label: const Text('Use my current location'),
                  ),
                  if (_busy) const LinearProgressIndicator(),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  if (configured)
                    const Align(
                      alignment: Alignment.centerRight,
                      child: MapModeButton(),
                    ),
                  if (configured)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: SizedBox(
                        height: 260,
                        child: gm.GoogleMap(
                          initialCameraPosition: gm.CameraPosition(
                            target: gm.LatLng(
                              _selected?.lat ?? .3476,
                              _selected?.lng ?? 32.5825,
                            ),
                            zoom: _selected == null ? 12 : 16,
                          ),
                          mapType: ref.watch(mapModeProvider),
                          onMapCreated: (c) => _map = c,
                          onTap: _pin,
                          mapToolbarEnabled: false,
                          myLocationEnabled: false,
                          myLocationButtonEnabled: false,
                          gestureRecognizers: {
                            Factory<OneSequenceGestureRecognizer>(
                              () => EagerGestureRecognizer(),
                            ),
                          },
                          markers: _selected == null
                              ? {}
                              : {
                                  gm.Marker(
                                    markerId: const gm.MarkerId(
                                      'selected-location',
                                    ),
                                    position: gm.LatLng(
                                      _selected!.lat,
                                      _selected!.lng,
                                    ),
                                  ),
                                },
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  if (_selected != null)
                    Text(
                      _selected!.address,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Search with Google or tap the satellite map to choose an exact point.',
                      style: TextStyle(fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _selected == null || _busy
                        ? null
                        : () => Navigator.pop(context, _selected),
                    child: const Text('Use this location'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
