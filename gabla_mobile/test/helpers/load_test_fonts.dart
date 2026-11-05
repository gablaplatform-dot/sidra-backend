import 'package:flutter/services.dart';

/// Widget-test previews use the bundled app fonts rather than Ahem rectangles.
Future<void> loadTestFonts() async {
  for (final entry in const {
    'Inter': 'assets/fonts/Inter.ttf',
    'Manrope': 'assets/fonts/Manrope.ttf',
    'Sora': 'assets/fonts/Sora.ttf',
    'Nunito Sans': 'assets/fonts/NunitoSans.ttf',
    'DM Serif Display': 'assets/fonts/DMSerifDisplay-Regular.ttf',
    'Playfair Display': 'assets/fonts/PlayfairDisplay.ttf',
    'MaterialIcons': 'fonts/MaterialIcons-Regular.otf',
  }.entries) {
    final loader = FontLoader(entry.key)..addFont(rootBundle.load(entry.value));
    await loader.load();
  }
}
