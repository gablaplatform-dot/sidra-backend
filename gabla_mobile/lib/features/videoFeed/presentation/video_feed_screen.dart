import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/video_feed_controller.dart';
import 'widgets/category_filter_sheet.dart';
import 'widgets/video_feed_item.dart';

/// The "Tap for videos" destination from the Services tab: a full-screen, vertically-paged feed
/// of provider video ads (`GET /promotions/ads/videos`), with a search field and a category
/// filter floating over the top - everything else (sound, captions, tap to play/pause) lives in
/// each page's own VideoFeedItem.
class VideoFeedScreen extends ConsumerStatefulWidget {
  const VideoFeedScreen({super.key});

  @override
  ConsumerState<VideoFeedScreen> createState() => _VideoFeedScreenState();
}

class _VideoFeedScreenState extends ConsumerState<VideoFeedScreen> {
  final _pageController = PageController();
  final _searchController = TextEditingController();
  Timer? _debounce;
  int _activeIndex = 0;
  bool _searchOpen = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _pageController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(videoFeedControllerProvider.notifier).search(value);
    });
  }

  void _onPageChanged(int index, int itemCount, bool hasMore) {
    setState(() => _activeIndex = index);
    if (hasMore && index >= itemCount - 2) {
      ref.read(videoFeedControllerProvider.notifier).loadMore();
    }
  }

  Future<void> _openCategoryFilter(String? currentCategoryId) async {
    await showVideoCategoryFilterSheet(
      context: context,
      selectedCategoryId: currentCategoryId,
      onSelected: (id, name) {
        ref.read(videoFeedControllerProvider.notifier).filterByCategory(id, name);
        _pageController.jumpToPage(0);
        setState(() => _activeIndex = 0);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(videoFeedControllerProvider);
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          if (state.isLoading)
            const Center(child: CircularProgressIndicator(color: Colors.white))
          else if (state.error != null)
            _ErrorState(
              message: state.error!,
              onRetry: () => ref.read(videoFeedControllerProvider.notifier).refresh(),
            )
          else if (state.items.isEmpty)
            _EmptyState(filtered: state.q.isNotEmpty || state.categoryId != null)
          else
            PageView.builder(
              controller: _pageController,
              scrollDirection: Axis.vertical,
              itemCount: state.items.length,
              onPageChanged: (i) => _onPageChanged(i, state.items.length, state.hasMore),
              itemBuilder: (context, i) => VideoFeedItem(
                ad: state.items[i],
                active: i == _activeIndex,
              ),
            ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                children: [
                  _RoundBarButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _searchOpen
                        ? _SearchField(
                            controller: _searchController,
                            onChanged: _onSearchChanged,
                            onClose: () {
                              _searchController.clear();
                              _onSearchChanged('');
                              setState(() => _searchOpen = false);
                            },
                          )
                        : const SizedBox.shrink(),
                  ),
                  if (!_searchOpen) const Spacer(),
                  if (!_searchOpen)
                    _RoundBarButton(
                      icon: Icons.search_rounded,
                      onTap: () => setState(() => _searchOpen = true),
                    ),
                  const SizedBox(width: 10),
                  _RoundBarButton(
                    icon: Icons.filter_list_rounded,
                    onTap: () => _openCategoryFilter(state.categoryId),
                    badge: state.categoryId != null,
                  ),
                ],
              ),
            ),
          ),
          if (state.categoryName != null)
            Positioned(
              top: MediaQuery.paddingOf(context).top + 56,
              left: 12,
              child: _ActiveFilterChip(
                label: state.categoryName!,
                onClear: () =>
                    ref.read(videoFeedControllerProvider.notifier).filterByCategory(null, null),
              ),
            ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged, required this.onClose});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Container(
    height: 40,
    padding: const EdgeInsets.symmetric(horizontal: 14),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .16),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      children: [
        const Icon(Icons.search_rounded, color: Colors.white70, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: TextField(
            controller: controller,
            autofocus: true,
            onChanged: onChanged,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            cursorColor: Colors.white,
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              hintText: 'Search videos',
              hintStyle: TextStyle(color: Colors.white54),
            ),
          ),
        ),
        GestureDetector(
          onTap: onClose,
          child: const Icon(Icons.close_rounded, color: Colors.white70, size: 18),
        ),
      ],
    ),
  );
}

class _RoundBarButton extends StatelessWidget {
  const _RoundBarButton({required this.icon, required this.onTap, this.badge = false});
  final IconData icon;
  final VoidCallback onTap;
  final bool badge;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white.withValues(alpha: .16),
    shape: const CircleBorder(),
    child: InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(9),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(icon, color: Colors.white, size: 20),
            if (badge)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(color: Colors.orangeAccent, shape: BoxShape.circle),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({required this.label, required this.onClear});
  final String label;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white.withValues(alpha: .16),
    borderRadius: BorderRadius.circular(16),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onClear,
            child: const Icon(Icons.close_rounded, color: Colors.white70, size: 14),
          ),
        ],
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filtered});
  final bool filtered;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.video_library_outlined, color: Colors.white54, size: 40),
          const SizedBox(height: 12),
          Text(
            filtered
                ? 'No videos match this search or category yet.'
                : 'No provider videos yet - check back soon.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      ),
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white70)),
            child: const Text('Retry'),
          ),
        ],
      ),
    ),
  );
}
