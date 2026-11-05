import '../../ride/domain/ride_location.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../../ride/application/ride_providers.dart';
import '../data/nearby_repository.dart';
import '../domain/nearby_result.dart';

final nearbyRepositoryProvider = Provider(
  (ref) => NearbyRepository(ref.watch(apiClientProvider)),
);

class NearbyState {
  const NearbyState({
    this.query = '',
    this.type,
    this.origin = NearbyOrigin.kampala,
    this.result = const AsyncData(NearbyResponse()),
    this.selectedId,
    this.locating = false,
    this.notice,
  });
  final String query;
  final String? type;
  final NearbyOrigin origin;
  final AsyncValue<NearbyResponse> result;
  final String? selectedId, notice;
  final bool locating;
  List<NearbyItem> get items => result.valueOrNull?.items ?? [];
  NearbyState copyWith({
    String? query,
    String? type,
    bool clearType = false,
    NearbyOrigin? origin,
    AsyncValue<NearbyResponse>? result,
    String? selectedId,
    bool clearSelected = false,
    bool? locating,
    String? notice,
    bool clearNotice = false,
  }) => NearbyState(
    query: query ?? this.query,
    type: clearType ? null : type ?? this.type,
    origin: origin ?? this.origin,
    result: result ?? this.result,
    selectedId: clearSelected ? null : selectedId ?? this.selectedId,
    locating: locating ?? this.locating,
    notice: clearNotice ? null : notice ?? this.notice,
  );
}

class NearbyController extends AutoDisposeNotifier<NearbyState> {
  Timer? _debounce;
  int _generation = 0;
  bool _alive = true;
  @override
  NearbyState build() {
    _alive = true;
    ref.onDispose(() {
      _alive = false;
      _debounce?.cancel();
      _generation++;
    });
    final district = ref
        .read(sessionControllerProvider)
        .valueOrNull
        ?.user
        .district;
    return NearbyState(
      origin: district != null && district.isNotEmpty
          ? NearbyOrigin(label: 'Around $district', district: district)
          : NearbyOrigin.kampala,
    );
  }

  void setQuery(String query) {
    _debounce?.cancel();
    _generation++;
    state = state.copyWith(
      query: query,
      result: query.trim().length >= 2
          ? const AsyncLoading()
          : const AsyncData(NearbyResponse()),
      clearSelected: true,
    );
    if (query.trim().length >= 2) {
      _debounce = Timer(const Duration(milliseconds: 380), search);
    }
  }

  void setType(String? type) {
    state = state.copyWith(type: type, clearType: type == null);
    search();
  }

  void select(String id) {
    if (state.items.any((item) => item.id == id)) {
      state = state.copyWith(selectedId: id);
    }
  }

  Future<void> search() async {
    _debounce?.cancel();
    final request = ++_generation;
    if (state.query.trim().length < 2) return;
    final query = state.query;
    final origin = state.origin;
    final type = state.type;
    state = state.copyWith(result: const AsyncLoading(), clearSelected: true);
    try {
      final response = await ref
          .read(nearbyRepositoryProvider)
          .search(query: query, origin: origin, type: type);
      if (!_alive || request != _generation) return;
      state = state.copyWith(
        result: AsyncData(response),
        selectedId: response.items.isEmpty ? null : response.items.first.id,
      );
    } catch (error, stack) {
      if (_alive && request == _generation) {
        state = state.copyWith(result: AsyncError(error, stack));
      }
    }
  }

  void searchArea(LatLng point) {
    state = state.copyWith(
      origin: NearbyOrigin(label: 'Selected map area', point: point),
      clearNotice: true,
    );
    search();
  }

  Future<void> useMyLocation() async {
    if (state.locating) return;
    state = state.copyWith(locating: true, clearNotice: true);
    try {
      final location = await ref
          .read(deviceLocationServiceProvider)
          .currentLocation()
          .timeout(const Duration(seconds: 15));
      if (!_alive) return;
      state = state.copyWith(
        origin: NearbyOrigin(
          label: 'Near your location',
          point: LatLng(location.lat, location.lng),
          isGps: true,
        ),
        locating: false,
      );
      await search();
    } catch (_) {
      if (_alive) {
        state = state.copyWith(
          locating: false,
          notice:
              'Location unavailable. ${state.origin.label} is still selected. You can move the map or choose a town.',
        );
      }
    }
  }

  Future<void> usePlace(RideLocation place) async {
    state = state.copyWith(
      origin: NearbyOrigin(
        label: 'Around ${place.address}',
        point: LatLng(place.lat, place.lng),
      ),
      clearNotice: true,
      locating: false,
    );
    await search();
  }

  Future<void> useTown(String town) async {
    if (town.trim().isEmpty || state.locating) return;
    state = state.copyWith(locating: true, clearNotice: true);
    try {
      final location = await ref
          .read(deviceLocationServiceProvider)
          .geocodeAddress(town.trim())
          .timeout(const Duration(seconds: 12));
      if (!_alive) return;
      state = state.copyWith(
        origin: NearbyOrigin(
          label: 'Around ${town.trim()}',
          point: LatLng(location.lat, location.lng),
        ),
        locating: false,
      );
      await search();
    } catch (_) {
      if (_alive) {
        state = state.copyWith(
          locating: false,
          notice:
              'Could not locate that town. Try another name or move the map.',
        );
      }
    }
  }
}

final nearbyControllerProvider =
    AutoDisposeNotifierProvider<NearbyController, NearbyState>(
      NearbyController.new,
    );
