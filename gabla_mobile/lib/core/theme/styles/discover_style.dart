import 'package:flutter/material.dart';

import '../style_tokens.dart';

/// Vibrant, photo-led "discover" style: clean white chrome, deep
/// purple/teal accents, big full-bleed rounded photo cards with overlaid
/// white text - a swipeable-card-stack feel. Inspired by card-stack
/// discovery-app concepts (Pinterest).
class DiscoverStyle {
  DiscoverStyle._();

  static const _purple = Color(0xFF6D28D9);
  static const _teal = Color(0xFF0EA5A5);
  static const _ink = Color(0xFF111114);

  static ThemeData light() {
    final base = ThemeData(brightness: Brightness.light, useMaterial3: true);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: _ink, displayColor: _ink);
    final scheme = ColorScheme.fromSeed(
      seedColor: _purple,
      brightness: Brightness.light,
      primary: _purple,
      onPrimary: Colors.white,
      secondary: _teal,
      surface: Colors.white,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.white,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: _ink,
        elevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _purple,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF4F4F6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: const BorderSide(color: Color(0xFFF0F0F2)),
        ),
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 28,
          cardStyle: CardVisualStyle.photoScrim,
          heroGradient: const [_purple, Color(0xFF1E1B4B)],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: _teal,
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 0.4,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: _ink,
            fontWeight: FontWeight.w800,
            fontSize: 19,
          ),
        ),
      ],
    );
  }

  static ThemeData dark() {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    const bg = Color(0xFF0F0B1A);
    const surface = Color(0xFF1A1526);
    const purpleLight = Color(0xFFA78BFA);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: const Color(0xFFE9E7EF), displayColor: Colors.white);
    final scheme = ColorScheme.fromSeed(
      seedColor: purpleLight,
      brightness: Brightness.dark,
      primary: purpleLight,
      secondary: _teal,
      surface: surface,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        foregroundColor: Colors.white,
        elevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: purpleLight,
          foregroundColor: bg,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 28,
          cardStyle: CardVisualStyle.photoScrim,
          heroGradient: const [Color(0xFF2E1065), bg],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: _teal,
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 0.4,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 19,
          ),
        ),
      ],
    );
  }
}
