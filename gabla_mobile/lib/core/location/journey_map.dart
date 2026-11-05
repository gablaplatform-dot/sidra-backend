import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import '../../features/nearby/presentation/nearby_map.dart';
import '../../features/ride/domain/ride_location.dart';
import 'google_location_service.dart';
import 'google_route_map.dart';
import 'map_mode.dart';

/// Injectable only at the platform-view boundary; production always uses Google.
final journeyNativeMapProvider = Provider<Widget Function(gm.GoogleMap)>(
  (ref) =>
      (map) => map,
);

class JourneyMap extends ConsumerStatefulWidget {
  const JourneyMap({
    super.key,
    this.pickup,
    this.dropoff,
    this.driver,
    this.polyline,
    this.bottomPadding = 300,
    this.onTap,
  });
  final RideLocation? pickup, dropoff, driver;
  final String? polyline;
  final double bottomPadding;
  final ValueChanged<gm.LatLng>? onTap;
  @override
  ConsumerState<JourneyMap> createState() => _JourneyMapState();
}

class _JourneyMapState extends ConsumerState<JourneyMap> {
  gm.GoogleMapController? _controller;
  List<gm.LatLng> _route = [];
  int _revision = 0;
  String? _notice;
  @override
  void initState() {
    super.initState();
    _route = decodeGooglePolyline(widget.polyline ?? '');
    Future.microtask(_loadRoute);
  }

  @override
  void didUpdateWidget(covariant JourneyMap old) {
    super.didUpdateWidget(old);
    if (old.pickup != widget.pickup ||
        old.dropoff != widget.dropoff ||
        old.polyline != widget.polyline) {
      _loadRoute();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _fit();
      });
    }
  }

  Future<void> _loadRoute() async {
    final revision = ++_revision;
    final start = widget.pickup, end = widget.dropoff;
    final given = decodeGooglePolyline(widget.polyline ?? '');
    if (mounted)
      setState(() {
        _route = given;
        _notice = null;
      });
    if (start == null || end == null || given.isNotEmpty) return;
    try {
      final route = await ref
          .read(googleLocationServiceProvider)
          .route(start, end);
      if (mounted && revision == _revision)
        setState(() => _route = decodeGooglePolyline(route.polyline));
    } catch (_) {
      if (mounted && revision == _revision)
        setState(
          () => _notice = 'Road preview unavailable. Your locations are saved.',
        );
    }
  }

  void _fit() {
    final c = _controller, a = widget.pickup, b = widget.dropoff;
    if (c == null) return;
    gm.CameraUpdate? update;
    if (a != null &&
        b != null &&
        (a.lat - b.lat).abs() + (a.lng - b.lng).abs() > .00001) {
      update = gm.CameraUpdate.newLatLngBounds(
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
        50,
      );
    } else if (a != null) {
      update = gm.CameraUpdate.newLatLngZoom(gm.LatLng(a.lat, a.lng), 15);
    }
    if (update != null) {
      final future = MediaQuery.disableAnimationsOf(context)
          ? c.moveCamera(update)
          : c.animateCamera(update);
      unawaited(future.catchError((_) {}));
    }
  }

  @override
  void dispose() {
    _revision++;
    _controller = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final configured = ref.watch(googleMapsConfiguredProvider);
    if (configured.isLoading)
      return const ColoredBox(
        color: Color(0xff172c35),
        child: Center(child: CircularProgressIndicator()),
      );
    if (configured.valueOrNull != true)
      return ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Text(
              'Google Maps could not initialize. Reopen this screen to retry.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    final markers = <String, RideLocation>{
      if (widget.pickup != null) 'Pickup': widget.pickup!,
      if (widget.dropoff != null) 'Destination': widget.dropoff!,
      if (widget.driver != null) 'Driver': widget.driver!,
    };
    final map = gm.GoogleMap(
      initialCameraPosition: gm.CameraPosition(
        target: gm.LatLng(
          widget.pickup?.lat ?? .3476,
          widget.pickup?.lng ?? 32.5825,
        ),
        zoom: widget.pickup == null ? 12 : 15,
      ),
      mapType: ref.watch(mapModeProvider),
      padding: EdgeInsets.only(
        top: 100,
        bottom: widget.bottomPadding.clamp(
          0,
          MediaQuery.sizeOf(context).height * .78,
        ),
      ),
      mapToolbarEnabled: false,
      zoomControlsEnabled: false,
      myLocationButtonEnabled: false,
      compassEnabled: true,
      onTap: widget.onTap,
      gestureRecognizers: {
        Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
      },
      onMapCreated: (c) {
        _controller = c;
        _fit();
      },
      markers: {
        for (final e in markers.entries)
          gm.Marker(
            markerId: gm.MarkerId(e.key),
            position: gm.LatLng(e.value.lat, e.value.lng),
            infoWindow: gm.InfoWindow(title: e.key, snippet: e.value.address),
            icon: gm.BitmapDescriptor.defaultMarkerWithHue(
              e.key == 'Driver'
                  ? gm.BitmapDescriptor.hueAzure
                  : e.key == 'Pickup'
                  ? gm.BitmapDescriptor.hueGreen
                  : gm.BitmapDescriptor.hueOrange,
            ),
          ),
      },
      polylines: {
        if (_route.isNotEmpty)
          gm.Polyline(
            polylineId: const gm.PolylineId('journey'),
            points: _route,
            color: const Color(0xff62e5fb),
            width: 6,
          ),
      },
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        ref.watch(journeyNativeMapProvider)(map),
        if (_notice != null)
          Positioned(
            top: 110,
            left: 20,
            right: 20,
            child: IgnorePointer(
              child: Material(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_notice!, style: const TextStyle(fontSize: 11)),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
