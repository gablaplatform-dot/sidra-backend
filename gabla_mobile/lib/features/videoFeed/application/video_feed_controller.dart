import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/video_ad_repository.dart';
import '../domain/video_ad.dart';

final videoAdRepositoryProvider = Provider<VideoAdRepository>(
  (ref) => VideoAdRepository(ref.watch(apiClientProvider)),
);

class VideoFeedState {
  const VideoFeedState({
    this.items = const [],
    this.q = '',
    this.categoryId,
    this.categoryName,
    this.page = 1,
    this.hasMore = true,
    this.isLoading = true,
    this.isLoadingMore = false,
    this.error,
  });

  final List<VideoAd> items;
  final String q;
  final String? categoryId;
  final String? categoryName;
  final int page;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
}

/// Drives the vertical video feed: one page of results at a time, re-queried from scratch
/// whenever the search text or category filter changes. State objects are always built
/// explicitly (never a generic copyWith) so a cleared filter - a real `null` - can never be
/// confused with "leave this field as it was".
class VideoFeedController extends StateNotifier<VideoFeedState> {
  VideoFeedController(this._repo) : super(const VideoFeedState()) {
    _reload();
  }

  final VideoAdRepository _repo;
  static const _pageSize = 8;
  int _requestId = 0;

  Future<void> _reload() async {
    final requestId = ++_requestId;
    state = VideoFeedState(
      q: state.q,
      categoryId: state.categoryId,
      categoryName: state.categoryName,
      isLoading: true,
    );
    try {
      final result = await _repo.fetchPage(q: state.q, categoryId: state.categoryId, page: 1, limit: _pageSize);
      if (requestId != _requestId) return;
      state = VideoFeedState(
        items: result.items,
        q: state.q,
        categoryId: state.categoryId,
        categoryName: state.categoryName,
        page: 1,
        hasMore: result.items.length >= _pageSize,
        isLoading: false,
      );
    } catch (_) {
      if (requestId != _requestId) return;
      state = VideoFeedState(
        q: state.q,
        categoryId: state.categoryId,
        categoryName: state.categoryName,
        isLoading: false,
        error: 'Could not load videos. Pull down to retry.',
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore || state.isLoading) return;
    final requestId = _requestId;
    state = VideoFeedState(
      items: state.items,
      q: state.q,
      categoryId: state.categoryId,
      categoryName: state.categoryName,
      page: state.page,
      hasMore: state.hasMore,
      isLoadingMore: true,
    );
    try {
      final nextPage = state.page + 1;
      final result = await _repo.fetchPage(
        q: state.q,
        categoryId: state.categoryId,
        page: nextPage,
        limit: _pageSize,
      );
      if (requestId != _requestId) return;
      state = VideoFeedState(
        items: [...state.items, ...result.items],
        q: state.q,
        categoryId: state.categoryId,
        categoryName: state.categoryName,
        page: nextPage,
        hasMore: result.items.length >= _pageSize,
      );
    } catch (_) {
      if (requestId != _requestId) return;
      state = VideoFeedState(
        items: state.items,
        q: state.q,
        categoryId: state.categoryId,
        categoryName: state.categoryName,
        page: state.page,
        hasMore: state.hasMore,
      );
    }
  }

  void search(String q) {
    if (q == state.q) return;
    state = VideoFeedState(q: q, categoryId: state.categoryId, categoryName: state.categoryName, isLoading: true);
    _reload();
  }

  void filterByCategory(String? categoryId, String? categoryName) {
    if (categoryId == state.categoryId) return;
    state = VideoFeedState(q: state.q, categoryId: categoryId, categoryName: categoryName, isLoading: true);
    _reload();
  }

  Future<void> refresh() => _reload();
}

final videoFeedControllerProvider =
    StateNotifierProvider.autoDispose<VideoFeedController, VideoFeedState>(
      (ref) => VideoFeedController(ref.watch(videoAdRepositoryProvider)),
    );
