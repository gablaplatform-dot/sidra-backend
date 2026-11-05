import '../../../core/network/api_client.dart';
import '../domain/availability.dart';
import '../domain/booking.dart';

String _ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// `/bookings*` - booking a bookable service listing and managing the
/// bookings a customer holds. See `public_app/src/lib/bookings.js` and
/// `components/booking/{BookingPanel,AvailabilityCalendar,MyBookings}.jsx`.
class BookingRepository {
  BookingRepository(this._client);

  final ApiClient _client;

  Future<List<Booking>> fetchMine() async {
    final items = await _client.getList('/bookings/mine');
    return items
        .map((e) => Booking.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// With `date` omitted: a month-level calendar (`days`). With `date` set:
  /// that day's hour slots too (`slots`), for `unit == hour` listings.
  Future<Availability> fetchAvailability(
    String listingId, {
    required DateTime from,
    required DateTime to,
    DateTime? date,
  }) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/bookings/availability',
      query: {
        'listingId': listingId,
        'from': _ymd(from),
        'to': _ymd(to),
        if (date != null) 'date': _ymd(date),
      },
    );
    return Availability.fromJson(data);
  }

  /// `night`/`day` listings pass [endDate]; `hour` listings pass [startTime]
  /// and [hours] instead.
  Future<Booking> create({
    required String listingId,
    required DateTime startDate,
    DateTime? endDate,
    String? startTime,
    int? hours,
    required int quantity,
    required int guests,
    required String name,
    required String phone,
    String? email,
    String? notes,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      '/bookings',
      body: {
        'listingId': listingId,
        'startDate': _ymd(startDate),
        if (endDate != null) 'endDate': _ymd(endDate),
        if (startTime != null) 'startTime': startTime,
        if (hours != null) 'hours': hours,
        'quantity': quantity,
        'guests': guests,
        'customer': {
          'name': name,
          'phone': phone,
          if (email != null && email.isNotEmpty) 'email': email,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      },
    );
    return Booking.fromJson(data);
  }

  Future<void> cancel(String bookingId) async {
    await _client.post<dynamic>('/bookings/$bookingId/cancel');
  }
}
