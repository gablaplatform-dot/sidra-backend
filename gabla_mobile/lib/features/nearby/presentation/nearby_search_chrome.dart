import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/theme/style_tokens.dart';
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
    required this.onType,
    required this.onArea,
    required this.onLocate,
    required this.onToggleView,
    required this.listOnly,
  });
  final AppThemeStyle style;
  final NearbyState state;
  final TextEditingController controller;
  final FocusNode focus;
  final VoidCallback onBack, onSubmit, onClear, onArea, onLocate, onToggleView;
  final ValueChanged<String> onQuery;
  final ValueChanged<String?> onType;
  final bool listOnly;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final radius = Theme.of(context).extension<StyleTokens>()?.cardRadius ?? 8;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton.filledTonal(
                tooltip: 'Back',
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PRODUCTS & SERVICES',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.onSurfaceVariant,
                        fontSize: 10,
                        letterSpacing: .6,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Find nearby',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.of(
                        context,
                      ).display(size: 22, color: c.onSurface),
                    ),
                  ],
                ),
              ),
              IconButton.filledTonal(
                tooltip: listOnly ? 'Show map' : 'Show list',
                onPressed: onToggleView,
                icon: Icon(
                  listOnly ? Icons.map_outlined : Icons.view_list_outlined,
                  size: 20,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ListenableBuilder(
            listenable: focus,
            builder: (context, _) => AnimatedScale(
              scale: focus.hasFocus ? 1.012 : 1,
              duration: Duration(
                milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220,
              ),
              child: Hero(
                tag: nearbyHeroTag,
                child: Material(
                  color: Colors.transparent,
                  child: AnimatedContainer(
                    duration: Duration(
                      milliseconds: MediaQuery.disableAnimationsOf(context)
                          ? 0
                          : 220,
                    ),
                    decoration: BoxDecoration(
                      color: c.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(radius),
                      border: Border.all(
                        color: focus.hasFocus
                            ? c.primary
                            : c.outlineVariant.withValues(alpha: .65),
                        width: focus.hasFocus ? 2 : 1,
                      ),
                      boxShadow: focus.hasFocus
                          ? [
                              BoxShadow(
                                color: c.primary.withValues(alpha: .12),
                                blurRadius: 25,
                                offset: const Offset(0, 6),
                              ),
                            ]
                          : [],
                    ),
                    child: TextField(
                      controller: controller,
                      focusNode: focus,
                      onChanged: onQuery,
                      onSubmitted: (_) {
                        focus.unfocus();
                        onSubmit();
                      },
                      maxLength: 200,
                      textInputAction: TextInputAction.search,
                      style: TextStyle(
                        fontSize: 14,
                        fontFamily: AppTypography.of(context).body,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: 'Search products or services',
                        hintStyle: TextStyle(
                          color: c.onSurfaceVariant,
                          fontSize: 13,
                        ),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          color: c.primary,
                          size: 22,
                        ),
                        suffixIcon: IconButton(
                          tooltip: 'Clear search',
                          onPressed: onClear,
                          icon: Icon(
                            Icons.close_rounded,
                            color: c.onSurfaceVariant,
                            size: 18,
                          ),
                        ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 12,
                          horizontal: 10,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final filter in <String?, (String, IconData)>{
                  null: ('All', Icons.grid_view_outlined),
                  'product': ('Products', Icons.shopping_bag_outlined),
                  'service': ('Services', Icons.handyman_outlined),
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Semantics(
                      button: true,
                      selected: state.type == filter.key,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(radius),
                        onTap: () => onType(filter.key),
                        child: AnimatedContainer(
                          duration: Duration(
                            milliseconds:
                                MediaQuery.disableAnimationsOf(context)
                                ? 0
                                : 220,
                          ),
                          padding: const EdgeInsets.fromLTRB(5, 5, 13, 5),
                          constraints: const BoxConstraints(minHeight: 48),
                          decoration: BoxDecoration(
                            color: state.type == filter.key
                                ? c.primaryContainer
                                : c.surface,
                            borderRadius: BorderRadius.circular(radius),
                            border: Border.all(
                              color: state.type == filter.key
                                  ? c.primary
                                  : c.outlineVariant.withValues(alpha: .5),
                              width: state.type == filter.key ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                filter.value.$2,
                                size: 20,
                                color: state.type == filter.key
                                    ? c.onPrimaryContainer
                                    : c.onSurfaceVariant,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                filter.value.$1,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: state.type == filter.key
                                      ? c.onPrimaryContainer
                                      : c.onSurface,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 7),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: onArea,
                  borderRadius: BorderRadius.circular(radius),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: 6,
                        horizontal: 4,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.place_outlined,
                            color: c.primary,
                            size: 15,
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  state.origin.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: c.onSurface,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  state.result.valueOrNull?.widened == true
                                      ? 'Broader area'
                                      : '15 km',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: c.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.expand_more,
                            color: c.onSurfaceVariant,
                            size: 15,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                tooltip: 'Use my location',
                onPressed: state.locating ? null : onLocate,
                icon: state.locating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location_rounded, size: 18),
              ),
            ],
          ),
          if (state.notice != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                state.notice!,
                style: TextStyle(fontSize: 10, color: c.onSurfaceVariant),
              ),
            ),
          if (state.result.isLoading)
            const LinearProgressIndicator(minHeight: 2),
        ],
      ),
    );
  }
}
