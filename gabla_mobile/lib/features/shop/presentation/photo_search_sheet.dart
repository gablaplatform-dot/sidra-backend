import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../application/photo_search.dart';

class PhotoSearchSheet extends ConsumerStatefulWidget {
  const PhotoSearchSheet({super.key, this.initialPhoto});
  final Uint8List? initialPhoto;

  @override
  ConsumerState<PhotoSearchSheet> createState() => _PhotoSearchSheetState();
}

class _PhotoSearchSheetState extends ConsumerState<PhotoSearchSheet> {
  @override
  void initState() {
    super.initState();
    if (widget.initialPhoto != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref
              .read(photoSearchControllerProvider.notifier)
              .restore(widget.initialPhoto!);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(photoSearchControllerProvider);
    final controller = ref.read(photoSearchControllerProvider.notifier);
    final colors = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .86,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Search by photo',
                          style: text.headlineSmall,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close photo search',
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  Text(
                    'Take a clear photo of the item, or choose one from your gallery.',
                    style: text.bodyMedium,
                  ),
                  const SizedBox(height: 20),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Builder(
                      builder: (context) {
                        final preview = state.photo == null
                            ? ColoredBox(
                                color: colors.surfaceContainerHighest,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 28,
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.image_search_outlined,
                                        size: 42,
                                        color: colors.onSurfaceVariant,
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        'Photo preview',
                                        style: text.bodySmall,
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : AspectRatio(
                                aspectRatio: 4 / 3,
                                child: Image.memory(
                                  state.photo!,
                                  fit: BoxFit.contain,
                                  semanticLabel:
                                      'Photo selected for item search',
                                  gaplessPlayback: true,
                                ),
                              );
                        return MediaQuery.disableAnimationsOf(context)
                            ? preview
                            : AnimatedSize(
                                duration: const Duration(milliseconds: 220),
                                alignment: Alignment.topCenter,
                                child: preview,
                              );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: state.busy
                              ? null
                              : () => controller.pick(ImageSource.camera),
                          icon: const Icon(Icons.photo_camera_outlined),
                          label: const Text('Take photo'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: state.busy
                              ? null
                              : () => controller.pick(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Choose photo'),
                        ),
                      ),
                    ],
                  ),
                  if (state.error != null) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colors.errorContainer,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          state.error!,
                          style: text.bodyMedium?.copyWith(
                            color: colors.onErrorContainer,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border(top: BorderSide(color: colors.outlineVariant)),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                20 + MediaQuery.viewPaddingOf(context).bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FilledButton.icon(
                    onPressed: state.photo == null || state.busy
                        ? null
                        : () async {
                            final selection = await controller.search();
                            if (context.mounted && selection != null) {
                              Navigator.pop(context, selection);
                            }
                          },
                    icon: state.busy
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.search),
                    label: Text(
                      state.searching
                          ? 'Finding items…'
                          : state.picking
                          ? 'Opening photo…'
                          : 'Search for this item',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We’ll look for similar items available on Gabla.',
                    textAlign: TextAlign.center,
                    style: text.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
