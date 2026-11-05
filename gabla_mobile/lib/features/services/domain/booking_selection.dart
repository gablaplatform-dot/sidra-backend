import 'dart:math' as math;
import 'availability.dart';
import 'booking_config.dart';

String bookingDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
DateTime eatToday([DateTime? now]) {
  final d = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 3));
  return DateTime(d.year, d.month, d.day);
}

class BookingSelection {
  const BookingSelection({
    required this.endDate,
    required this.maxQuantity,
    required this.maxGuests,
    this.error,
  });
  final DateTime? endDate;
  final int maxQuantity, maxGuests;
  final String? error;
}

BookingSelection evaluateBooking({
  required BookingConfig config,
  required DateTime? start,
  required int units,
  required int quantity,
  required int guests,
  required Availability? availability,
  String? startTime,
  Availability? hourly,
  DateTime? now,
}) {
  int free = config.inventory ?? 1;
  DateTime? end;
  String? error;
  if (start == null) {
    error = 'Choose your starting date.';
  } else {
    final today = eatToday(now);
    if (start.isBefore(today) ||
        start.isAfter(
          today.add(Duration(days: (config.advanceDays ?? 365) - 1)),
        ))
      error = 'Choose a date within the booking window.';
    if (availability == null)
      error = 'Wait for availability to load, or retry.';
    if (units < (config.minUnits ?? 1) || units > (config.maxUnits ?? 30))
      error =
          'Choose between ${config.minUnits ?? 1} and ${config.maxUnits ?? 30} ${config.unit.name}s.';
    if (config.unit == BookingUnit.hour) {
      if (startTime == null || hourly == null) {
        error = 'Choose an available start time.';
      } else {
        final parts = startTime.split(':');
        final hour = int.tryParse(parts.first) ?? -1;
        for (var i = 0; i < units; i++) {
          final time = '${(hour + i).toString().padLeft(2, '0')}:00';
          final slots = hourly.slots.where((s) => s.time == time);
          if (slots.isEmpty) {
            free = 0;
          } else {
            free = math.min(free, slots.first.free);
          }
        }
        final at = DateTime.utc(start.year, start.month, start.day, hour - 3);
        if (at.difference((now ?? DateTime.now()).toUtc()).inMinutes <
                (config.leadTimeHours ?? 0) * 60 ||
            at.isBefore((now ?? DateTime.now()).toUtc()))
          error = 'That time is too soon. Choose a later slot.';
      }
    } else {
      end = start.add(
        Duration(days: config.unit == BookingUnit.day ? units - 1 : units),
      );
      for (var i = 0; i < units; i++) {
        free = math.min(
          free,
          availability?.days[bookingDate(start.add(Duration(days: i)))]?.free ??
              config.inventory ??
              1,
        );
      }
      if ((config.leadTimeHours ?? 0) >= 24) {
        final h =
            int.tryParse((config.checkIn ?? '14:00').split(':').first) ?? 14;
        if (DateTime.utc(
              start.year,
              start.month,
              start.day,
              h - 3,
            ).difference((now ?? DateTime.now()).toUtc()).inHours <
            config.leadTimeHours!)
          error =
              'The provider needs more advance notice. Choose a later date.';
      }
    }
  }
  if (free < 1)
    error = 'These dates or hours are fully booked. Try another selection.';
  if (quantity > free)
    error = 'Only $free rooms or spaces are available for this selection.';
  final capacity = (config.capacity ?? 2) * quantity;
  if (guests > capacity)
    error = 'Choose no more than $capacity guests for this quantity.';
  return BookingSelection(
    endDate: end,
    maxQuantity: math.max(0, free),
    maxGuests: capacity,
    error: error,
  );
}
