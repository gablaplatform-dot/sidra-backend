import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/font_group.dart';
import '../application/theme_controller.dart';

class TypographySettings extends ConsumerWidget {
  const TypographySettings({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(themeControllerProvider);
    final c = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Heading and body fonts',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Heading and body font pairings. Change typography without changing your design or colors. All fonts work offline.',
        ),
        const SizedBox(height: 20),
        for (final group in FontGroup.values)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Semantics(
              selected: preferences.fontGroup == group,
              button: true,
              child: Material(
                color: c.surfaceContainerLow,
                borderRadius: BorderRadius.circular(22),
                child: InkWell(
                  onTap: () => ref
                      .read(themeControllerProvider.notifier)
                      .setFontGroup(group),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: preferences.fontGroup == group
                            ? c.primary
                            : c.outlineVariant,
                        width: preferences.fontGroup == group ? 2 : 1,
                      ),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                group.label,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Icon(
                              preferences.fontGroup == group
                                  ? Icons.check_circle
                                  : Icons.radio_button_unchecked,
                              color: c.primary,
                              size: 20,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Find something\nclose to home.',
                          style: AppTypography(
                            heading: group.heading(preferences.style),
                            body: group.body,
                          ).display(size: 29, color: c.onSurface),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Browse local businesses, services and places to stay.',
                          style: TextStyle(
                            fontFamily: group.body,
                            fontSize: 13,
                            height: 1.5,
                            color: c.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '${group.heading(preferences.style)} + ${group.body}',
                          style: TextStyle(fontSize: 10, color: c.primary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
