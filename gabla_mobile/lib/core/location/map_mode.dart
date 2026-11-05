import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gm;
import 'package:shared_preferences/shared_preferences.dart';

class MapModeController extends Notifier<gm.MapType> {
  bool _chosen = false;
  @override
  gm.MapType build() {
    Future.microtask(_restore);
    return gm.MapType.satellite;
  }

  Future<void> _restore() async {
    final value = (await SharedPreferences.getInstance()).getString(
      'gabla.map.mode',
    );
    if (!_chosen && value != null)
      state = gm.MapType.values.firstWhere(
        (m) => m.name == value,
        orElse: () => gm.MapType.satellite,
      );
  }

  void select(gm.MapType mode) {
    _chosen = true;
    state = mode;
    SharedPreferences.getInstance().then(
      (p) => p.setString('gabla.map.mode', mode.name),
    );
  }
}

final mapModeProvider = NotifierProvider<MapModeController, gm.MapType>(
  MapModeController.new,
);
String mapModeLabel(gm.MapType mode) => switch (mode) {
  gm.MapType.normal => 'Road',
  gm.MapType.hybrid => 'Hybrid',
  gm.MapType.terrain => 'Terrain',
  _ => 'Satellite',
};

class MapModeButton extends ConsumerWidget {
  const MapModeButton({super.key, this.compact = false});
  final bool compact;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(mapModeProvider);
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 3,
      borderRadius: BorderRadius.circular(30),
      child: PopupMenuButton<gm.MapType>(
        tooltip: 'Change map type',
        initialValue: current,
        onSelected: (m) => ref.read(mapModeProvider.notifier).select(m),
        itemBuilder: (_) => [
          for (final mode in [
            gm.MapType.normal,
            gm.MapType.satellite,
            gm.MapType.hybrid,
            gm.MapType.terrain,
          ])
            PopupMenuItem(
              value: mode,
              child: Row(
                children: [
                  Icon(
                    mode == current
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                    size: 18,
                  ),
                  const SizedBox(width: 12),
                  Text(mapModeLabel(mode)),
                ],
              ),
            ),
        ],
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.layers_outlined, size: 20),
              if (!compact) const SizedBox(width: 8),
              if (!compact)
                Text(
                  mapModeLabel(current),
                  style: const TextStyle(fontSize: 12),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
