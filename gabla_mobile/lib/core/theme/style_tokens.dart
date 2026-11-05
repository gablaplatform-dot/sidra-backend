import 'package:flutter/material.dart';

/// How a "card" surface (product card, category card, provider card) is
/// drawn - the one visual trait that differs most between the 4 styles.
enum CardVisualStyle {
  /// White surface, hairline border, no shadow (Gabla Classic / Discover).
  bordered,

  /// White surface, soft large-blur shadow, no border (Editorial).
  floating,

  /// Full-bleed photo with a dark gradient scrim and light text on top
  /// (Cinematic).
  photoScrim,
}

/// Per-style tokens `ThemeData` has no slot for. Read via
/// `Theme.of(context).extension<StyleTokens>()!`.
@immutable
class StyleTokens extends ThemeExtension<StyleTokens> {
  const StyleTokens({
    required this.pillRadius,
    required this.cardRadius,
    required this.cardStyle,
    required this.heroGradient,
    required this.eyebrowStyle,
    required this.sectionTitleStyle,
  });

  /// Buttons, search bars, chips - `999` for a full pill.
  final double pillRadius;

  /// Product/category/provider cards.
  final double cardRadius;

  final CardVisualStyle cardStyle;

  /// Background gradient for hero/accent surfaces, or null for a flat color.
  final List<Color>? heroGradient;

  /// Small uppercase label above a headline (editorial "eyebrow" convention).
  final TextStyle eyebrowStyle;

  /// Section headers ("New arrivals", "Top rated providers", ...).
  final TextStyle sectionTitleStyle;

  @override
  StyleTokens copyWith({
    double? pillRadius,
    double? cardRadius,
    CardVisualStyle? cardStyle,
    List<Color>? heroGradient,
    TextStyle? eyebrowStyle,
    TextStyle? sectionTitleStyle,
  }) {
    return StyleTokens(
      pillRadius: pillRadius ?? this.pillRadius,
      cardRadius: cardRadius ?? this.cardRadius,
      cardStyle: cardStyle ?? this.cardStyle,
      heroGradient: heroGradient ?? this.heroGradient,
      eyebrowStyle: eyebrowStyle ?? this.eyebrowStyle,
      sectionTitleStyle: sectionTitleStyle ?? this.sectionTitleStyle,
    );
  }

  @override
  StyleTokens lerp(ThemeExtension<StyleTokens>? other, double t) {
    // Styles switch instantly (a deliberate pick in Settings), never animate
    // between each other, so no interpolation is needed.
    if (other is! StyleTokens) return this;
    return t < 0.5 ? this : other;
  }
}
