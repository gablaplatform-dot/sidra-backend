import 'package:flutter/material.dart';

import '../style_tokens.dart';

/// The real Gabla look, matching `public_app` (`styles.css` design tokens):
/// blue accent (`#2563eb`→`#1d4ed8`), navy ink (`#0b2046`), Inter, pill
/// shapes everywhere, soft navy-tinted shadows instead of hard ones.
class GablaStyle {
  GablaStyle._();

  static const _blue = Color(0xFF2563EB);
  static const _blueDeep = Color(0xFF1D4ED8);
  static const _navy = Color(0xFF0B2046);
  static const _muted = Color(0xFF64748B);

  static ThemeData light() {
    final base = ThemeData(brightness: Brightness.light, useMaterial3: true);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: _navy, displayColor: _navy);
    final scheme = ColorScheme.fromSeed(
      seedColor: _blue,
      brightness: Brightness.light,
      primary: _blue,
      onPrimary: Colors.white,
      secondary: _navy,
      surface: Colors.white,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF7F8FB),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFFF7F8FB),
        foregroundColor: _navy,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _blue,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: _blueDeep,
          side: const BorderSide(color: Color(0xFFCBD5E1)),
          shape: const StadiumBorder(),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: const TextStyle(color: _muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: _blue, width: 1.5),
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
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFF1F5F9)),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: const StadiumBorder(side: BorderSide(color: Color(0xFFE2E8F0))),
        backgroundColor: Colors.white,
        labelStyle: textTheme.labelLarge,
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 16,
          cardStyle: CardVisualStyle.bordered,
          heroGradient: const [Color(0xFFFFF8F3), Color(0xFFF7F8FB)],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: _blueDeep,
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 0.6,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: _navy,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
      ],
    );
  }

  static ThemeData dark() {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    const bg = Color(0xFF0B1220);
    const surface = Color(0xFF121A2B);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: const Color(0xFFE2E8F0), displayColor: Colors.white);
    final scheme = ColorScheme.fromSeed(
      seedColor: _blue,
      brightness: Brightness.dark,
      primary: const Color(0xFF60A5FA),
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
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF3B82F6),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(999),
          borderSide: const BorderSide(color: Color(0xFF1F2A3D)),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF1F2A3D)),
        ),
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 16,
          cardStyle: CardVisualStyle.bordered,
          heroGradient: const [Color(0xFF0B1220), Color(0xFF121A2B)],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: const Color(0xFF60A5FA),
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 0.6,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
      ],
    );
  }
}
