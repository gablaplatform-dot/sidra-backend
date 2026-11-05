import '../../../core/theme/font_group.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme_style.dart';
import '../data/theme_preferences_store.dart';
import '../domain/theme_preferences.dart';
import '../domain/background_motion.dart';

final themePreferencesStoreProvider = Provider<ThemePreferencesStore>(
  (ref) => ThemePreferencesStore(),
);

/// Owns the chosen appearance (style + light/dark/system). Starts at the
/// defaults and swaps in the persisted choice as soon as it loads - same
/// "don't block the first frame on storage" pattern as `CartController`.
class ThemeController extends Notifier<ThemePreferences> {
  @override
  ThemePreferences build() {
    _restore();
    return ThemePreferences.defaults;
  }

  Future<void> _restore() async {
    final saved = await ref.read(themePreferencesStoreProvider).read();
    state = saved;
  }

  void setStyle(AppThemeStyle style) {
    // Cinematic has no light variant - force dark so the picker can't land
    // on a style/mode combination that doesn't exist.
    final mode = style.isDarkOnly ? ThemeMode.dark : state.mode;
    state = state.copyWith(style: style, mode: mode);
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setPalette(List<Color> colors) {
    assert(colors.length == 3);
    state = state.copyWith(
      palettes: {
        ...state.palettes,
        state.style.name: colors.map((c) => c.toARGB32()).toList(),
      },
    );
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setMotion(BackgroundMotion motion) {
    state = state.copyWith(motion: motion);
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setMotionIntensity(double value) {
    state = state.copyWith(motionIntensity: value.clamp(.15, 1));
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setMotionSpeed(double value) {
    state = state.copyWith(motionSpeed: value.clamp(.5, 1.5));
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setProductImageSeconds(double seconds) {
    if (!seconds.isFinite) return;
    state = state.copyWith(productImageSeconds: seconds.clamp(1.0, 10.0));
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setFontGroup(FontGroup group) {
    state = state.copyWith(fontGroup: group);
    ref.read(themePreferencesStoreProvider).write(state);
  }

  void setMode(ThemeMode mode) {
    state = state.copyWith(mode: mode);
    ref.read(themePreferencesStoreProvider).write(state);
  }
}

final themeControllerProvider =
    NotifierProvider<ThemeController, ThemePreferences>(ThemeController.new);
