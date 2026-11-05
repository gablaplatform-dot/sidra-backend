import '../../../core/network/api_client.dart';
import '../domain/bus_ticket.dart';
import '../domain/bus_trip.dart';

/// Customer-facing `/bus/*` endpoints. The `/bus/operator/*` surface is a
/// separate, signed-in-operator portal and is out of scope here.
class BusRepository {
  BusRepository(this._client);

  final ApiClient _client;

  Future<List<BusTrip>> fetchPopularRoutes({int limit = 10}) async {
    final data = await _client.getList(
      '/bus/popular-routes',
      query: {'limit': limit},
    );
    return data
        .map((e) => BusTrip.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<BusTrip>> searchTrips({
    required String date,
    required String from,
    required String to,
    String? operatorSlug,
  }) async {
    final data = await _client.getList(
      '/bus/trips',
      query: {
        'date': date,
        'from': from,
        'to': to,
        if (operatorSlug != null) 'operatorSlug': operatorSlug,
      },
    );
    return data
        .map((e) => BusTrip.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<BusTrip> fetchTrip(String tripId) async {
    final data = await _client.get<Map<String, dynamic>>('/bus/trips/$tripId');
    return BusTrip.fromJson(data);
  }

  Future<List<Map<String, dynamic>>> fetchParks() async {
    final data = await _client.getList('/bus/parks');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> fetchPark(String slug) =>
      _client.get<Map<String, dynamic>>('/bus/parks/$slug');

  Future<List<BusTicket>> fetchMyTickets() async {
    final data = await _client.get<Map<String, dynamic>>('/bus/my-tickets');
    return [
      for (final b in [
        ...?data['upcoming'] as List?,
        ...?data['past'] as List?,
      ])
        for (final t in b['tickets'] as List? ?? [])
          BusTicket.fromJson(
            Map<String, dynamic>.from(t),
            booking: Map<String, dynamic>.from(b),
          ),
    ];
  }

  Future<BusTicket> fetchTicket(String ticketNumber) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/bus/my-tickets/${Uri.encodeComponent(ticketNumber)}',
    );
    return BusTicket.fromJson(
      Map<String, dynamic>.from(data['ticket']),
      booking: Map<String, dynamic>.from(data['booking']),
    );
  }

  Future<Map<String, dynamic>> fetchPlaces() => _client.get('/bus/places');
  Future<Map<String, dynamic>> createBooking(Map<String, dynamic> body) =>
      _client.post('/bus/bookings', body: body);
  Future<Map<String, dynamic>> fetchBooking(String id) =>
      _client.get('/bus/bookings/${Uri.encodeComponent(id)}');
}
