import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'bus_providers.dart';

class BusCheckoutState {
  const BusCheckoutState({
    this.phase = 'form',
    this.booking,
    this.error,
    this.restoring = true,
  });
  final String phase;
  final Map<String, dynamic>? booking;
  final String? error;
  final bool restoring;
}

/// A payment is never re-created when polling fails or a screen reopens.
/// Keep its ID in the waiting state, persist it and resume server lookup.
class BusCheckoutController extends FamilyNotifier<BusCheckoutState, String> {
  Timer? _timer;
  bool _polling = false, _alive = true;
  String get _key => 'gabla.bus.pending.$arg';
  @override
  BusCheckoutState build(String arg) {
    _alive = true;
    ref.onDispose(() {
      _alive = false;
      _timer?.cancel();
    });
    Future.microtask(_restore);
    return const BusCheckoutState();
  }

  Future<void> _restore() async {
    try {
      final id = (await SharedPreferences.getInstance()).getString(_key);
      if (!_alive) return;
      if (id == null) {
        state = const BusCheckoutState(restoring: false);
        return;
      }
      state = BusCheckoutState(
        phase: 'waiting',
        booking: {'id': id},
        restoring: false,
      );
      _startPolling();
      await refresh();
    } catch (_) {
      if (_alive)
        state = const BusCheckoutState(
          restoring: false,
          phase: 'restore_error',
          error:
              'Could not restore your payment. Retry before starting a new booking.',
        );
    }
  }

  Future<void> retryRestore() => _restore();
  Future<void> submit(Map<String, dynamic> body) async {
    if (state.restoring || state.phase != 'form') return;
    state = const BusCheckoutState(phase: 'submitting', restoring: false);
    try {
      final b = await ref.read(busRepositoryProvider).createBooking(body);
      if (!_alive) return;
      final id = '${b['bookingId']}';
      state = BusCheckoutState(
        phase: 'waiting',
        booking: {...b, 'id': id},
        restoring: false,
      );
      // A failed local save must not cause another payment initiation.
      try {
        await (await SharedPreferences.getInstance()).setString(_key, id);
      } catch (_) {}
      if (_alive) {
        _startPolling();
        await refresh();
      }
    } catch (e) {
      if (_alive)
        state = BusCheckoutState(phase: 'form', restoring: false, error: '$e');
    }
  }

  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => refresh());
  }

  Future<void> refresh() async {
    final id = state.booking?['id'];
    if (_polling || id == null || !_alive) return;
    _polling = true;
    try {
      final b = await ref.read(busRepositoryProvider).fetchBooking('$id');
      if (!_alive) return;
      final status = b['status'];
      final waiting = status == 'pending_payment' && b['expired'] != true;
      state = BusCheckoutState(
        phase: waiting
            ? 'waiting'
            : status == 'confirmed'
            ? 'confirmed'
            : 'failed',
        booking: b,
        restoring: false,
      );
      if (!waiting) {
        _timer?.cancel();
        ref.invalidate(myTicketsProvider);
        ref.invalidate(tripDetailProvider(arg));
        try {
          await (await SharedPreferences.getInstance()).remove(_key);
        } catch (_) {}
      }
    } catch (_) {
      if (_alive)
        state = BusCheckoutState(
          phase: 'waiting',
          booking: state.booking,
          restoring: false,
          error:
              'Connection interrupted. We are checking this payment; please do not pay again.',
        );
    } finally {
      _polling = false;
    }
  }

  void startAgain() {
    if (state.phase != 'failed') return;
    _timer?.cancel();
    state = const BusCheckoutState(restoring: false);
  }
}

final busCheckoutProvider =
    NotifierProvider.family<BusCheckoutController, BusCheckoutState, String>(
      BusCheckoutController.new,
    );
