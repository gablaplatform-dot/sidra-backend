import 'typography_settings.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'motion_settings.dart';
import '../domain/palette_presets.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme_style.dart';
import '../application/theme_controller.dart';

class AppearanceScreen extends ConsumerWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(themeControllerProvider);
    final theme = Theme.of(context);

    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Design studio'),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelPadding: EdgeInsets.symmetric(horizontal: 5),
            labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            tabs: [
              Tab(text: 'Designs'),
              Tab(text: 'Palettes'),
              Tab(text: 'Typography'),
              Tab(text: 'Motion'),
              Tab(text: 'Display'),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'Present design',
              onPressed: () => context.go('/home'),
              icon: const Icon(Icons.play_arrow_rounded),
            ),
          ],
        ),
        body: TabBarView(
          children: [
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FilledButton.icon(
                  onPressed: () => context.go('/home'),
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: Text('Present ${preferences.style.label}'),
                ),
                const SizedBox(height: 20),
                Text('Layout design', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Choose a layout. Change its colors separately in Palettes.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                for (final style in AppThemeStyle.values) ...[
                  _StyleCard(
                    style: style,
                    selected: preferences.style == style,
                    onTap: () => ref
                        .read(themeControllerProvider.notifier)
                        .setStyle(style),
                  ),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 12),
              ],
            ),
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${preferences.style.label} colors',
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Color combinations change the palette, never the layout.',
                ),
                const SizedBox(height: 16),
                Text('Three-color palette', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                const Text(
                  'Primary · Accent · Background. Saved separately for each design.',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (var i = 0; i < 3; i++)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: OutlinedButton(
                            key: ValueKey('palette-color-$i'),
                            onPressed: () async {
                              final color = await _editColor(
                                context,
                                preferences.colors[i],
                              );
                              if (color == null) return;
                              final colors = [
                                ...ref.read(themeControllerProvider).colors,
                              ];
                              colors[i] = color;
                              ref
                                  .read(themeControllerProvider.notifier)
                                  .setPalette(colors);
                            },
                            child: Column(
                              children: [
                                Container(
                                  height: 34,
                                  margin: const EdgeInsets.symmetric(
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: preferences.colors[i],
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: theme.dividerColor,
                                    ),
                                  ),
                                ),
                                Text(
                                  ['Primary', 'Accent', 'Background'][i],
                                  style: const TextStyle(fontSize: 10),
                                ),
                                const SizedBox(height: 8),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text('Color combinations', style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                for (final preset in palettePresets.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _PaletteCard(
                      name: preset.key,
                      colors: preset.value,
                      selected: List.generate(
                        3,
                        (i) => preferences.colors[i] == preset.value[i],
                      ).every((v) => v),
                      onTap: () => ref
                          .read(themeControllerProvider.notifier)
                          .setPalette(preset.value),
                    ),
                  ),
                TextButton(
                  onPressed: () => ref
                      .read(themeControllerProvider.notifier)
                      .setPalette(preferences.style.previewSwatches),
                  child: const Text('Restore design’s original colors'),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () => context.go('/home'),
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text('Present this combination'),
                ),
              ],
            ),
            const TypographySettings(),
            const MotionSettings(),
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Motion follows your phone’s accessibility settings. Scroll reveals replay when cards return into view.',
                ),
                const SizedBox(height: 20),
                Text('Brightness', style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                if (preferences.style.isDarkOnly)
                  Text(
                    '${preferences.style.label} is a dark-only style.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  )
                else
                  SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                        value: ThemeMode.light,
                        label: Text('Light'),
                        icon: Icon(Icons.light_mode_outlined),
                      ),
                      ButtonSegment(
                        value: ThemeMode.dark,
                        label: Text('Dark'),
                        icon: Icon(Icons.dark_mode_outlined),
                      ),
                      ButtonSegment(
                        value: ThemeMode.system,
                        label: Text('System'),
                        icon: Icon(Icons.phone_iphone),
                      ),
                    ],
                    selected: {preferences.mode},
                    onSelectionChanged: (selection) => ref
                        .read(themeControllerProvider.notifier)
                        .setMode(selection.first),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StyleCard extends StatelessWidget {
  const _StyleCard({
    required this.style,
    required this.selected,
    required this.onTap,
  });

  final AppThemeStyle style;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? theme.colorScheme.primary
                  : Colors.grey.withValues(alpha: 0.2),
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              _LayoutPreview(style: style),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      style.label,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      style.description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                Icon(Icons.check_circle, color: theme.colorScheme.primary)
              else
                Icon(
                  Icons.radio_button_unchecked,
                  color: Colors.grey.withValues(alpha: 0.4),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<Color?> _editColor(BuildContext context, Color initial) async {
  var selected = initial;
  return showDialog<Color>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Choose a color'),
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        content: SizedBox(
          width: 330,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Drag in the color area, then move the rainbow slider to choose a hue.',
                ),
                const SizedBox(height: 16),
                ColorPicker(
                  pickerColor: selected,
                  onColorChanged: (color) => setState(() => selected = color),
                  portraitOnly: true,
                  colorPickerWidth: (MediaQuery.sizeOf(context).width - 80)
                      .clamp(200, 300)
                      .toDouble(),
                  enableAlpha: false,
                  displayThumbColor: true,
                  labelTypes: const [],
                  hexInputBar: true,
                  pickerAreaHeightPercent: .7,
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final color in [
                      Colors.white,
                      const Color(0xFF151821),
                      ...palettePresets.values.map((p) => p.first),
                      ...palettePresets.values.map((p) => p.last),
                    ])
                      Semantics(
                        label:
                            'Color ${color.toARGB32().toRadixString(16).substring(2)}',
                        button: true,
                        child: InkWell(
                          onTap: () => setState(() => selected = color),
                          customBorder: const CircleBorder(),
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Theme.of(
                                  context,
                                ).colorScheme.outlineVariant,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, selected),
            child: const Text('Apply color'),
          ),
        ],
      ),
    ),
  );
}

