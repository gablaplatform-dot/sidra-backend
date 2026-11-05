/// One calendar day's availability for a bookable listing - how many units
/// are still free that day, and whether it's only partly booked (still
/// pickable) vs. fully booked (`free == 0`).
class DayAvailability {
  const DayAvailability({required this.free, required this.partlyBooked});

  factory DayAvailability.fromJson(Map<String, dynamic> json) =>
      DayAvailability(
        free: (json['free'] as num?)?.toInt() ?? 0,
        partlyBooked: json['partlyBooked'] as bool? ?? false,
      );

  final int free;
  final bool partlyBooked;

  bool get isAvailable => free > 0;
}

/// One bookable hour slot on a given day (`unit == hour` listings only).
class TimeSlot {
  const TimeSlot({required this.time, required this.free});

  factory TimeSlot.fromJson(Map<String, dynamic> json) => TimeSlot(
    time: json['time'] as String? ?? '',
    free: (json['free'] as num?)?.toInt() ?? 0,
  );

  final String time;
  final int free;

  bool get isAvailable => free > 0;
}

/// `GET /bookings/availability` - a month of day-level availability when
/// called with just `from`/`to`, or a single day's hour slots when a `date`
/// is also passed. See `public_app/src/lib/bookings.js: loadAvailability`.
class Availability {
  const Availability({this.days = const {}, this.slots = const []});

  factory Availability.fromJson(Map<String, dynamic> json) {
    final daysJson = json['days'] as Map<String, dynamic>? ?? const {};
    return Availability(
      days: daysJson.map(
        (key, value) => MapEntry(
          key,
          DayAvailability.fromJson(value as Map<String, dynamic>),
        ),
      ),
      slots:
          (json['slots'] as List?)
              ?.map((e) => TimeSlot.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  /// Keyed by `"YYYY-MM-DD"`.
  final Map<String, DayAvailability> days;
  final List<TimeSlot> slots;
}
