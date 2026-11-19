import 'package:flutter/material.dart';

import '../../../core/theme/app_theme_style.dart';
import '../application/nearby_controller.dart';
import 'nearby_entry.dart';

class NearbySearchChrome extends StatelessWidget {
  const NearbySearchChrome({
    super.key,
    required this.style,
    required this.state,
    required this.controller,
    required this.focus,
    required this.onBack,
    required this.onQuery,
    required this.onSubmit,
    required this.onClear,
    required this.onArea,
    required this.onLocate,
    required this.onRadius,
    required this.onHide,
    required this.onToggleView,
    required this.listOnly,
  });

  final AppThemeStyle style;
  final NearbyState state;
  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onBack,
      onSubmit,
      onClear,
      onArea,
      onLocate,
      onHide,
      onToggleView;
  final ValueChanged<String> onQuery;
  final ValueChanged<double> onRadius;
  final bool listOnly;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final radius = switch (style) {
      AppThemeStyle.editorial => 4.0,
      AppThemeStyle.orbit => 8.0,
      AppThemeStyle.cinematic => 10.0,
      AppThemeStyle.gabla => 14.0,
      AppThemeStyle.discover => 18.0,
    };
    return Material(
      color: c.surface,
      elevation: 6,
      shadowColor: c.shadow.withValues(alpha: .24),
      borderRadius: BorderRadius.circular(radius),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Back',
                  onPressed: onBack,
                  icon: const Icon(Icons.arrow_back, size: 21),
                ),
                Expanded(
                  child: Hero(
                    tag: nearbyHeroTag,
                    child: Material(
                      color: c.surface,
                      child: TextField(
                        controller: controller,
                        focusNode: focus,
                        onChanged: onQuery,
                        onSubmitted: (_) {
                          focus.unfocus();
                          onSubmit();
                        },
                        textInputAction: TextInputAction.search,
                        maxLength: 200,
                        decoration: InputDecoration(
                          counterText: '',
                          hintText: 'Search nearby',
                          hintStyle: const TextStyle(fontSize: 14),
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 12,
                          ),
                          suffixIcon: IconButton(
                            tooltip: 'Clear search',
                            onPressed: onClear,
                            icon: const Icon(Icons.close, size: 17),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Hide search',
                  onPressed: onHide,
                  icon: const Icon(Icons.keyboard_arrow_up),
                ),
              ],
            ),
            Divider(height: 1, color: c.outlineVariant),
            Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: onArea,
                    icon: const Icon(Icons.place_outlined, size: 16),
                    label: Text(
                      state.origin.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                PopupMenuButton<double>(
                  tooltip: 'Search radius',
                  initialValue: state.origin.radiusKm,
                  onSelected: onRadius,
                  itemBuilder: (_) => [
                    for (final radius in [5.0, 10.0, 15.0, 25.0, 50.0, 100.0])
                      CheckedPopupMenuItem(
                        value: radius,
                        checked: radius == state.origin.radiusKm,
                        child: Text('${radius.round()} km'),
                      ),
                  ],
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 14,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.radar, size: 16, color: c.primary),
                        const SizedBox(width: 4),
                        Text(
                          '${state.origin.radiusKm.round()} km',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        const Icon(Icons.expand_more, size: 15),
                      ],
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Use my location',
                  onPressed: state.locating ? null : onLocate,
                  icon: const Icon(Icons.my_location_outlined, size: 19),
                ),
                IconButton(
                  tooltip: listOnly ? 'Show map' : 'Show list',
                  onPressed: onToggleView,
                  icon: Icon(
                    listOnly ? Icons.map_outlined : Icons.view_list_outlined,
                    size: 20,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
