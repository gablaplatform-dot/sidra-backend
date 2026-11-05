import '../../../core/location/map_mode.dart';
import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:latlong2/latlong.dart';
import '../../../core/theme/app_theme_style.dart';
import '../domain/nearby_result.dart';

final googleMapsConfiguredProvider = FutureProvider<bool>((ref) async {
  try {
    return await const MethodChannel(
          'gabla/maps_configuration',
        ).invokeMethod<bool>('isConfigured') ??
        false;
  } catch (_) {
    return false;
  }
});

/// Native view construction is injectable for tests without fabricating maps.
class NearbyMapConfiguration {
  const NearbyMapConfiguration({
    required this.camera,
    required this.markers,
    required this.onCreated,
    required this.onCameraMove,
    required this.onCameraIdle,
    required this.onTouch,
    required this.padding,
    this.mapType = gm.MapType.satellite,
  });
  final gm.CameraPosition camera;
  final Set<gm.Marker> markers;
  final void Function(gm.GoogleMapController) onCreated;
  final void Function(gm.CameraPosition) onCameraMove;
  final VoidCallback onCameraIdle, onTouch;
  final EdgeInsets padding;
  final gm.MapType mapType;
}

typedef NearbyNativeMapBuilder =
    Widget Function(NearbyMapConfiguration configuration);
final nearbyNativeMapBuilderProvider = Provider<NearbyNativeMapBuilder>(
  (ref) =>
      (configuration) => Listener(
        onPointerDown: (_) => configuration.onTouch(),
        child: gm.GoogleMap(
          initialCameraPosition: configuration.camera,
          mapType: configuration.mapType,
          markers: configuration.markers,
          onMapCreated: configuration.onCreated,
          onCameraMove: configuration.onCameraMove,
          onCameraIdle: configuration.onCameraIdle,
          padding: configuration.padding,
          myLocationButtonEnabled: false,
          myLocationEnabled: false,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          compassEnabled: false,
          buildingsEnabled: false,
          tiltGesturesEnabled: true,
        ),
      ),
);

class NearbyMap extends ConsumerStatefulWidget {
  const NearbyMap({
    super.key,
    required this.style,
    required this.items,
    required this.initialCentre,
    required this.onSelect,
    required this.onCameraChanged,
    this.selectedId,
    this.you,
    this.focus,
    this.initialZoom = 13,
    this.focusRevision = 0,
  });
  final AppThemeStyle style;
  final List<NearbyItem> items;
  final LatLng initialCentre;
  final double initialZoom;
  final int focusRevision;
  final LatLng? you, focus;
  final String? selectedId;
  final void Function(String) onSelect;
  final void Function(LatLng, double, bool) onCameraChanged;
  @override
  ConsumerState<NearbyMap> createState() => _NearbyMapState();
}

class _NearbyMapState extends ConsumerState<NearbyMap> {
  gm.GoogleMapController? _map;
  late gm.CameraPosition _camera;
  bool _userTouch = false, _programmatic = false;
  Timer? _cameraTimer;
  final _icons = <String, gm.BitmapDescriptor>{};
  String _fingerprint = '';
  int _generation = 0;
  @override
  void initState() {
    super.initState();
    _camera = gm.CameraPosition(
      target: _google(widget.initialCentre),
      zoom: widget.initialZoom,
    );
  }

