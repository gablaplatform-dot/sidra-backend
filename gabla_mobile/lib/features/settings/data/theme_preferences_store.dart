import '../../../core/theme/font_group.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_theme_style.dart';
import '../domain/theme_preferences.dart';
import '../domain/background_motion.dart';

/// Persists the chosen appearance (Settings → Appearance) across launches.
class ThemePreferencesStore {
  static const _styleKey = 'gabla_theme_style';
  static const _modeKey = 'gabla_theme_mode';

  Future<ThemePreferences> read() async {
    final prefs = await SharedPreferences.getInstance();
    final styleName = prefs.getString(_styleKey);
    final modeName = prefs.getString(_modeKey);
    final style = AppThemeStyle.values.firstWhere(
      (s) => s.name == styleName,
      orElse: () => ThemePreferences.defaults.style,
    );
    final mode = ThemeMode.values.firstWhere(
      (m) => m.name == modeName,
      orElse: () => ThemePreferences.defaults.mode,
    );
    final palettes = <String, List<int>>{};
    try {
      final saved =
          jsonDecode(prefs.getString('gabla_palettes') ?? '{}')
              as Map<String, dynamic>;
      for (final entry in saved.entries) {
        if (entry.value is List && (entry.value as List).length == 3) {
          palettes[entry.key] = (entry.value as List).cast<int>();
        }
      }
    } catch (_) {
      /* Ignore invalid saved palettes. */
    }
    final productImageSeconds =
        prefs.getDouble('gabla_product_image_seconds') ?? 1.5;
    return ThemePreferences(
      style: style,
      productImageSeconds: productImageSeconds.isFinite
          ? productImageSeconds.clamp(1.0, 10.0)
          : 1.5,
      mode: mode,
      palettes: palettes,
      fontGroup: FontGroup.values.firstWhere(
        (g) => g.name == prefs.getString('gabla_font_group'),
        orElse: () => FontGroup.design,
      ),
      motion: BackgroundMotion.values.firstWhere(
        (m) => m.name == prefs.getString('gabla_background_motion'),
        orElse: () => BackgroundMotion.none,
      ),
      motionIntensity: (prefs.getDouble('gabla_motion_intensity') ?? .55).clamp(
        .15,
        1,
      ),
      motionSpeed: (prefs.getDouble('gabla_motion_speed') ?? 1).clamp(.5, 1.5),
    );
  }

  Future<void> write(ThemePreferences preferences) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('gabla_palettes', jsonEncode(preferences.palettes));
    await prefs.setString('gabla_background_motion', preferences.motion.name);
    await prefs.setString('gabla_font_group', preferences.fontGroup.name);
    await prefs.setDouble(
      'gabla_motion_intensity',
      preferences.motionIntensity,
    );
    await prefs.setDouble('gabla_motion_speed', preferences.motionSpeed);
    await prefs.setDouble(
      'gabla_product_image_seconds',
      preferences.productImageSeconds,
    );
    await prefs.setString(_styleKey, preferences.style.name);
    await prefs.setString(_modeKey, preferences.mode.name);
  }
}
