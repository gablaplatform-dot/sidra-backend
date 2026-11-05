import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
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
    final editorial = style == AppThemeStyle.editorial;
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
                      switch (style) {
                        AppThemeStyle.gabla => 'THE WORLD AROUND YOU',
                        AppThemeStyle.editorial => 'THE NEIGHBORHOOD EDIT',
                        AppThemeStyle.discover => 'FOLLOW YOUR CURIOSITY',
                        AppThemeStyle.cinematic => 'A DIFFERENT POINT OF VIEW',
                        AppThemeStyle.orbit => 'A WORLD WITHIN REACH',
                      },
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.onSurfaceVariant,
                        fontSize: 8,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      switch (style) {
                        AppThemeStyle.gabla => 'Find it nearby',
                        AppThemeStyle.editorial => 'Good things, close by.',
                        AppThemeStyle.discover => 'Around you',
                        AppThemeStyle.cinematic => 'Your city. Unfolded.',
                        AppThemeStyle.orbit => 'Explore your radius',
                      },
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
          const SizedBox(height: 14),
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
                      borderRadius: BorderRadius.circular(editorial ? 10 : 25),
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
                        hintText: 'What are you looking for?',
                        hintStyle: TextStyle(
                          color: c.onSurfaceVariant,
                          fontSize: 13,
                        ),
                        prefixIcon: Padding(
                          padding: const EdgeInsets.all(9),
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: c.primary,
                              borderRadius: BorderRadius.circular(
                                editorial ? 7 : 16,
                              ),
                            ),
                            child: Icon(
                              Icons.search_rounded,
                              color: c.onPrimary,
                              size: 21,
                            ),
                          ),
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
                          vertical: 18,
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
                for (final filter in <String?, (String, String?)>{
                  null: ('Everything', null),
                  'product': ('Products', 'assets/artwork/shop.png'),
                  'service': ('Services', 'assets/artwork/services.png'),
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Semantics(
                      button: true,
                      selected: state.type == filter.key,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(editorial ? 9 : 24),
                        onTap: () => onType(filter.key),
                        child: AnimatedContainer(
                          duration: Duration(
                            milliseconds:
                                MediaQuery.disableAnimationsOf(context)
                                ? 0
                                : 220,
                          ),
                          padding: const EdgeInsets.fromLTRB(5, 5, 13, 5),
                          decoration: BoxDecoration(
                            color: state.type == filter.key
                                ? c.primaryContainer
                                : c.surface,
                            borderRadius: BorderRadius.circular(
                              editorial ? 9 : 24,
                            ),
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
                              ClipRRect(
                                borderRadius: BorderRadius.circular(
                                  editorial ? 6 : 18,
                                ),
                                child: SizedBox(
                                  width: 30,
                                  height: 30,
                                  child: filter.value.$2 == null
                                      ? ColoredBox(
                                          color: c.primary,
                                          child: Icon(
                                            Icons.explore_outlined,
                                            color: c.onPrimary,
                                            size: 18,
                                          ),
                                        )
                                      : Image.asset(
                                          filter.value.$2!,
                                          fit: BoxFit.cover,
                                        ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                filter.value.$1,
                                style: TextStyle(
                                  fontSize: 11,
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
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 8,
                      horizontal: 4,
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.place_outlined, color: c.primary, size: 15),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            state.origin.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: c.onSurface,
                            ),
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
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: c.secondaryContainer,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Text(
                  state.result.valueOrNull?.widened == true
                      ? 'Broader area'
                      : '15 km',
                  style: TextStyle(
                    color: c.onSecondaryContainer,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
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
