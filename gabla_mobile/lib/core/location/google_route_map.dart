import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import '../../features/nearby/presentation/nearby_map.dart';
import '../../features/ride/domain/ride_location.dart';
import 'google_location_service.dart';
import 'map_mode.dart';

List<gm.LatLng> decodeGooglePolyline(String encoded) {
  final points = <gm.LatLng>[];
  int index = 0, lat = 0, lng = 0;
  int next() {
    int shift = 0, value = 0, b;
    do {
      if (index >= encoded.length)
        throw const FormatException('Invalid road route');
      b = encoded.codeUnitAt(index++) - 63;
      value |= (b & 31) << shift;
      shift += 5;
      if (shift > 30) throw const FormatException('Invalid road route');
    } while (b >= 32);
    return (value & 1) != 0 ? ~(value >> 1) : value >> 1;
  }

  try {
    while (index < encoded.length) {
      lat += next();
      lng += next();
      points.add(gm.LatLng(lat / 1e5, lng / 1e5));
    }
  } on FormatException {
    return [];
  }
  return points;
}

class GoogleRouteMap extends ConsumerStatefulWidget {
  const GoogleRouteMap({
    super.key,
    required this.from,
    this.to,
    this.driver,
    this.encodedRoute,
    this.height = 240,
    this.fromLabel = 'Pickup',
  });
  final RideLocation from;
  final RideLocation? to, driver;
  final String fromLabel;
  final String? encodedRoute;
  final double height;
  @override
  ConsumerState<GoogleRouteMap> createState() => _GoogleRouteMapState();
}

class _GoogleRouteMapState extends ConsumerState<GoogleRouteMap> {
  gm.GoogleMapController? _map;
  List<gm.LatLng> _road = [];
  String? _notice;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant GoogleRouteMap old) {
    super.didUpdateWidget(old);
    if (old.from.lat != widget.from.lat ||
        old.from.lng != widget.from.lng ||
        old.to?.lat != widget.to?.lat ||
        old.to?.lng != widget.to?.lng ||
        old.encodedRoute != widget.encodedRoute) {
      _load();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _fit();
      });
    }
  }

  Future<void> _load() async {
    final revision = ++_revision;
    _road = decodeGooglePolyline(widget.encodedRoute ?? '');
    _notice = null;
    if (widget.to == null || _road.isNotEmpty) return;
    try {
      final road = await ref
          .read(googleLocationServiceProvider)
          .route(widget.from, widget.to!);
      if (mounted && revision == _revision)
        setState(() {
          _road = decodeGooglePolyline(road.polyline);
          _notice = null;
        });
    } catch (_) {
      if (mounted && revision == _revision)
        setState(
          () => _notice =
              'Road preview unavailable. Your selected locations are still saved.',
        );
    }
  }

  void _fit() {
    final c = _map;
    if (c == null || widget.to == null) return;
    final a = widget.from, b = widget.to!;
    if ((a.lat - b.lat).abs() + (a.lng - b.lng).abs() < .00001) return;
    final update = gm.CameraUpdate.newLatLngBounds(
      gm.LatLngBounds(
        southwest: gm.LatLng(
          a.lat < b.lat ? a.lat : b.lat,
          a.lng < b.lng ? a.lng : b.lng,
        ),
        northeast: gm.LatLng(
          a.lat > b.lat ? a.lat : b.lat,
          a.lng > b.lng ? a.lng : b.lng,
        ),
      ),
      42,
    );
    if (MediaQuery.disableAnimationsOf(context)) {
      c.moveCamera(update);
    } else {
      c.animateCamera(update);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (ref.watch(googleMapsConfiguredProvider).valueOrNull != true)
      return const SizedBox.shrink();
    final points = <String, RideLocation>{
      widget.fromLabel: widget.from,
      if (widget.to != null) 'Drop-off': widget.to!,
      if (widget.driver != null) 'Driver': widget.driver!,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: MapModeButton(),
          ),
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: SizedBox(
            height: widget.height,
            child: gm.GoogleMap(
              initialCameraPosition: gm.CameraPosition(
                target: gm.LatLng(widget.from.lat, widget.from.lng),
                zoom: 15,
              ),
              mapType: ref.watch(mapModeProvider),
              mapToolbarEnabled: false,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              onMapCreated: (c) {
                _map = c;
                _fit();
              },
              markers: {
                for (final entry in points.entries)
                  gm.Marker(
                    markerId: gm.MarkerId(entry.key),
                    position: gm.LatLng(entry.value.lat, entry.value.lng),
                    infoWindow: gm.InfoWindow(
                      title: entry.key,
                      snippet: entry.value.address,
                    ),
                    icon: gm.BitmapDescriptor.defaultMarkerWithHue(
                      entry.key == 'Driver'
                          ? gm.BitmapDescriptor.hueAzure
                          : entry.key == 'Drop-off'
                          ? gm.BitmapDescriptor.hueOrange
                          : gm.BitmapDescriptor.hueGreen,
                    ),
                  ),
              },
              polylines: _road.isEmpty
                  ? {}
                  : {
                      gm.Polyline(
                        polylineId: const gm.PolylineId('road-route'),
                        points: _road,
                        color: Theme.of(context).colorScheme.primary,
                        width: 5,
                      ),
                    },
            ),
          ),
        ),
        if (_notice != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_notice!, style: const TextStyle(fontSize: 11)),
          ),
      ],
    );
  }
}