class _LayoutPreview extends StatelessWidget {
  const _LayoutPreview({required this.style});
  final AppThemeStyle style;
  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    final rects = switch (style) {
      AppThemeStyle.gabla => const [
        Rect.fromLTWH(4, 12, 27, 23),
        Rect.fromLTWH(35, 12, 27, 23),
        Rect.fromLTWH(4, 39, 27, 23),
        Rect.fromLTWH(35, 39, 27, 23),
      ],
      AppThemeStyle.editorial => const [
        Rect.fromLTWH(4, 4, 27, 37),
        Rect.fromLTWH(35, 14, 27, 23),
        Rect.fromLTWH(4, 45, 27, 21),
        Rect.fromLTWH(35, 41, 27, 29),
      ],
      AppThemeStyle.discover => const [
        Rect.fromLTWH(18, 12, 45, 50),
        Rect.fromLTWH(11, 8, 45, 50),
        Rect.fromLTWH(4, 4, 45, 50),
      ],
      AppThemeStyle.cinematic => const [
        Rect.fromLTWH(4, 4, 58, 30),
        Rect.fromLTWH(4, 38, 58, 12),
        Rect.fromLTWH(4, 54, 58, 12),
      ],
      AppThemeStyle.orbit => const [
        Rect.fromLTWH(23, 23, 22, 22),
        Rect.fromLTWH(25, 0, 18, 18),
        Rect.fromLTWH(0, 25, 18, 18),
        Rect.fromLTWH(48, 25, 18, 18),
        Rect.fromLTWH(25, 48, 18, 18),
      ],
    };
    return SizedBox(
      width: 66,
      height: 74,
      child: Stack(
        children: [
          for (var i = 0; i < rects.length; i++)
            Positioned.fromRect(
              rect: rects[i],
              child: Container(
                decoration: BoxDecoration(
                  color: ink.withValues(alpha: .12 + i * .08),
                  borderRadius: BorderRadius.circular(
                    style == AppThemeStyle.orbit ? 30 : 4,
                  ),
                  border: Border.all(color: ink.withValues(alpha: .2)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PaletteCard extends StatelessWidget {
  const _PaletteCard({
    required this.name,
    required this.colors,
    required this.selected,
    required this.onTap,
  });
  final String name;
  final List<Color> colors;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    button: true,
    child: Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 52,
                  child: Row(
                    children: [
                      for (var i = 0; i < 3; i++)
                        Expanded(
                          flex: i == 0 ? 3 : 2,
                          child: ColoredBox(
                            color: colors[i],
                            child: const SizedBox.expand(),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  if (selected)
                    const Icon(Icons.check_circle, size: 20)
                  else
                    const Icon(Icons.radio_button_unchecked, size: 20),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