  gm.LatLng _google(LatLng p) => gm.LatLng(p.latitude, p.longitude);
  @override
  void didUpdateWidget(covariant NearbyMap old) {
    super.didUpdateWidget(old);
    if (widget.focus != null &&
        (old.focus != widget.focus ||
            old.focusRevision != widget.focusRevision))
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _move(widget.focus!);
      });
  }

  Future<void> _move(LatLng p, {double? zoom}) async {
    final map = _map;
    if (map == null) return;
    _userTouch = false;
    _programmatic = true;
    _cameraTimer?.cancel();
    final position = gm.CameraPosition(
      target: _google(p),
      zoom: zoom ?? _camera.zoom,
      tilt: widget.style == AppThemeStyle.cinematic ? 30 : 0,
    );
    final update = gm.CameraUpdate.newCameraPosition(position);
    try {
      if (MediaQuery.disableAnimationsOf(context)) {
        await map.moveCamera(update);
      } else {
        await map.animateCamera(
          update,
          duration: const Duration(milliseconds: 650),
        );
      }
    } catch (_) {
      /* Route may have closed during a camera gesture. */
    }
    if (!mounted) return;
    _cameraTimer = Timer(const Duration(milliseconds: 750), () {
      _programmatic = false;
    });
  }

  String _key(List<NearbyItem> group, Color primary) =>
      '${group.first.pin}|${group.first.product.imageUrl}|${group.length}|${group.any((i) => i.id == widget.selectedId)}|${primary.toARGB32()}';
  void _prepareIcons(Map<LatLng, List<NearbyItem>> groups, Color primary) {
    final fingerprint = groups.values.map((g) => _key(g, primary)).join(';');
    if (fingerprint == _fingerprint) return;
    _fingerprint = fingerprint;
    final generation = ++_generation;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final generated = <String, gm.BitmapDescriptor>{};
      await Future.wait(
        groups.values.map((group) async {
          final key = _key(group, primary);
          if (_icons.containsKey(key)) return;
          generated[key] = await _photoPin(
            group.first.product.imageUrl,
            group.length,
            group.any((i) => i.id == widget.selectedId),
            primary,
          );
        }),
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _icons.addAll(generated);
        if (_icons.length > 150) {
          final keep = {
            for (final group in groups.values)
              _key(group, primary): _icons[_key(group, primary)]!,
          };
          _icons
            ..clear()
            ..addAll(keep);
        }
      });
    });
  }

  Future<gm.BitmapDescriptor> _photoPin(
    String? url,
    int count,
    bool selected,
    Color color,
  ) async {
    ui.Image? photo;
    if (url != null && url.isNotEmpty) {
      final stream = ResizeImage(
        NetworkImage(url),
        width: 100,
        height: 100,
      ).resolve(const ImageConfiguration());
      final loaded = Completer<ui.Image>();
      late ImageStreamListener listener;
      listener = ImageStreamListener(
        (info, _) {
          if (!loaded.isCompleted) loaded.complete(info.image.clone());
        },
        onError: (Object error, StackTrace? stack) {
          if (!loaded.isCompleted) loaded.completeError(error, stack);
        },
      );
      stream.addListener(listener);
      try {
        photo = await loaded.future.timeout(const Duration(seconds: 6));
      } catch (_) {
      } finally {
        stream.removeListener(listener);
      }
    }
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final border = selected ? color : Colors.white;
    final rect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(10, 6, 120, 120),
      const Radius.circular(32),
    );
    canvas.drawShadow(ui.Path()..addRRect(rect), Colors.black, 10, true);
    canvas.drawRRect(rect, Paint()..color = border);
    final inner = RRect.fromRectAndRadius(
      const Rect.fromLTWH(17, 13, 106, 106),
      const Radius.circular(25),
    );
    canvas.save();
    canvas.clipRRect(inner);
    if (photo != null) {
      paintImage(
        canvas: canvas,
        rect: inner.outerRect,
        image: photo,
        fit: BoxFit.cover,
      );
    } else {
      canvas.drawRect(inner.outerRect, Paint()..color = color);
      final painter = TextPainter(
        text: const TextSpan(
          text: 'G',
          style: TextStyle(
            color: Colors.white,
            fontSize: 54,
            fontWeight: FontWeight.w800,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      painter.paint(
        canvas,
        Offset(70 - painter.width / 2, 66 - painter.height / 2),
      );
    }
    canvas.restore();
    canvas.drawPath(
      ui.Path()
        ..moveTo(57, 124)
        ..lineTo(70, 142)
        ..lineTo(83, 124)
        ..close(),
      Paint()..color = border,
    );
    if (count > 1) {
      canvas.drawCircle(const Offset(117, 20), 20, Paint()..color = color);
      final text = TextPainter(
        text: TextSpan(
          text: count > 99 ? '99+' : '$count',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(117 - text.width / 2, 20 - text.height / 2));
    }
    final picture = recorder.endRecording();
    final image = await picture.toImage(145, 150);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    picture.dispose();
    photo?.dispose();
    if (bytes == null) return gm.BitmapDescriptor.defaultMarker;
    return gm.BitmapDescriptor.bytes(
      bytes.buffer.asUint8List(),
      width: selected ? 61 : 50,
      height: selected ? 63 : 52,
    );
  }

  @override
  void dispose() {
    _cameraTimer?.cancel();
    _generation++;
    _map?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final available = ref.watch(googleMapsConfiguredProvider);
    final groups = groupNearbyPins(widget.items);
    if (available.valueOrNull == true) _prepareIcons(groups, c.primary);
    final markers = <gm.Marker>{
      for (final group in groups.entries)
        gm.Marker(
          markerId: gm.MarkerId('${group.key.latitude},${group.key.longitude}'),
          position: _google(group.key),
          icon:
              _icons[_key(group.value, c.primary)] ??
              gm.BitmapDescriptor.defaultMarkerWithHue(
                HSVColor.fromColor(c.primary).hue,
              ),
          anchor: const Offset(.5, .95),
          zIndexInt: group.value.any((i) => i.id == widget.selectedId) ? 5 : 1,
          infoWindow: gm.InfoWindow(
            title:
                group.value.first.product.providerName ??
                group.value.first.product.name,
            snippet:
                '${group.value.length} ${group.value.length == 1 ? 'match' : 'matches'} · approximate location',
          ),
          onTap: () {
            final index = group.value.indexWhere(
              (i) => i.id == widget.selectedId,
            );
            widget.onSelect(group.value[(index + 1) % group.value.length].id);
          },
        ),
      if (widget.you != null)
        gm.Marker(
          markerId: const gm.MarkerId('you'),
          position: _google(widget.you!),
          icon: gm.BitmapDescriptor.defaultMarkerWithHue(
            gm.BitmapDescriptor.hueAzure,
          ),
          infoWindow: const gm.InfoWindow(title: 'Your location'),
        ),
    };
    return available.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _unavailable(c),
      data: (configured) => configured
          ? Stack(
              children: [
                Positioned.fill(
                  child: ref.watch(nearbyNativeMapBuilderProvider)(
                    NearbyMapConfiguration(
                      mapType: ref.watch(mapModeProvider),
                      camera: _camera,
                      markers: markers,
                      padding:
                          NearbyMapInsets.of(context) +
                          (widget.style == AppThemeStyle.orbit
                              ? const EdgeInsets.fromLTRB(65, 0, 65, 55)
                              : const EdgeInsets.only(bottom: 12)),
                      onCreated: (controller) {
                        _map = controller;
                        if (widget.focus != null) _move(widget.focus!);
                      },
                      onCameraMove: (position) {
                        _camera = position;
                        widget.onCameraChanged(
                          LatLng(
                            position.target.latitude,
                            position.target.longitude,
                          ),
                          position.zoom,
                          _userTouch && !_programmatic,
                        );
                      },
                      onCameraIdle: () {
                        _userTouch = false;
                        _programmatic = false;
                      },
                      onTouch: () {
                        _userTouch = true;
                        _programmatic = false;
                        _cameraTimer?.cancel();
                      },
                    ),
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: Column(
                    children: [
                      for (final delta in [1.0, -1.0])
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: IconButton.filledTonal(
                            tooltip: delta > 0 ? 'Zoom in' : 'Zoom out',
                            onPressed: () => _move(
                              LatLng(
                                _camera.target.latitude,
                                _camera.target.longitude,
                              ),
                              zoom: (_camera.zoom + delta).clamp(3, 20),
                            ),
                            icon: Icon(
                              delta > 0 ? Icons.add : Icons.remove,
                              size: 18,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            )
          : _unavailable(c),
    );
  }

  Widget _unavailable(ColorScheme c) => ColoredBox(
    color: c.surfaceContainerHigh,
    child: Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.map_outlined, color: c.primary, size: 34),
              const SizedBox(height: 12),
              Text(
                'Map unavailable right now',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: c.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'You can still search and browse the results.',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.onSurfaceVariant, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class NearbyMapInsets extends InheritedWidget {
  const NearbyMapInsets({
    super.key,
    required this.padding,
    required super.child,
  });
  final EdgeInsets padding;
  static EdgeInsets of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<NearbyMapInsets>()?.padding ??
      EdgeInsets.zero;
  @override
  bool updateShouldNotify(covariant NearbyMapInsets oldWidget) =>
      oldWidget.padding != padding;
}
