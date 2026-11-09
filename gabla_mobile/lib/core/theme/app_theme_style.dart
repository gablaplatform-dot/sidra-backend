import 'package:flutter/material.dart';

/// The five selectable design languages the app ships (Settings → Appearance).
/// Each has its own light + dark `ThemeData` - see `styles/`.
enum AppThemeStyle { gabla, editorial, discover, cinematic, orbit }

extension AppThemeStyleMeta on AppThemeStyle {
  String get label => switch (this) {
    AppThemeStyle.gabla => 'Gabla Classic',
    AppThemeStyle.editorial => 'Editorial',
    AppThemeStyle.discover => 'Discover',
    AppThemeStyle.cinematic => 'Cinematic',
    AppThemeStyle.orbit => 'Orbit',
  };

  String get description => switch (this) {
    AppThemeStyle.gabla =>
      'The real Gabla look - blue and navy, clean and friendly.',
    AppThemeStyle.editorial =>
      'Bold headlines on soft pastels, magazine-style layout.',
    AppThemeStyle.discover =>
      'Vibrant full-bleed photography and floating cards.',
    AppThemeStyle.cinematic =>
      'Immersive dark panels and slow cinematic reveals.',
    AppThemeStyle.orbit =>
      'Floating photo collages, gentle drift, and playful scale transitions.',
  };

  /// Always-dark styles skip the light/dark toggle in Settings.
  bool get isDarkOnly => this == AppThemeStyle.cinematic;

  /// Three preview swatches per style, used by the picker card in Settings.
  List<Color> get previewSwatches => switch (this) {
    AppThemeStyle.gabla => const [
      Color(0xFF2563EB),
      Color(0xFF0B2046),
      Color(0xFFFFFFFF),
    ],
    AppThemeStyle.editorial => const [
      Color(0xFF0A0A0A),
      Color(0xFFE3E0F7),
      Color(0xFFFFF8F3),
    ],
    AppThemeStyle.discover => const [
      Color(0xFF6D28D9),
      Color(0xFF0EA5A5),
      Color(0xFFFFFFFF),
    ],
    AppThemeStyle.orbit => const [
      Color(0xFF006B5E),
      Color(0xFFFFAF72),
      Color(0xFFF2F8F3),
    ],
    AppThemeStyle.cinematic => const [
      Color(0xFFEDE7DA),
      Color(0xFF2A2A28),
      Color(0xFF14130F),
    ],
  };
}
