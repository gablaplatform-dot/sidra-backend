import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/booking.dart';
import 'service_providers.dart';

class BookingSubmission {
  const BookingSubmission({
    required this.listingId,
    required this.startDate,
    this.endDate,
    this.startTime,
    this.hours,
    required this.quantity,
    required this.guests,
    required this.name,
    required this.phone,
    this.email,
    this.notes,
  });

  final String listingId;
  final DateTime startDate;
  final DateTime? endDate;
  final String? startTime;
  final int? hours;
  final int quantity;
  final int guests;
  final String name;
  final String phone;
  final String? email;
  final String? notes;
}

/// Drives submitting a single booking request. `state.value` holds the
/// created booking once the API confirms it, which `BookingScreen` swaps in
/// for a confirmation view.
class BookingFlowController extends AutoDisposeNotifier<AsyncValue<Booking?>> {
  bool _alive = true;
  @override
  AsyncValue<Booking?> build() {
    _alive = true;
    ref.onDispose(() => _alive = false);
    return const AsyncData(null);
  }

  Future<void> submit(BookingSubmission input) async {
    state = const AsyncLoading();
    try {
      final booking = await ref
          .read(bookingRepositoryProvider)
          .create(
            listingId: input.listingId,
            startDate: input.startDate,
            endDate: input.endDate,
            startTime: input.startTime,
            hours: input.hours,
            quantity: input.quantity,
            guests: input.guests,
            name: input.name,
            phone: input.phone,
            email: input.email,
            notes: input.notes,
          );
      if (_alive) {
        state = AsyncData(booking);
        ref.invalidate(myBookingsProvider);
      }
    } catch (error, stackTrace) {
      if (_alive) state = AsyncError(error, stackTrace);
    }
  }

  void reset() => state = const AsyncData(null);
}

final bookingFlowControllerProvider =
    AutoDisposeNotifierProvider<BookingFlowController, AsyncValue<Booking?>>(
      BookingFlowController.new,
    );
