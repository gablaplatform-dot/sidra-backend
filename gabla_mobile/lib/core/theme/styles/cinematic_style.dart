import 'package:flutter/material.dart';

import '../style_tokens.dart';

/// Moody, premium, dark-only: near-black backgrounds, full-bleed cinematic
/// photography, warm off-white text with generous letter-spacing, soft
/// gold accent, glass-like surfaces. Inspired by luxury travel/real-estate
/// app concepts (Pinterest). There is no light variant - `isDarkOnly` on
/// `AppThemeStyle` hides the light/dark toggle for this style.
class CinematicStyle {
  CinematicStyle._();

  static const _bg = Color(0xFF14130F);
  static const _surface = Color(0xFF201F1A);
  static const _cream = Color(0xFFEDE7DA);
  static const _gold = Color(0xFFC9A86A);

  static ThemeData dark() {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: _cream, displayColor: Colors.white);
    final scheme = ColorScheme.fromSeed(
      seedColor: _gold,
      brightness: Brightness.dark,
      primary: _gold,
      onPrimary: _bg,
      surface: _surface,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: _bg,
      textTheme: textTheme.copyWith(
        headlineMedium: textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w300,
          letterSpacing: 0.4,
        ),
        titleLarge: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w500,
          letterSpacing: 0.3,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _cream,
          foregroundColor: _bg,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          shape: const StadiumBorder(),
          elevation: 0,
          textStyle: TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: const BorderSide(color: Color(0x33FFFFFF)),
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0x14FFFFFF),
        hintStyle: const TextStyle(color: Color(0x99EDE7DA)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0x1FFFFFFF)),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: const Color(0x14FFFFFF),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Color(0x1FFFFFFF)),
        ),
      ),
      dividerColor: const Color(0x1FFFFFFF),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 24,
          cardStyle: CardVisualStyle.photoScrim,
          heroGradient: const [Color(0xFF221F17), _bg],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: _gold,
            fontWeight: FontWeight.w600,
            fontSize: 12,
            letterSpacing: 2,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: Colors.white,
            fontWeight: FontWeight.w500,
            fontSize: 18,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}
