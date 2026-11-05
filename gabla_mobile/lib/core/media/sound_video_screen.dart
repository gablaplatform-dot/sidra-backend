import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

bool isVideoUrl(String url) => RegExp(
  r'\.(mp4|webm|mov|m4v|m3u8)(\?|$)',
  caseSensitive: false,
).hasMatch(url);
Future<void> openSoundVideo(BuildContext context, String url) => Navigator.of(
  context,
).push<void>(MaterialPageRoute(builder: (_) => SoundVideoScreen(url: url)));

class SoundVideoScreen extends StatefulWidget {
  const SoundVideoScreen({super.key, required this.url});
  final String url;
  @override
  State<SoundVideoScreen> createState() => _SoundVideoScreenState();
}

class _SoundVideoScreenState extends State<SoundVideoScreen>
    with WidgetsBindingObserver {
  VideoPlayerController? _video;
  String? _error;
  int _revision = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  Future<void> _load() async {
    final version = ++_revision;
    final old = _video;
    _video = null;
    await old?.dispose();
    if (!mounted || version != _revision) return;
    final uri = Uri.tryParse(widget.url);
    if (uri == null || !['https', 'http'].contains(uri.scheme)) {
      if (mounted) setState(() => _error = 'This video link is not available.');
      return;
    }
    final video = VideoPlayerController.networkUrl(uri);
    _video = video;
    try {
      await video.initialize();
      if (!mounted || version != _revision) return;
      await video.setVolume(1);
      await video.setLooping(false);
      await video.play();
      if (mounted) setState(() => _error = null);
    } catch (_) {
      if (mounted && version == _revision)
        setState(
          () => _error =
              'Could not load this video. Check your connection and retry.',
        );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _video?.pause();
  }

  @override
  void dispose() {
    _revision++;
    WidgetsBinding.instance.removeObserver(this);
    _video?.pause();
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) _video?.pause();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: const Text('Video'),
        ),
        body: SafeArea(
          child: _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(() => _error = null);
                            _load();
                          },
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : video?.value.isInitialized != true
              ? const Center(child: CircularProgressIndicator())
              : ValueListenableBuilder<VideoPlayerValue>(
                  valueListenable: video!,
                  builder: (context, value, _) => Column(
                    children: [
                      Expanded(
                        child: Center(
                          child: AspectRatio(
                            aspectRatio: value.aspectRatio,
                            child: GestureDetector(
                              onTap: () => value.isPlaying
                                  ? video.pause()
                                  : video.play(),
                              child: VideoPlayer(video),
                            ),
                          ),
                        ),
                      ),
                      VideoProgressIndicator(
                        video,
                        allowScrubbing: true,
                        padding: const EdgeInsets.all(18),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            color: Colors.white,
                            tooltip: value.isPlaying ? 'Pause' : 'Play',
                            onPressed: () {
                              if (value.position >= value.duration)
                                video.seekTo(Duration.zero);
                              value.isPlaying ? video.pause() : video.play();
                            },
                            icon: Icon(
                              value.isPlaying
                                  ? Icons.pause_circle
                                  : Icons.play_circle,
                              size: 38,
                            ),
                          ),
                          const SizedBox(width: 20),
                          Text(
                            '${_time(value.position)} / ${_time(value.duration)}',
                            style: const TextStyle(color: Colors.white),
                          ),
                          const SizedBox(width: 20),
                          IconButton(
                            color: Colors.white,
                            tooltip: value.volume > 0 ? 'Mute' : 'Enable sound',
                            onPressed: () =>
                                video.setVolume(value.volume > 0 ? 0 : 1),
                            icon: Icon(
                              value.volume > 0
                                  ? Icons.volume_up
                                  : Icons.volume_off,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  String _time(Duration d) =>
      '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}
