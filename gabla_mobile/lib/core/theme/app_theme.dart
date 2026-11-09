import 'font_group.dart';
import 'package:flutter/material.dart';

import 'app_theme_style.dart';
import 'style_tokens.dart';
import '../motion/design_transitions.dart';
import 'styles/cinematic_style.dart';
import 'styles/discover_style.dart';
import 'styles/editorial_style.dart';
import 'styles/gabla_style.dart';

/// Resolves a (style, brightness) pair to the `ThemeData` to render -
/// the single place that knows about all five design styles.
class AppTheme {
  AppTheme._();

  static ThemeData resolve(
    AppThemeStyle style,
    Brightness brightness, [
    List<Color>? palette,
    FontGroup fontGroup = FontGroup.design,
  ]) {
    if (style.isDarkOnly) brightness = Brightness.dark;
    final dark = brightness == Brightness.dark;
    final base = switch (style) {
      AppThemeStyle.gabla => dark ? GablaStyle.dark() : GablaStyle.light(),
      AppThemeStyle.editorial =>
        dark ? EditorialStyle.dark() : EditorialStyle.light(),
      AppThemeStyle.discover =>
        dark ? DiscoverStyle.dark() : DiscoverStyle.light(),
      AppThemeStyle.cinematic => CinematicStyle.dark(),
      AppThemeStyle.orbit =>
        dark ? DiscoverStyle.dark() : DiscoverStyle.light(),
    };
    final colors = palette ?? style.previewSwatches;
    final surface = dark
        ? Color.lerp(colors[2], Colors.black, .88)!
        : colors[2];
    Color ink(Color c) =>
        ThemeData.estimateBrightnessForColor(c) == Brightness.dark
        ? Colors.white
        : const Color(0xFF14191F);
    final scheme = ColorScheme.fromSeed(
      seedColor: colors[0],
      brightness: ThemeData.estimateBrightnessForColor(surface),
      primary: colors[0],
      onPrimary: ink(colors[0]),
      secondary: colors[1],
      onSecondary: ink(colors[1]),
      surface: surface,
      onSurface: ink(surface),
    );
    final secondarySurface = Color.lerp(surface, colors[1], .3)!;
    final themedScheme = scheme.copyWith(
      secondaryContainer: secondarySurface,
      onSecondaryContainer: ink(secondarySurface),
    );
    final tokens = base.extension<StyleTokens>();
    final transitions = DesignTransitions(style);
    final typography = AppTypography(
      heading: fontGroup.heading(style),
      body: fontGroup.body,
    );
    final bodyText = base.textTheme.apply(
      fontFamily: typography.body,
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );
    final text = bodyText.copyWith(
      displayLarge: bodyText.displayLarge?.copyWith(
        fontFamily: typography.heading,
      ),
      displayMedium: bodyText.displayMedium?.copyWith(
        fontFamily: typography.heading,
      ),
      displaySmall: bodyText.displaySmall?.copyWith(
        fontFamily: typography.heading,
      ),
      headlineLarge: bodyText.headlineLarge?.copyWith(
        fontFamily: typography.heading,
      ),
      headlineMedium: bodyText.headlineMedium?.copyWith(
        fontFamily: typography.heading,
      ),
      headlineSmall: bodyText.headlineSmall?.copyWith(
        fontFamily: typography.heading,
      ),
      titleLarge: bodyText.titleLarge?.copyWith(fontFamily: typography.heading),
      titleMedium: bodyText.titleMedium?.copyWith(
        fontFamily: typography.heading,
      ),
    );
    return base.copyWith(
      colorScheme: themedScheme,
      extensions: [
        typography,
        if (tokens != null)
          tokens.copyWith(
            heroGradient: [colors[0], colors[1]],
            eyebrowStyle: tokens.eyebrowStyle.copyWith(color: scheme.primary),
            sectionTitleStyle: tokens.sectionTitleStyle.copyWith(
              color: scheme.onSurface,
              fontFamily: typography.heading,
            ),
          ),
      ],
      scaffoldBackgroundColor: surface,
      textTheme: text,
      appBarTheme: base.appBarTheme.copyWith(
        backgroundColor: surface,
        foregroundColor: scheme.onSurface,
        titleTextStyle: text.titleLarge,
      ),
      cardTheme: base.cardTheme.copyWith(
        color: Color.lerp(surface, colors[0], .035),
      ),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        fillColor: scheme.surfaceContainerHighest,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
        ),
      ),
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          for (final platform in TargetPlatform.values) platform: transitions,
        },
      ),
    );
  }
}
