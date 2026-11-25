import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../../domain/video_ad.dart';

/// One full-bleed page of the vertical feed. Plays only while it is the active page, actually
/// visible on screen (not scrolled mid-transition) and the app is foregrounded - the same
/// visibility-gated pattern as the Shop hero's ad video (see shop_hero.dart's `_AdVideo`), except
/// this one plays with sound by default (a TikTok-style feed is watched with sound; the Shop
/// hero's ad loop is muted background motion) and shows a mute toggle instead.
class VideoFeedItem extends StatefulWidget {
  const VideoFeedItem({super.key, required this.ad, required this.active});

  final VideoAd ad;
  final bool active;

  @override
  State<VideoFeedItem> createState() => _VideoFeedItemState();
}

class _VideoFeedItemState extends State<VideoFeedItem> with WidgetsBindingObserver {
  VideoPlayerController? _video;
  bool _visible = false;
  bool _muted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  Future<void> _init() async {
    final uri = Uri.tryParse(widget.ad.videoUrl);
    if (uri == null || !['https', 'http'].contains(uri.scheme)) {
      if (mounted) setState(() => _error = 'This video is unavailable.');
      return;
    }
    final video = VideoPlayerController.networkUrl(uri);
    _video = video;
    try {
      await video.initialize();
      if (!mounted) return;
      await video.setLooping(true);
      await video.setVolume(_muted ? 0 : 1);
      setState(() {});
      _sync();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load this video.');
    }
  }

  void _sync() {
    final video = _video;
    if (!mounted || video == null || !video.value.isInitialized) return;
    final shouldPlay =
        _visible &&
        widget.active &&
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused;
    shouldPlay ? video.play() : video.pause();
  }

  @override
  void didUpdateWidget(covariant VideoFeedItem old) {
    super.didUpdateWidget(old);
    if (old.ad.id != widget.ad.id) {
      _error = null;
      final previous = _video;
      _video = null;
      previous?.pause();
      previous?.dispose();
      _init();
    } else {
      _sync();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) => _sync();

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _video?.dispose();
    super.dispose();
  }

  void _toggleMute() {
    setState(() => _muted = !_muted);
    _video?.setVolume(_muted ? 0 : 1);
  }

  Future<void> _openProvider(BuildContext context) async {
    final ad = widget.ad;
    if (ad.providerId != null) {
      context.push('/provider/${ad.providerId}');
      return;
    }
    final href = ad.ctaHref;
    if (href == null) return;
    final uri = Uri.tryParse(href);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    final ad = widget.ad;
    return VisibilityDetector(
      key: ValueKey('video-feed-${ad.id}'),
      onVisibilityChanged: (info) {
        _visible = info.visibleFraction > .6;
        _sync();
      },
      child: Container(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (video?.value.isInitialized == true)
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: video!.value.size.width,
                  height: video.value.size.height,
                  child: VideoPlayer(video),
                ),
              )
            else if (ad.imageUrl != null)
              Image.network(ad.imageUrl!, fit: BoxFit.cover)
            else if (_error == null)
              const Center(child: CircularProgressIndicator(color: Colors.white)),
            if (_error != null)
              Center(
                child: Text(_error!, style: const TextStyle(color: Colors.white)),
              ),
            // Tap anywhere to play/pause, like the real app.
            GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                final v = _video;
                if (v == null || !v.value.isInitialized) return;
                v.value.isPlaying ? v.pause() : v.play();
              },
            ),
            // Bottom caption: provider identity, title/subtitle, and a CTA into their profile.
            Positioned(
              left: 16,
              right: 72,
              bottom: 28,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (ad.providerName != null)
                    GestureDetector(
                      onTap: () => _openProvider(context),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: Colors.white24,
                            backgroundImage: ad.providerAvatarUrl != null
                                ? NetworkImage(ad.providerAvatarUrl!)
                                : null,
                            child: ad.providerAvatarUrl == null
                                ? Text(
                                    ad.providerName!.isNotEmpty ? ad.providerName![0] : 'G',
                                    style: const TextStyle(color: Colors.white),
                                  )
                                : null,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            ad.providerName!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    ad.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                    ),
                  ),
                  if (ad.subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      ad.subtitle!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                      ),
                    ),
                  ],
                  if (ad.providerId != null || ad.ctaHref != null) ...[
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () => _openProvider(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white70),
                        backgroundColor: Colors.white.withValues(alpha: .08),
                      ),
                      child: Text(ad.ctaLabel ?? 'View business'),
                    ),
                  ],
                ],
              ),
            ),
            // Mute toggle, mirroring TikTok's own corner placement.
            Positioned(
              right: 16,
              bottom: 28,
              child: _RoundIconButton(
                icon: _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                onTap: _toggleMute,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white24,
    shape: const CircleBorder(),
    child: InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    ),
  );
}
