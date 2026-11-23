import '../../../core/utils/parsing.dart';
import 'booking.dart';
import 'booking_config.dart';

/// A line in `customer`/`items` on the provider's view of a booking.
class BookingCustomer {
  const BookingCustomer({
    required this.name,
    required this.phone,
    this.email,
    this.notes,
  });

  factory BookingCustomer.fromJson(Map<String, dynamic>? json) =>
      BookingCustomer(
        name: json?['name'] as String? ?? '',
        phone: json?['phone'] as String? ?? '',
        email: json?['email'] as String?,
        notes: json?['notes'] as String?,
      );

  final String name;
  final String phone;
  final String? email;
  final String? notes;
}

class BookingItem {
  const BookingItem({required this.name, this.price});

  factory BookingItem.fromJson(Map<String, dynamic> json) => BookingItem(
    name: json['name'] as String? ?? '',
    price: asNum(json['price'])?.toDouble(),
  );

  final String name;
  final double? price;
}

/// A booking as the PROVIDER sees it - `GET /bookings/provider`, with the
/// guest's contact details instead of the guest-facing `contact`/`canCancel`
/// fields. Mirrors `toDto(b, { viewer: "provider" })` in
/// `serviceBooking.service.js`.
class ProviderBooking {
  const ProviderBooking({
    required this.id,
    this.reference,
    required this.status,
    required this.unit,
    required this.listingName,
    required this.startDate,
    this.endDate,
    this.startTime,
    this.endTime,
    required this.total,
    required this.guests,
    required this.customer,
    this.items = const [],
    this.paymentStatus,
    this.amountDue,
    this.amountPaid,
    this.canComplete = false,
  });

  factory ProviderBooking.fromJson(Map<String, dynamic> json) =>
      ProviderBooking(
        id: json['id'] as String,
        reference: json['reference'] as String?,
        status: bookingStatusFromString(json['status'] as String?),
        unit: bookingUnitFromString(json['unit'] as String?),
        listingName: (json['listing'] as Map?)?['name'] as String? ?? 'Service',
        startDate: json['startDate'] as String? ?? '',
        endDate: json['endDate'] as String?,
        startTime: json['startTime'] as String?,
        endTime: json['endTime'] as String?,
        total: asDouble(json['total']),
        guests: (json['guests'] as num?)?.toInt() ?? 1,
        customer: BookingCustomer.fromJson(json['customer'] as Map<String, dynamic>?),
        items: (json['items'] as List? ?? [])
            .map((e) => BookingItem.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        paymentStatus: json['paymentStatus'] as String?,
        amountDue: asNum(json['amountDue'])?.toDouble(),
        amountPaid: asNum(json['amountPaid'])?.toDouble(),
        canComplete: json['canComplete'] as bool? ?? false,
      );

  final String id;
  final String? reference;
  final BookingStatus status;
  final BookingUnit unit;
  final String listingName;
  final String startDate;
  final String? endDate;
  final String? startTime;
  final String? endTime;
  final double total;
  final int guests;
  final BookingCustomer customer;
  final List<BookingItem> items;
  final String? paymentStatus;
  final double? amountDue;
  final double? amountPaid;
  final bool canComplete;
}
