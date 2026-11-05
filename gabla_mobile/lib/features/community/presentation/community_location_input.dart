import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/location/google_location_service.dart';
import '../../../core/location/google_place_picker.dart';
import '../../ride/domain/ride_location.dart';

class CommunityLocationInput extends ConsumerStatefulWidget {
  const CommunityLocationInput({
    super.key,
    required this.controller,
    required this.onSelected,
    this.location,
    required this.event,
  });
  final TextEditingController controller;
  final ValueChanged<RideLocation?> onSelected;
  final RideLocation? location;
  final bool event;
  @override
  ConsumerState<CommunityLocationInput> createState() => _LocationState();
}

class _LocationState extends ConsumerState<CommunityLocationInput> {
  Timer? _timer;
  List<PlaceSuggestion> _suggestions = [];
  String? _error;
  bool _busy = false;
  int _revision = 0;
  final _session = 'community-${DateTime.now().microsecondsSinceEpoch}';
  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _search(String query) {
    _timer?.cancel();
    final revision = ++_revision;
    widget.onSelected(null);
    setState(() {
      _busy = false;
      _error = null;
    });
    if (query.trim().length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    _timer = Timer(const Duration(milliseconds: 350), () async {
      try {
        final results = await ref
            .read(googleLocationServiceProvider)
            .suggestions(query.trim(), _session);
        if (mounted && revision == _revision)
          setState(() {
            _suggestions = results;
            _error = null;
          });
      } catch (_) {
        if (mounted && revision == _revision)
          setState(() {
            _suggestions = [];
            _error =
                'Search is unavailable. Enter the full address or pick a map pin.';
          });
      }
    });
  }

  Future<void> _resolve(Future<RideLocation> Function() lookup) async {
    _timer?.cancel();
    final revision = ++_revision;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final place = await lookup();
      if (!mounted || revision != _revision) return;
      widget.controller.text = place.address;
      widget.onSelected(place);
      setState(() => _suggestions = []);
      FocusScope.of(context).unfocus();
    } catch (_) {
      if (mounted && revision == _revision)
        setState(
          () => _error =
              'Could not find this address. Add more detail or pick it on the map.',
        );
    } finally {
      if (mounted && revision == _revision) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.event ? 'Venue & address' : 'Work location',
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        TextFormField(
          key: const ValueKey('community-location-search'),
          controller: widget.controller,
          onChanged: _search,
          onFieldSubmitted: (v) {
            if (v.trim().isNotEmpty)
              _resolve(
                () => ref.read(googleLocationServiceProvider).geocode(v.trim()),
              );
          },
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: widget.event
                ? 'Search venue, street or city'
                : 'Search an address or city',
            prefixIcon: const Icon(Icons.search, size: 20),
            suffixIcon: _busy
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    tooltip: 'Search location',
                    onPressed: () => widget.controller.text.trim().isEmpty
                        ? null
                        : _resolve(
                            () => ref
                                .read(googleLocationServiceProvider)
                                .geocode(widget.controller.text.trim()),
                          ),
                    icon: const Icon(Icons.arrow_forward, size: 20),
                  ),
          ),
          validator: (v) => (v ?? '').trim().isEmpty
              ? 'Add a location or choose one on the map.'
              : null,
        ),
        if (_suggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              border: Border.all(color: c.outlineVariant),
            ),
            child: Column(
              children: [
                for (final suggestion in _suggestions.take(4))
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.place_outlined, size: 18),
                    title: Text(
                      suggestion.label,
                      style: const TextStyle(fontSize: 13),
                    ),
                    onTap: () => _resolve(
                      () => ref
                          .read(googleLocationServiceProvider)
                          .place(suggestion.id, _session),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          key: const ValueKey('community-pick-map'),
          onPressed: () async {
            _timer?.cancel();
            ++_revision;
            final place = await pickGoogleLocation(
              context,
              title: widget.event
                  ? 'Choose event venue'
                  : 'Choose work location',
              initial: widget.location,
            );
            if (place != null && mounted) {
              widget.controller.text = place.address;
              widget.onSelected(place);
              setState(() {
                _suggestions = [];
                _error = null;
                _busy = false;
              });
            }
          },
          icon: const Icon(Icons.map_outlined, size: 18),
          label: Text(
            widget.location == null
                ? 'Pick a location on the map'
                : 'Change map location',
          ),
        ),
        if (widget.location != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(
              children: [
                Icon(Icons.check_circle_outline, size: 16, color: c.primary),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    'Map pin saved with this address',
                    style: TextStyle(color: c.primary, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: TextStyle(
                fontSize: 12,
                color: c.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ),
        const SizedBox(height: 8),
        Text(
          'Search and select a place, pick a map pin, or enter a complete address.',
          style: TextStyle(
            color: c.onSurfaceVariant,
            fontSize: 11,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
