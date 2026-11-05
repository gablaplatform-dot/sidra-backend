import 'package:flutter/material.dart';

import '../style_tokens.dart';

/// Bold magazine-style editorial look: oversized near-black headlines on
/// soft pastel-lavender backgrounds, minimal color, floating soft-shadow
/// cards. Inspired by weekly-UI-concept book-app shots (Pinterest).
class EditorialStyle {
  EditorialStyle._();

  static const _ink = Color(0xFF0A0A0A);
  static const _lavender = Color(0xFFE3E0F7);
  static const _cream = Color(0xFFFFF8F3);

  static ThemeData light() {
    final base = ThemeData(brightness: Brightness.light, useMaterial3: true);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: _ink, displayColor: _ink);
    final scheme = ColorScheme.fromSeed(
      seedColor: _ink,
      brightness: Brightness.light,
      primary: _ink,
      onPrimary: Colors.white,
      secondary: const Color(0xFF7C3AED),
      surface: Colors.white,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: _cream,
      textTheme: textTheme.copyWith(
        headlineMedium: textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w900,
          height: 1.05,
        ),
        titleLarge: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: _cream,
        foregroundColor: _ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w900,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _ink,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
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
        shadowColor: _lavender,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: const StadiumBorder(),
        backgroundColor: _lavender,
        labelStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 24,
          cardStyle: CardVisualStyle.floating,
          heroGradient: const [_lavender, _cream],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: const Color(0xFF7C3AED),
            fontWeight: FontWeight.w800,
            fontSize: 12,
            letterSpacing: 1.2,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: _ink,
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
      ],
    );
  }

  static ThemeData dark() {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    const bg = Color(0xFF15131F);
    const surface = Color(0xFF1E1B2E);
    const lilac = Color(0xFFC4B5FD);
    final textTheme = base.textTheme
        .apply(fontFamily: 'Inter')
        .apply(bodyColor: const Color(0xFFE5E3F0), displayColor: Colors.white);
    final scheme = ColorScheme.fromSeed(
      seedColor: lilac,
      brightness: Brightness.dark,
      primary: lilac,
      surface: surface,
    );
    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      textTheme: textTheme.copyWith(
        headlineMedium: textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w900,
          height: 1.05,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        foregroundColor: Colors.white,
        elevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w900,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: bg,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: const StadiumBorder(),
          elevation: 0,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      extensions: [
        StyleTokens(
          pillRadius: 999,
          cardRadius: 24,
          cardStyle: CardVisualStyle.floating,
          heroGradient: const [Color(0xFF201C33), bg],
          eyebrowStyle: TextStyle(
            fontFamily: 'Inter',
            color: lilac,
            fontWeight: FontWeight.w800,
            fontSize: 12,
            letterSpacing: 1.2,
          ),
          sectionTitleStyle: TextStyle(
            fontFamily: 'Inter',
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
      ],
    );
  }
}
