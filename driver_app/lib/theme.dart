import 'package:flutter/material.dart';

/// Brand palette shared with the web apps (public_app / admin_ui).
class GablaColors {
  static const navy = Color(0xFF0B2046);
  static const navyLight = Color(0xFF123268);
  static const gold = Color(0xFFFACC15);
  static const teal = Color(0xFF20A892);
  static const tealDark = Color(0xFF087F70);
  static const bg = Color(0xFFF5F7FA);
  static const border = Color(0xFFE2E8F0);
  static const textMuted = Color(0xFF64748B);
  static const danger = Color(0xFF9F1239);
  static const dangerBg = Color(0xFFFFF1F2);
}

ThemeData buildGablaTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: GablaColors.navy,
      primary: GablaColors.navy,
      secondary: GablaColors.gold,
    ),
    scaffoldBackgroundColor: GablaColors.bg,
    fontFamily: 'Roboto',
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: GablaColors.navy,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: GablaColors.navy, fontSize: 18, fontWeight: FontWeight.w800),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: GablaColors.navy,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        elevation: 0,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: GablaColors.navy,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: GablaColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: GablaColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: GablaColors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: GablaColors.navy, width: 1.6)),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: GablaColors.border)),
    ),
  );
}
