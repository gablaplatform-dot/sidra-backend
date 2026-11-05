/// A pickup or dropoff point. Mirrors the `{ lat, lng, address }` shape
/// `public_app/src/pages/Ride.jsx` sends to `/rides/estimate` and
/// `/rides/trips`.
class RideLocation {
  const RideLocation({required this.lat, required this.lng, required this.address});

  factory RideLocation.fromJson(Map<String, dynamic> json) => RideLocation(
        lat: (json['lat'] as num).toDouble(),
        lng: (json['lng'] as num).toDouble(),
        address: json['address'] as String? ?? '',
      );

  final double lat;
  final double lng;
  final String address;

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng, 'address': address};
}
