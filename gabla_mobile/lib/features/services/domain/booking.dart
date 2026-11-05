import '../../../core/utils/parsing.dart';
import 'booking_config.dart';

enum BookingStatus {
  pending,
  confirmed,
  declined,
  cancelled,
  completed,
  expired,
}

BookingStatus bookingStatusFromString(String? value) => BookingStatus.values
    .firstWhere((s) => s.name == value, orElse: () => BookingStatus.pending);

class BookingListingRef {
  const BookingListingRef({
    required this.id,
    required this.name,
    this.imageUrl,
  });

  factory BookingListingRef.fromJson(Map<String, dynamic> json) =>
      BookingListingRef(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        imageUrl: json['imageUrl'] as String?,
      );

  final String id;
  final String name;
  final String? imageUrl;
}

/// Where/how to reach the provider once a booking is placed - shown on the
/// confirmation screen.
class BookingContact {
  const BookingContact({this.address, this.phone, this.mapsUrl});

  factory BookingContact.fromJson(Map<String, dynamic>? json) => BookingContact(
    address: json?['address'] as String?,
    phone: json?['phone'] as String?,
    mapsUrl: json?['mapsUrl'] as String?,
  );

  final String? address;
  final String? phone;
  final String? mapsUrl;
}

/// A booking against a bookable listing, both as returned by `POST
/// /bookings` (the just-created booking) and by `GET /bookings/mine` (each
/// list item, with the extra `can*`/payment fields below populated). Mirrors
/// `public_app/src/components/booking/*.jsx`.
class Booking {
  const Booking({
    required this.id,
    this.reference,
    required this.status,
    required this.unit,
    required this.startDate,
    this.endDate,
    this.startTime,
    this.endTime,
    this.units,
    required this.quantity,
    required this.guests,
    required this.total,
    this.providerName,
    this.listing,
    this.contact,
    this.paymentStatus,
    this.amountDue,
    this.amountPaid,
    this.canCancel = false,
    this.canPay = false,
    this.payBy,
    this.expiresAt,
    this.providerNote,
    this.depositNote,
    this.instructions,
    this.policyText,
  });

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
    id: json['id'] as String,
    reference: json['reference'] as String?,
    status: bookingStatusFromString(json['status'] as String?),
    unit: bookingUnitFromString(json['unit'] as String?),
    startDate: json['startDate'] as String? ?? '',
    endDate: json['endDate'] as String?,
    startTime: json['startTime'] as String?,
    endTime: json['endTime'] as String?,
    units: (json['units'] as num?)?.toInt(),
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    guests: (json['guests'] as num?)?.toInt() ?? 1,
    total: asDouble(json['total']),
    providerName: (json['provider'] as Map?)?['businessName'] as String?,
    listing: json['listing'] != null
        ? BookingListingRef.fromJson(json['listing'] as Map<String, dynamic>)
        : null,
    contact: json['contact'] != null
        ? BookingContact.fromJson(json['contact'] as Map<String, dynamic>)
        : null,
    paymentStatus: json['paymentStatus'] as String?,
    amountDue: asNum(json['amountDue'])?.toDouble(),
    amountPaid: asNum(json['amountPaid'])?.toDouble(),
    canCancel: json['canCancel'] as bool? ?? false,
    canPay: json['canPay'] as bool? ?? false,
    payBy: json['payBy'] != null
        ? DateTime.tryParse(json['payBy'] as String)
        : null,
    expiresAt: json['expiresAt'] != null
        ? DateTime.tryParse(json['expiresAt'] as String)
        : null,
    providerNote: json['providerNote'] as String?,
    depositNote: json['depositNote'] as String?,
    instructions: json['instructions'] as String?,
    policyText: json['policyText'] as String?,
  );

  final String id;
  final String? reference;
  final BookingStatus status;
  final BookingUnit unit;
  final String startDate;
  final String? endDate;
  final String? startTime;
  final String? endTime;
  final int? units;
  final int quantity;
  final int guests;
  final double total;
  final String? providerName;
  final BookingListingRef? listing;
  final BookingContact? contact;
  final String? paymentStatus;
  final double? amountDue;
  final double? amountPaid;
  final bool canCancel;
  final bool canPay;
  final DateTime? payBy;
  final DateTime? expiresAt;
  final String? providerNote;
  final String? depositNote;
  final String? instructions;
  final String? policyText;
}
