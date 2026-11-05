import '../../../core/theme/font_group.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme_style.dart';
import 'background_motion.dart';

class ThemePreferences {
  const ThemePreferences({
    required this.style,
    required this.mode,
    this.palettes = const {},
    this.motion = BackgroundMotion.none,
    this.fontGroup = FontGroup.design,
    this.motionIntensity = .55,
    this.motionSpeed = 1,
    this.productImageSeconds = 1.5,
  });

  static const defaults = ThemePreferences(
    style: AppThemeStyle.gabla,
    mode: ThemeMode.system,
  );

  final AppThemeStyle style;
  final ThemeMode mode;
  final BackgroundMotion motion;
  final FontGroup fontGroup;
  final double motionIntensity;
  final double motionSpeed;
  final double productImageSeconds;
  final Map<String, List<int>> palettes;
  List<Color> get colors =>
      palettes[style.name]?.map(Color.new).toList() ?? style.previewSwatches;

  ThemePreferences copyWith({
    AppThemeStyle? style,
    ThemeMode? mode,
    Map<String, List<int>>? palettes,
    BackgroundMotion? motion,
    FontGroup? fontGroup,
    double? motionIntensity,
    double? motionSpeed,
    double? productImageSeconds,
  }) => ThemePreferences(
    style: style ?? this.style,
    mode: mode ?? this.mode,
    palettes: palettes ?? this.palettes,
    motion: motion ?? this.motion,
    fontGroup: fontGroup ?? this.fontGroup,
    motionIntensity: motionIntensity ?? this.motionIntensity,
    motionSpeed: motionSpeed ?? this.motionSpeed,
    productImageSeconds: productImageSeconds ?? this.productImageSeconds,
  );
}
