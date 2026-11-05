enum BackgroundMotion { none, aurora, orbs, lines }

extension BackgroundMotionMeta on BackgroundMotion {
  String get label => switch (this) {
    BackgroundMotion.none => 'None',
    BackgroundMotion.aurora => 'Aurora',
    BackgroundMotion.orbs => 'Floating orbs',
    BackgroundMotion.lines => 'Flowing lines',
  };
  String get description => switch (this) {
    BackgroundMotion.none => 'A clean, still background.',
    BackgroundMotion.aurora => 'Soft ribbons of your palette colors.',
    BackgroundMotion.orbs => 'Slowly drifting pools of color.',
    BackgroundMotion.lines => 'Gentle waves across the canvas.',
  };
}
