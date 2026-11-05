/// The pricing unit a bookable listing is sold in. Drives which fields a
/// booking needs: `night`/`day` listings pick a date range, `hour` listings
/// pick a single day plus a start time and a duration.
enum BookingUnit { night, day, hour }

BookingUnit bookingUnitFromString(String? value) => switch (value) {
  'day' => BookingUnit.day,
  'hour' => BookingUnit.hour,
  _ => BookingUnit.night,
};

/// `listing.booking` on a bookable listing - mirrors the config object
/// documented in `public_app/src/components/booking/BookingPanel.jsx`.
class BookingConfig {
  const BookingConfig({
    required this.unit,
    this.advanceDays,
    this.minUnits,
    this.maxUnits,
    this.inventory,
    this.capacity,
    this.depositPercent,
    this.depositNote,
    this.leadTimeHours,
    this.cancellation,
    this.checkIn,
    this.checkOut,
    this.responseHours,
    this.payWithinHours,
  });

  factory BookingConfig.fromJson(Map<String, dynamic> json) => BookingConfig(
    unit: bookingUnitFromString(json['unit'] as String?),
    advanceDays: (json['advanceDays'] as num?)?.toInt(),
    minUnits: (json['minUnits'] as num?)?.toInt(),
    maxUnits: (json['maxUnits'] as num?)?.toInt(),
    inventory: (json['inventory'] as num?)?.toInt(),
    capacity: (json['capacity'] as num?)?.toInt(),
    depositPercent: (json['depositPercent'] as num?)?.toInt(),
    depositNote: json['depositNote'] as String?,
    leadTimeHours: (json['leadTimeHours'] as num?)?.toInt(),
    cancellation: json['cancellation'] as String?,
    checkIn: json['checkIn'] as String?,
    checkOut: json['checkOut'] as String?,
    responseHours: (json['responseHours'] as num?)?.toInt(),
    payWithinHours: (json['payWithinHours'] as num?)?.toInt(),
  );

  final BookingUnit unit;
  final int? advanceDays;
  final int? minUnits;
  final int? maxUnits;
  final int? inventory;
  final int? capacity;
  final int? depositPercent;
  final String? depositNote;
  final int? leadTimeHours;
  final String? cancellation;
  final String? checkIn;
  final String? checkOut;
  final int? responseHours;
  final int? payWithinHours;
}
