import '../../../core/media/sound_video_screen.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../settings/application/theme_controller.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:flutter/material.dart';
import '../../../core/motion/artwork_hero.dart';
import 'commerce_widgets.dart';

class ProductGallery extends ConsumerStatefulWidget {
  const ProductGallery({
    super.key,
    required this.images,
    this.heroTag,
    this.radius = 24,
    this.fraction = 1,
  });
  final List<String> images;
  final Object? heroTag;
  final double radius, fraction;
  @override
  ConsumerState<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends ConsumerState<ProductGallery>
    with WidgetsBindingObserver {
  late final _pages = PageController(viewportFraction: widget.fraction);
  int _index = 0;
  Timer? _timer;
  bool _visible = false, _zoom = false;
  DateTime _resumeAt = DateTime.fromMillisecondsSinceEpoch(0);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _go(int i) {
    if (!_pages.hasClients) return;
    _resumeAt = DateTime.now().add(const Duration(seconds: 7));
    if (MediaQuery.disableAnimationsOf(context)) {
      _pages.jumpToPage(i);
    } else {
      _pages.animateToPage(
        i,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _configureTimer();
  }

  @override
  void didUpdateWidget(covariant ProductGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.images.length != widget.images.length) _configureTimer();
  }

  void _configureTimer() {
    _timer?.cancel();
    if (!MediaQuery.disableAnimationsOf(context) && widget.images.length > 1) {
      final seconds = ref.read(themeControllerProvider).productImageSeconds;
      _timer = Timer.periodic(
        Duration(milliseconds: (seconds * 1000).round()),
        (_) {
          if (!mounted ||
              !_visible ||
              _zoom ||
              DateTime.now().isBefore(_resumeAt) ||
              !_pages.hasClients ||
              !TickerMode.of(context) ||
              WidgetsBinding.instance.lifecycleState ==
                  AppLifecycleState.paused ||
              WidgetsBinding.instance.lifecycleState ==
                  AppLifecycleState.inactive)
            return;
          _pages.animateToPage(
            (_index + 1) % widget.images.length,
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeInOutCubic,
          );
        },
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<double>(
      themeControllerProvider.select((p) => p.productImageSeconds),
      (_, __) => _configureTimer(),
    );
    final images = widget.images.isEmpty ? <String?>[null] : widget.images;
    return VisibilityDetector(
      key: ObjectKey(this),
      onVisibilityChanged: (info) => _visible = info.visibleFraction > .5,
      child: Listener(
        onPointerDown: (_) =>
            _resumeAt = DateTime.now().add(const Duration(seconds: 7)),
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pages,
                itemCount: images.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) {
                  final video = images[i] != null && isVideoUrl(images[i]!);
                  Widget image = video
                      ? const ColoredBox(
                          color: Color(0xff172c35),
                          child: Center(
                            child: Icon(
                              Icons.play_circle_outline,
                              size: 64,
                              color: Colors.white,
                            ),
                          ),
                        )
                      : CommerceImage(images[i]);
                  if (i == 0 && widget.heroTag != null)
                    image = ArtworkHero(tag: widget.heroTag!, child: image);
                  return Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: widget.fraction < 1 ? 5 : 0,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(widget.radius),
                      child: GestureDetector(
                        onTap: images[i] == null
                            ? null
                            : () async {
                                _zoom = true;
                                if (video) {
                                  await openSoundVideo(context, images[i]!);
                                  if (mounted) _zoom = false;
                                  return;
                                }
                                await Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => _GalleryZoom(
                                      images: widget.images,
                                      index: i,
                                    ),
                                  ),
                                );
                                if (mounted) _zoom = false;
                              },
                        child: SizedBox.expand(child: image),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (images.length > 1)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Wrap(
                  alignment: WrapAlignment.center,
                  runSpacing: 5,
                  children: [
                    for (
                      var i = 0;
                      i < images.length && images.length <= 8;
                      i++
                    )
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: GestureDetector(
                          onTap: () => MediaQuery.disableAnimationsOf(context)
                              ? _pages.jumpToPage(i)
                              : _pages.animateToPage(
                                  i,
                                  duration: const Duration(milliseconds: 350),
                                  curve: Curves.easeOutCubic,
                                ),
                          child: AnimatedContainer(
                            duration: MediaQuery.disableAnimationsOf(context)
                                ? Duration.zero
                                : const Duration(milliseconds: 220),
                            width: _index == i ? 22 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: _index == i
                                  ? Theme.of(context).colorScheme.primary
                                  : Theme.of(
                                      context,
                                    ).colorScheme.outlineVariant,
                              borderRadius: BorderRadius.circular(5),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(width: 10),
                    Text(
                      '${_index + 1}/${images.length}',
                      style: const TextStyle(fontSize: 10),
                    ),
                  ],
                ),
              ),
            if (widget.images.length > 1)
              SizedBox(
                height: 54,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: widget.images.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) => GestureDetector(
                    onTap: () => _go(i),
                    child: Container(
                      width: 54,
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: i == _index
                              ? Theme.of(context).colorScheme.primary
                              : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(7),
                        child: isVideoUrl(widget.images[i])
                            ? const Icon(Icons.play_circle_outline)
                            : CommerceImage(widget.images[i]),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _GalleryZoom extends StatefulWidget {
  const _GalleryZoom({required this.images, required this.index});
  final List<String> images;
  final int index;
  @override
  State<_GalleryZoom> createState() => _GalleryZoomState();
}

class _GalleryZoomState extends State<_GalleryZoom> {
  late final _pages = PageController(initialPage: widget.index);
  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    appBar: AppBar(
      backgroundColor: Colors.black,
      foregroundColor: Colors.white,
      title: const Text('Photos · pinch to zoom'),
    ),
    body: PageView(
      controller: _pages,
      children: [
        for (final image in widget.images)
          if (isVideoUrl(image))
            Center(
              child: FilledButton.icon(
                onPressed: () => openSoundVideo(context, image),
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('Play video with sound'),
              ),
            )
          else
            InteractiveViewer(
              minScale: 1,
              maxScale: 5,
              child: Center(child: CommerceImage(image, fit: BoxFit.contain)),
            ),
      ],
    ),
  );
}
