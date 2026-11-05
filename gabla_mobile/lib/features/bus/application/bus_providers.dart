import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/bus_repository.dart';
import '../domain/bus_ticket.dart';
import '../domain/bus_trip.dart';

final busRepositoryProvider = Provider<BusRepository>(
  (ref) => BusRepository(ref.watch(apiClientProvider)),
);

final popularRoutesProvider = FutureProvider<List<BusTrip>>((ref) {
  return ref.watch(busRepositoryProvider).fetchPopularRoutes();
});

final busParksProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(busRepositoryProvider).fetchParks();
});

final myTicketsProvider = FutureProvider<List<BusTicket>>((ref) {
  return ref.watch(busRepositoryProvider).fetchMyTickets();
});

final ticketDetailProvider = FutureProvider.family<BusTicket, String>((
  ref,
  ticketNumber,
) {
  return ref.watch(busRepositoryProvider).fetchTicket(ticketNumber);
});

final tripDetailProvider = FutureProvider.family<BusTrip, String>((
  ref,
  tripId,
) {
  return ref.watch(busRepositoryProvider).fetchTrip(tripId);
});

/// Holds the current `(date, from, to)` search query entered on
/// `BusHomeScreen`, consumed by `BusSearchScreen`.
class BusSearchQuery {
  const BusSearchQuery({
    required this.date,
    required this.from,
    required this.to,
    this.operatorSlug,
  });
  final String date;
  final String from;
  final String to;
  final String? operatorSlug;

  @override
  bool operator ==(Object other) =>
      other is BusSearchQuery &&
      other.date == date &&
      other.from == from &&
      other.to == to &&
      other.operatorSlug == operatorSlug;

  @override
  int get hashCode => Object.hash(date, from, to, operatorSlug);
}

final busSearchResultsProvider =
    FutureProvider.family<List<BusTrip>, BusSearchQuery>((ref, query) {
      return ref
          .watch(busRepositoryProvider)
          .searchTrips(
            date: query.date,
            from: query.from,
            to: query.to,
            operatorSlug: query.operatorSlug,
          );
    });

final busPlacesProvider = FutureProvider<Map<String, dynamic>>(
  (ref) => ref.watch(busRepositoryProvider).fetchPlaces(),
);
