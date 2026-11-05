import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../shop/application/shop_providers.dart';
import '../../shop/domain/product.dart';
import '../data/booking_repository.dart';
import '../domain/availability.dart';
import '../domain/booking.dart';

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(ref.watch(apiClientProvider)),
);

final myBookingsProvider = FutureProvider<List<Booking>>((ref) {
  return ref.watch(bookingRepositoryProvider).fetchMine();
});

/// A month-level availability calendar for one listing.
class AvailabilityRangeQuery {
  const AvailabilityRangeQuery({
    required this.listingId,
    required this.from,
    required this.to,
  });

  final String listingId;
  final DateTime from;
  final DateTime to;

  @override
  bool operator ==(Object other) =>
      other is AvailabilityRangeQuery &&
      other.listingId == listingId &&
      other.from == from &&
      other.to == to;

  @override
  int get hashCode => Object.hash(listingId, from, to);
}

final availabilityRangeProvider =
    FutureProvider.family<Availability, AvailabilityRangeQuery>((ref, query) {
      return ref
          .watch(bookingRepositoryProvider)
          .fetchAvailability(query.listingId, from: query.from, to: query.to);
    });

/// One day's hour slots (`unit == hour` listings only).
class AvailabilityDayQuery {
  const AvailabilityDayQuery({required this.listingId, required this.date});

  final String listingId;
  final DateTime date;

  @override
  bool operator ==(Object other) =>
      other is AvailabilityDayQuery &&
      other.listingId == listingId &&
      other.date == date;

  @override
  int get hashCode => Object.hash(listingId, date);
}

final availabilityDayProvider =
    FutureProvider.family<Availability, AvailabilityDayQuery>((ref, query) {
      return ref
          .watch(bookingRepositoryProvider)
          .fetchAvailability(
            query.listingId,
            from: query.date,
            to: query.date,
            date: query.date,
          );
    });

/// Bookable services for one category (or all, when null) - same `/listings`
/// endpoint the shop uses, filtered to `type=service`.
final bookableServicesProvider = FutureProvider.family<List<Product>, String?>((
  ref,
  categoryId,
) {
  return ref
      .watch(shopRepositoryProvider)
      .fetchListings(type: 'service', categoryId: categoryId, sort: 'featured');
});
