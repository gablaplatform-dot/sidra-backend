import 'package:flutter/material.dart';
import 'app_theme_style.dart';

enum FontGroup { design, studio, editorial, friendly, modern, luxury }

extension FontGroupMeta on FontGroup {
  String get label => switch (this) {
    FontGroup.design => 'Design original',
    FontGroup.studio => 'Studio',
    FontGroup.editorial => 'Editorial',
    FontGroup.friendly => 'Friendly',
    FontGroup.modern => 'Modern',
    FontGroup.luxury => 'Luxury',
  };
  String heading(AppThemeStyle style) => switch (this) {
    FontGroup.design =>
      style == AppThemeStyle.editorial ? 'DM Serif Display' : 'Manrope',
    FontGroup.studio => 'Manrope',
    FontGroup.editorial => 'DM Serif Display',
    FontGroup.friendly => 'Nunito Sans',
    FontGroup.modern => 'Sora',
    FontGroup.luxury => 'Playfair Display',
  };
  String get body => switch (this) {
    FontGroup.editorial => 'Manrope',
    FontGroup.friendly => 'Nunito Sans',
    _ => 'Inter',
  };
}

/// Role-specific fonts are shared by custom card typography and ThemeData.
class AppTypography extends ThemeExtension<AppTypography> {
  const AppTypography({required this.heading, required this.body});
  final String heading, body;
  static AppTypography of(BuildContext context) =>
      Theme.of(context).extension<AppTypography>() ??
      const AppTypography(heading: 'Manrope', body: 'Inter');
  TextStyle display({double size = 32, Color? color, bool italic = false}) =>
      TextStyle(
        fontFamily: heading,
        fontSize: size,
        height: 1.08,
        color: color,
        fontStyle: italic ? FontStyle.italic : FontStyle.normal,
        fontWeight: heading == 'DM Serif Display'
            ? FontWeight.w400
            : FontWeight.w700,
        fontVariations: heading == 'DM Serif Display'
            ? null
            : const [FontVariation('wght', 700)],
      );
  @override
  AppTypography copyWith({String? heading, String? body}) =>
      AppTypography(heading: heading ?? this.heading, body: body ?? this.body);
  @override
  AppTypography lerp(covariant AppTypography? other, double t) =>
      other == null || t < .5 ? this : other;
}
