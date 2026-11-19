import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';

class PhotoSearchMatch {
  const PhotoSearchMatch({required this.query, required this.intent});
  final String query, intent;
}

class PhotoSearchSelection {
  const PhotoSearchSelection(this.match, this.photo);
  final PhotoSearchMatch match;
  final Uint8List photo;
}

class PhotoSearchService {
  PhotoSearchService(this.api, {ImagePicker? picker})
    : picker = picker ?? ImagePicker();
  final ApiClient api;
  final ImagePicker picker;
  static const _pendingKey = 'gabla_photo_search_picker_pending';

  Future<Uint8List?> pick(ImageSource source) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pendingKey, true);
    try {
      final file = await picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 82,
        requestFullMetadata: false,
      );
      return file == null ? null : _read(file);
    } finally {
      await prefs.remove(_pendingKey);
    }
  }

  // Only recover photos explicitly requested by this flow. Do not consume another
  // feature's lost upload after Android has killed the activity behind the picker.
  Future<Uint8List?> recover() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_pendingKey) != true) return null;
    await prefs.remove(_pendingKey);
    final result = await picker.retrieveLostData();
    if (result.exception != null) throw result.exception!;
    final files = result.files;
    if (files == null || files.isEmpty) return null;
    return _read(files.first);
  }

  Future<Uint8List> _read(XFile file) async {
    if (await file.length() > 25 * 1024 * 1024) {
      throw ApiException(message: 'Choose a photo smaller than 25 MB.');
    }
    return preparePhoto(await file.readAsBytes());
  }

  Future<PhotoSearchMatch> identify(Uint8List photo) async {
    final data = await api.searchByPhoto(photo);
    final query = (data['query'] as String? ?? '').trim();
    if (query.isEmpty) {
      throw ApiException(
        message: 'We couldn’t identify an item. Try a closer, clearer photo.',
        code: 'NO_ITEM_RECOGNIZED',
      );
    }
    return PhotoSearchMatch(
      query: query,
      intent: (data['intent'] as String? ?? '').trim(),
    );
  }

  // Convert every supported picker format into an actual PNG. Sending a filename's
  // MIME type alone would break on iPhone HEIC and oversized Android originals.
  @visibleForTesting
  static Future<Uint8List> preparePhoto(Uint8List bytes) async {
    if (bytes.isEmpty || bytes.length > 25 * 1024 * 1024) {
      throw ApiException(message: 'Choose a photo smaller than 25 MB.');
    }
    ui.ImmutableBuffer? buffer;
    ui.ImageDescriptor? descriptor;
    ui.Codec? codec;
    ui.Image? image;
    try {
      buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
      descriptor = await ui.ImageDescriptor.encoded(buffer);
      final scale = math.min(
        1.0,
        1024 / math.max(descriptor.width, descriptor.height),
      );
      codec = await descriptor.instantiateCodec(
        targetWidth: math.max(1, (descriptor.width * scale).round()),
        targetHeight: math.max(1, (descriptor.height * scale).round()),
      );
      image = (await codec.getNextFrame()).image;
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null || data.lengthInBytes > 5 * 1024 * 1024) {
        throw ApiException(message: 'Try a smaller photo of the item.');
      }
      return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        message: 'That photo couldn’t be opened. Try a JPG, PNG or WebP image.',
      );
    } finally {
      image?.dispose();
      codec?.dispose();
      descriptor?.dispose();
      buffer?.dispose();
    }
  }
}

final photoSearchServiceProvider = Provider<PhotoSearchService>(
  (ref) => PhotoSearchService(ref.watch(apiClientProvider)),
);

class PhotoSearchState {
  const PhotoSearchState({
    this.photo,
    this.picking = false,
    this.searching = false,
    this.error,
  });
  final Uint8List? photo;
  final bool picking, searching;
  final String? error;
  bool get busy => picking || searching;
}

class PhotoSearchController extends AutoDisposeNotifier<PhotoSearchState> {
  bool _alive = true;
  int _request = 0;

  @override
  PhotoSearchState build() {
    _alive = true;
    ref.onDispose(() {
      _alive = false;
      _request++;
    });
    return const PhotoSearchState();
  }

  void restore(Uint8List photo) => state = PhotoSearchState(photo: photo);

  Future<void> pick(ImageSource source) async {
    if (state.busy) return;
    final request = ++_request;
    final previous = state.photo;
    state = PhotoSearchState(photo: previous, picking: true);
    try {
      final photo = await ref.read(photoSearchServiceProvider).pick(source);
      if (_alive && request == _request) {
        state = PhotoSearchState(photo: photo ?? previous);
      }
    } catch (error) {
      if (_alive && request == _request) {
        state = PhotoSearchState(photo: previous, error: _message(error));
      }
    }
  }

  Future<PhotoSearchSelection?> search() async {
    final photo = state.photo;
    if (photo == null || state.busy) return null;
    final request = ++_request;
    state = PhotoSearchState(photo: photo, searching: true);
    try {
      final match = await ref.read(photoSearchServiceProvider).identify(photo);
      if (!_alive || request != _request) return null;
      state = PhotoSearchState(photo: photo);
      return PhotoSearchSelection(match, photo);
    } catch (error) {
      if (_alive && request == _request) {
        state = PhotoSearchState(photo: photo, error: _message(error));
      }
      return null;
    }
  }

  String _message(Object error) {
    if (error is ApiException) return error.message;
    if (error is PlatformException) {
      if (error.code.toLowerCase().contains('denied') ||
          error.code.toLowerCase().contains('restricted')) {
        return 'Allow camera or photo access in your phone settings, or choose the other option.';
      }
      return 'Couldn’t open the camera or gallery. Please try the other option.';
    }
    return 'Photo search couldn’t finish. Check your connection and try again.';
  }
}

final photoSearchControllerProvider =
    NotifierProvider.autoDispose<PhotoSearchController, PhotoSearchState>(
      PhotoSearchController.new,
    );
