import '../../../core/media/sound_video_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:visibility_detector/visibility_detector.dart';
import '../../../core/motion/artwork_hero.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import 'commerce_widgets.dart';

Future<void> openCommerceLink(BuildContext context, String? value) async {
  final uri = Uri.tryParse(value ?? '/shop/all');
  if (uri == null) return;
  if (uri.hasScheme) {
    if (['https', 'http'].contains(uri.scheme))
      await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else if (value != null &&
      RegExp(r'^/(shop|provider|services)(/|$)').hasMatch(value)) {
    context.push(value);
  } else {
    context.push('/shop/all');
  }
}

class ShopHero extends ConsumerStatefulWidget {
  const ShopHero({super.key, this.ads = const [], this.scrollOffset = 0});
  final List<dynamic> ads;
  final double scrollOffset;
  @override
  ConsumerState<ShopHero> createState() => _ShopHeroState();
}

class _ShopHeroState extends ConsumerState<ShopHero> {
  final _pages = PageController();
  int _page = 0;
  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    final scale = MediaQuery.textScalerOf(context).scale(1);
    final narrow = MediaQuery.sizeOf(context).width < 350;
    final height =
        (style == AppThemeStyle.cinematic
            ? 350.0
            : style == AppThemeStyle.editorial
            ? 340.0
            : 280.0) +
        (scale - 1) * 150;
    final ads = widget.ads.isEmpty ? [<String, dynamic>{}] : widget.ads;
    return Column(
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            controller: _pages,
            itemCount: ads.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final ad = Map<String, dynamic>.from(ads[i]);
              final title =
                  ad['title']?.toString() ??
                  switch (style) {
                    AppThemeStyle.editorial => 'The everyday\nedit.',
                    AppThemeStyle.discover => 'Find your\nfavourite.',
                    AppThemeStyle.cinematic => 'Good things.\nCloser to you.',
                    AppThemeStyle.orbit => 'Your kind\nof find.',
                    _ => 'Your next\ngood find.',
                  };
              final image = ad['imageUrl']?.toString();
              final artwork = image == null
                  ? Image.asset('assets/artwork/shop.png', fit: BoxFit.cover)
                  : CommerceImage(image);
              final media = ad['videoUrl'] != null
                  ? _AdVideo(
                      url: ad['videoUrl'].toString(),
                      active: i == _page,
                      poster: artwork,
                    )
                  : artwork;
              final text = Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ad.isEmpty ? 'THE GABLA SHOP' : 'FEATURED',
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                      color: style == AppThemeStyle.cinematic
                          ? Colors.white70
                          : c.primary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.of(context).display(
                      size: style == AppThemeStyle.editorial
                          ? (narrow ? 32 : 40)
                          : style == AppThemeStyle.cinematic
                          ? (narrow ? 30 : 36)
                          : (narrow ? 27 : 32),
                      color: style == AppThemeStyle.cinematic
                          ? Colors.white
                          : c.onSurface,
                    ),
                  ),
                  if (ad['subtitle'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 9),
                      child: Text(
                        ad['subtitle'].toString(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: style == AppThemeStyle.cinematic
                              ? Colors.white70
                              : c.onSurfaceVariant,
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => openCommerceLink(
                      context,
                      ad['ctaHref']?.toString() ?? '/shop/all',
                    ),
                    child: Text(
                      ad['ctaLabel']?.toString() ?? 'Shop now',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              );
              final shift = MediaQuery.disableAnimationsOf(context)
                  ? 0.0
                  : widget.scrollOffset.clamp(0, 400) * .10;
              final picture = Transform.translate(
                offset: Offset(0, shift),
                child: i == 0
                    ? ArtworkHero(tag: 'service-artwork-0', child: media)
                    : media,
              );
              return switch (style) {
                AppThemeStyle.cinematic => ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      picture,
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.black12, Color(0xEE10151D)],
                          ),
                        ),
                      ),
                      Positioned(left: 24, right: 24, bottom: 24, child: text),
                    ],
                  ),
                ),
                AppThemeStyle.editorial => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 7,
                      child: Row(
                        children: [
                          Expanded(flex: 7, child: text),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 3,
                            child: Transform.rotate(
                              angle: -.055,
                              child: Padding(
                                padding: const EdgeInsets.all(6),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(3),
                                  child: SizedBox.expand(child: picture),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Divider(color: c.outline),
                    Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      spacing: 18,
                      runSpacing: 4,
                      children: [
                        Text(
                          'CURATED FINDS',
                          style: TextStyle(
                            fontSize: 9,
                            letterSpacing: 2,
                            color: c.primary,
                          ),
                        ),
                        const Text('01 / SHOP', style: TextStyle(fontSize: 10)),
                      ],
                    ),
                  ],
                ),
                AppThemeStyle.orbit => Container(
                  decoration: BoxDecoration(
                    color: c.secondaryContainer,
                    borderRadius: BorderRadius.circular(34),
                  ),
                  child: Stack(
                    children: [
                      Positioned(
                        right: -50,
                        top: 35,
                        bottom: 15,
                        width: narrow ? 180 : 200,
                        child: ShaderMask(
                          blendMode: BlendMode.dstIn,
                          shaderCallback: (rect) => const LinearGradient(
                            colors: [Colors.transparent, Colors.black],
                            stops: [0, .5],
                          ).createShader(rect),
                          child: ClipOval(child: picture),
                        ),
                      ),
                      Positioned(
                        right: 22,
                        top: 16,
                        child: CircleAvatar(
                          radius: 20,
                          backgroundColor: c.primary,
                          child: Icon(Icons.north_east, color: c.onPrimary),
                        ),
                      ),
                      Positioned(
                        left: 22,
                        top: 25,
                        bottom: 20,
                        width: 190,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: text,
                        ),
                      ),
                    ],
                  ),
                ),
                AppThemeStyle.discover => Container(
                  decoration: BoxDecoration(
                    color: c.primaryContainer,
                    borderRadius: BorderRadius.circular(32),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 6,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(22, 24, 0, 20),
                          child: text,
                        ),
                      ),
                      Expanded(
                        flex: 4,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(8, 20, 14, 20),
                          child: Transform.rotate(
                            angle: .055,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(80),
                              child: SizedBox.expand(child: picture),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _ => Container(
                  decoration: BoxDecoration(
                    color: c.secondaryContainer,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 7,
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: text,
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: ClipRRect(
                          borderRadius: const BorderRadius.horizontal(
                            right: Radius.circular(22),
                          ),
                          child: SizedBox.expand(child: picture),
                        ),
                      ),
                    ],
                  ),
                ),
              };
            },
          ),
        ),
        if (ads.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < ads.length; i++)
                  IconButton(
                    tooltip: 'Show featured ${i + 1}',
                    visualDensity: VisualDensity.compact,
                    onPressed: () => MediaQuery.disableAnimationsOf(context)
                        ? _pages.jumpToPage(i)
                        : _pages.animateToPage(
                            i,
                            duration: const Duration(milliseconds: 450),
                            curve: Curves.easeOutCubic,
                          ),
                    icon: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: i == _page ? 24 : 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: i == _page ? c.primary : c.outlineVariant,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _AdVideo extends StatefulWidget {
  const _AdVideo({
    required this.url,
    required this.active,
    required this.poster,
  });
  final String url;
  final bool active;
  final Widget poster;
  @override
  State<_AdVideo> createState() => _AdVideoState();
}

class _AdVideoState extends State<_AdVideo> with WidgetsBindingObserver {
  VideoPlayerController? _video;
  bool _visible = false, _opened = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  Future<void> _init() async {
    final uri = Uri.tryParse(widget.url);
    if (uri == null || !['https', 'http'].contains(uri.scheme)) return;
    final video = VideoPlayerController.networkUrl(uri);
    _video = video;
    try {
      await video.initialize();
      if (!mounted) return;
      await video.setLooping(true);
      await video.setVolume(0);
      if (mounted) {
        setState(() {});
        _sync();
      }
    } catch (_) {}
  }

  void _sync() {
    if (!mounted || _video == null) return;
    final play =
        _visible &&
        !_opened &&
        widget.active &&
        !MediaQuery.disableAnimationsOf(context) &&
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused;
    if (play) {
      _video!.play();
    } else {
      _video!.pause();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _AdVideo old) {
    super.didUpdateWidget(old);
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => VisibilityDetector(
    key: ObjectKey(this),
    onVisibilityChanged: (info) {
      _visible = info.visibleFraction > .5;
      _sync();
    },
    child: GestureDetector(
      onTap: () async {
        _opened = true;
        await _video?.pause();
        if (!context.mounted) return;
        await openSoundVideo(context, widget.url);
        if (mounted) {
          _opened = false;
          _sync();
        }
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          _video?.value.isInitialized == true
              ? FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _video!.value.size.width,
                    height: _video!.value.size.height,
                    child: VideoPlayer(_video!),
                  ),
                )
              : widget.poster,
          const Positioned(
            right: 12,
            bottom: 12,
            child: IgnorePointer(
              child: Chip(
                avatar: Icon(Icons.volume_up, size: 16),
                label: Text('Tap for sound', style: TextStyle(fontSize: 10)),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
