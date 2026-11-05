import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/motion/motion_background.dart';
import '../application/theme_controller.dart';
import '../domain/background_motion.dart';

class MotionSettings extends ConsumerWidget {
  const MotionSettings({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(themeControllerProvider);
    final colors = Theme.of(context).colorScheme;
    final enabled = preferences.motion != BackgroundMotion.none;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.photo_library_outlined),
                const SizedBox(height: 12),
                Text(
                  'Product image auto-scroll',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Choose how often product images advance. Applies to all five designs.',
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    IconButton.outlined(
                      tooltip: 'Show images more often',
                      onPressed: preferences.productImageSeconds <= 1
                          ? null
                          : () => ref
                                .read(themeControllerProvider.notifier)
                                .setProductImageSeconds(
                                  preferences.productImageSeconds - .5,
                                ),
                      icon: const Icon(Icons.remove),
                    ),
                    Expanded(
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          '${preferences.productImageSeconds.toStringAsFixed(1)} seconds',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ),
                    IconButton.outlined(
                      tooltip: 'Show images less often',
                      onPressed: preferences.productImageSeconds >= 10
                          ? null
                          : () => ref
                                .read(themeControllerProvider.notifier)
                                .setProductImageSeconds(
                                  preferences.productImageSeconds + .5,
                                ),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                Slider(
                  key: const Key('product-image-interval'),
                  value: preferences.productImageSeconds,
                  min: 1,
                  max: 10,
                  divisions: 18,
                  label:
                      '${preferences.productImageSeconds.toStringAsFixed(1)} seconds',
                  semanticFormatterCallback: (value) =>
                      '${value.toStringAsFixed(1)} seconds between images',
                  onChanged: ref
                      .read(themeControllerProvider.notifier)
                      .setProductImageSeconds,
                ),
                const Text(
                  '1–10 seconds · Default 1.5 seconds',
                  style: TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 8),
                Text(
                  'Pauses while you interact. Auto-scroll stays off when reduced motion is enabled.',
                  style: TextStyle(
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 28),
        Text(
          'Background animation',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Choose a still background or a subtle animation. Motion uses your palette and sits behind the content.',
        ),
        const SizedBox(height: 20),
        for (final motion in BackgroundMotion.values)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Semantics(
              selected: preferences.motion == motion,
              button: true,
              child: Material(
                color: colors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(22),
                child: InkWell(
                  key: ValueKey('motion-${motion.name}'),
                  borderRadius: BorderRadius.circular(22),
                  onTap: () => ref
                      .read(themeControllerProvider.notifier)
                      .setMotion(motion),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        width: preferences.motion == motion ? 2 : 1,
                        color: preferences.motion == motion
                            ? colors.primary
                            : colors.outlineVariant,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: SizedBox(
                            height: 92,
                            child: TickerMode(
                              enabled: preferences.motion == motion,
                              child: MotionCanvas(
                                mode: motion,
                                colors: preferences.colors,
                                background: colors.surface,
                                intensity: preferences.motionIntensity,
                                speed: preferences.motionSpeed,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                motion.label,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Icon(
                              preferences.motion == motion
                                  ? Icons.check_circle
                                  : Icons.radio_button_unchecked,
                              color: colors.primary,
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          motion.description,
                          style: TextStyle(
                            color: colors.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (!enabled)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'Choose an animated background to adjust intensity and speed.',
            ),
          ),
        Text(
          'Animation intensity',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Slider(
          value: preferences.motionIntensity,
          min: .15,
          max: 1,
          divisions: 17,
          label: '${(preferences.motionIntensity * 100).round()}%',
          onChanged: enabled
              ? ref.read(themeControllerProvider.notifier).setMotionIntensity
              : null,
        ),
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text('Subtle'), Text('Expressive')],
        ),
        const SizedBox(height: 20),
        Text('Animation speed', style: Theme.of(context).textTheme.titleMedium),
        Slider(
          value: preferences.motionSpeed,
          min: .5,
          max: 1.5,
          divisions: 10,
          label: '${preferences.motionSpeed.toStringAsFixed(1)}×',
          onChanged: enabled
              ? ref.read(themeControllerProvider.notifier).setMotionSpeed
              : null,
        ),
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text('Slow'), Text('Lively')],
        ),
        const SizedBox(height: 20),
        if (MediaQuery.disableAnimationsOf(context))
          const Text(
            'Your phone’s reduced-motion setting is on. Backgrounds stay still.',
          ),
        const SizedBox(height: 16),
      ],
    );
  }
}
