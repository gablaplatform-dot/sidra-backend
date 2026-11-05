import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/ride_estimate.dart';
import '../domain/ride_location.dart';
import '../domain/ride_trip.dart';
import 'active_ride_store.dart';
import 'ride_providers.dart';

enum RideStage { setup, choosing, confirming, live }

const rideVehicleTypes = ['boda', 'car'];

const _unset = Object();

/// Everything the ride screen needs to render, held in one place so the
/// screen itself stays a plain, stateless view of this state.
class RideFlowState {
  const RideFlowState({
    this.stage = RideStage.setup,
    this.pickup,
    this.dropoff,
    this.vehicleType,
    this.estimates = const {},
    this.trip,
    this.loading = false,
    this.error,
  });

  final RideStage stage;
  final RideLocation? pickup;
  final RideLocation? dropoff;
  final String? vehicleType;
  final Map<String, RideEstimate> estimates;
  final RideTrip? trip;
  final bool loading;
  final String? error;

  RideFlowState copyWith({
    RideStage? stage,
    Object? pickup = _unset,
    Object? dropoff = _unset,
    Object? vehicleType = _unset,
    Map<String, RideEstimate>? estimates,
    Object? trip = _unset,
    bool? loading,
    Object? error = _unset,
  }) {
    return RideFlowState(
      stage: stage ?? this.stage,
      pickup: identical(pickup, _unset) ? this.pickup : pickup as RideLocation?,
      dropoff: identical(dropoff, _unset)
          ? this.dropoff
          : dropoff as RideLocation?,
      vehicleType: identical(vehicleType, _unset)
          ? this.vehicleType
          : vehicleType as String?,
      estimates: estimates ?? this.estimates,
      trip: identical(trip, _unset) ? this.trip : trip as RideTrip?,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as String?,
    );
  }
}

const _pollInterval = Duration(milliseconds: 4000);

/// Drives the whole ride flow: setup -> choosing a vehicle -> confirming the
/// matched driver -> live tracking. Mirrors the stage machine in
/// `public_app/src/pages/Ride.jsx`, including resuming an in-progress trip
/// from `ActiveRideStore` on first load.
class RideFlowController extends Notifier<RideFlowState> {
  Timer? _pollTimer;

  @override
  RideFlowState build() {
    ref.onDispose(() => _pollTimer?.cancel());
    _resumeActiveRide();
    return const RideFlowState();
  }

  ActiveRideStore get _activeRideStore => ActiveRideStore();

  Future<void> _resumeActiveRide() async {
    final tripId = await _activeRideStore.get();
    if (tripId == null) return;
    try {
      final trip = await ref.read(rideRepositoryProvider).fetchTrip(tripId);
      if (trip.isTerminal) {
        await _activeRideStore.clear();
        return;
      }
      if (trip.status == 'matched') {
        state = state.copyWith(
          stage: RideStage.confirming,
          trip: trip,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
        );
      } else {
        state = state.copyWith(
          stage: RideStage.live,
          trip: trip,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
        );
        _startPolling(tripId);
      }
    } catch (_) {
      await _activeRideStore.clear();
    }
  }

  void setPickup(RideLocation location) =>
      state = state.copyWith(pickup: location);

  void setDropoff(RideLocation location) =>
      state = state.copyWith(dropoff: location);

  Future<void> fetchEstimates() async {
    final pickup = state.pickup;
    final dropoff = state.dropoff;
    if (pickup == null || dropoff == null) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final repo = ref.read(rideRepositoryProvider);
      final estimates = <String, RideEstimate>{};
      for (final type in rideVehicleTypes) {
        estimates[type] = await repo.estimate(
          vehicleType: type,
          pickup: pickup,
          dropoff: dropoff,
        );
      }
      state = state.copyWith(
        stage: RideStage.choosing,
        estimates: estimates,
        vehicleType: estimates.keys.first,
        loading: false,
      );
    } catch (error) {
      state = state.copyWith(
        loading: false,
        error: 'Could not get a fare estimate. Please try again.',
      );
    }
  }

  void editRoute() =>
      state = state.copyWith(stage: RideStage.setup, error: null);

  void selectVehicle(String vehicleType) =>
      state = state.copyWith(vehicleType: vehicleType);

  Future<void> requestRide({
    required String paymentMethod,
    String? phone,
  }) async {
    final pickup = state.pickup;
    final dropoff = state.dropoff;
    final vehicleType = state.vehicleType;
    if (pickup == null || dropoff == null || vehicleType == null) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final trip = await ref
          .read(rideRepositoryProvider)
          .createTrip(
            vehicleType: vehicleType,
            pickup: pickup,
            dropoff: dropoff,
            paymentMethod: paymentMethod,
            phone: phone,
          );
      await _activeRideStore.set(trip.id);
      if (trip.status == 'no_drivers_found') {
        state = state.copyWith(
          stage: RideStage.live,
          trip: trip,
          loading: false,
        );
      } else {
        state = state.copyWith(
          stage: RideStage.confirming,
          trip: trip,
          loading: false,
        );
      }
    } catch (error) {
      state = state.copyWith(
        loading: false,
        error: 'Could not request a ride. Please try again.',
      );
    }
  }

  Future<void> confirm() async {
    final trip = state.trip;
    if (trip == null) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final updated = await ref
          .read(rideRepositoryProvider)
          .confirmTrip(trip.id);
      state = state.copyWith(
        stage: RideStage.live,
        trip: updated,
        pickup: updated.pickup ?? state.pickup,
        dropoff: updated.dropoff ?? state.dropoff,
        loading: false,
      );
      _startPolling(trip.id);
    } catch (error) {
      state = state.copyWith(
        loading: false,
        error: 'Could not confirm this ride. Please try again.',
      );
    }
  }

  Future<void> cancel() async {
    final trip = state.trip;
    if (trip == null) return;
    state = state.copyWith(loading: true, error: null);
    try {
      await ref.read(rideRepositoryProvider).cancelTrip(trip.id);
      _pollTimer?.cancel();
      await _activeRideStore.clear();
      state = const RideFlowState();
    } catch (_) {
      state = state.copyWith(
        loading: false,
        error: 'Could not cancel this ride. Please try again.',
      );
    }
  }

  void _startPolling(String tripId) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) async {
      try {
        final trip = await ref.read(rideRepositoryProvider).fetchTrip(tripId);
        if (state.trip?.id != tripId || state.stage != RideStage.live) return;
        state = state.copyWith(trip: trip);
        if (trip.isTerminal) {
          _pollTimer?.cancel();
          await _activeRideStore.clear();
        }
      } catch (_) {
        // A transient failure here shouldn't drop the rider out of the live
        // screen - the next tick just tries again, same as the web app
        // silently stopping rather than force-redirecting on a 401.
      }
    });
  }

  void reset() {
    _pollTimer?.cancel();
    state = const RideFlowState();
  }
}

final rideFlowControllerProvider =
    NotifierProvider<RideFlowController, RideFlowState>(RideFlowController.new);
