import '../../../core/location/google_place_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import '../../nearby/presentation/nearby_map.dart';
import '../../ride/application/ride_providers.dart';
import '../../ride/domain/ride_location.dart';

class DeliveryLocationField extends ConsumerStatefulWidget {
  const DeliveryLocationField({
    super.key,
    required this.controller,
    required this.onLocated,
    required this.onEdited,
  });
  final TextEditingController controller;
  final void Function(RideLocation point, String source) onLocated;
  final VoidCallback onEdited;
  @override
  ConsumerState<DeliveryLocationField> createState() =>
      _DeliveryLocationFieldState();
}

class _DeliveryLocationFieldState extends ConsumerState<DeliveryLocationField> {
  bool _busy = false;
  String? _notice;
  Future<void> _locate({bool gps = false, gm.LatLng? pin}) async {
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      final service = ref.read(deviceLocationServiceProvider);
      final point = pin != null
          ? await service.locationAt(pin.latitude, pin.longitude)
          : gps
          ? await service.currentLocation()
          : await service.geocodeAddress(widget.controller.text.trim());
      if (!mounted) return;
      widget.controller.text = point.address;
      widget.onLocated(
        point,
        pin != null
            ? 'map'
            : gps
            ? 'gps'
            : 'search',
      );
      setState(() => _notice = 'Location attached for seller directions.');
    } catch (_) {
      if (mounted)
        setState(
          () => _notice =
              'We couldn’t locate that place. You can still type your delivery address.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _map() async {
    final place = await pickGoogleLocation(
      context,
      title: 'Where should we deliver?',
    );
    if (place == null || !mounted) return;
    widget.controller.text = place.address;
    widget.onLocated(place, 'map');
    setState(() => _notice = 'Google location attached for seller directions.');
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextFormField(
        controller: widget.controller,
        onChanged: (_) => widget.onEdited(),
        decoration: const InputDecoration(labelText: 'Delivery address'),
        validator: (v) =>
            (v?.trim().isEmpty ?? true) ? 'Enter a delivery address.' : null,
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 6,
        children: [
          TextButton.icon(
            onPressed: _busy ? null : () => _locate(gps: true),
            icon: const Icon(Icons.my_location, size: 16),
            label: const Text('Use my location'),
          ),
          TextButton.icon(
            onPressed: _busy ? null : () => _locate(),
            icon: const Icon(Icons.search, size: 16),
            label: const Text('Locate address'),
          ),
          if (ref.watch(googleMapsConfiguredProvider).valueOrNull == true)
            TextButton.icon(
              onPressed: _busy ? null : _map,
              icon: const Icon(Icons.pin_drop_outlined, size: 16),
              label: const Text('Choose on map'),
            ),
        ],
      ),
      if (_busy) const LinearProgressIndicator(),
      if (_notice != null)
        Text(_notice!, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}
