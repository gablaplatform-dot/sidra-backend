import 'package:latlong2/latlong.dart';
import '../../shop/domain/product.dart';

LatLng? parsePoint(dynamic value) {
  if (value is! Map) return null;
  final lat = num.tryParse('${value['lat']}')?.toDouble();
  final lng = num.tryParse('${value['lng']}')?.toDouble();
  if (lat == null ||
      lng == null ||
      !lat.isFinite ||
      !lng.isFinite ||
      lat.abs() > 90 ||
      lng.abs() > 180) {
    return null;
  }
  return LatLng(lat, lng);
}

class NearbyItem {
  const NearbyItem({
    required this.product,
    required this.type,
    this.pin,
    this.related = false,
  });
  factory NearbyItem.fromJson(Map<String, dynamic> json) => NearbyItem(
    product: Product.fromJson(json),
    type: json['type'] as String? ?? 'product',
    pin: parsePoint(json['pin']),
    related: json['matchedBy'] == 'related',
  );
  final Product product;
  final String type;
  final LatLng? pin;
  final bool related;
  String get id => product.id;
}

class NearbyResponse {
  const NearbyResponse({
    this.items = const [],
    this.total = 0,
    this.centre,
    this.widened = false,
    this.interpretedAs,
  });
  factory NearbyResponse.fromJson(Map<String, dynamic> json) => NearbyResponse(
    items: (json['items'] as List? ?? [])
        .map((e) => NearbyItem.fromJson(e as Map<String, dynamic>))
        .toList(),
    total: (json['total'] as num?)?.toInt() ?? 0,
    centre: parsePoint(json['centre']),
    widened: json['widened'] == true,
    interpretedAs: json['interpretedAs'] as String?,
  );
  final List<NearbyItem> items;
  final int total;
  final LatLng? centre;
  final bool widened;
  final String? interpretedAs;
}

class NearbyOrigin {
  const NearbyOrigin({
    required this.label,
    this.point,
    this.district,
    this.isGps = false,
  });
  static const kampala = NearbyOrigin(
    label: 'Around Kampala',
    point: LatLng(.347596, 32.58252),
  );
  final String label;
  final LatLng? point;
  final String? district;
  final bool isGps;
  Map<String, dynamic> get query => point != null
      ? {'lat': point!.latitude, 'lng': point!.longitude, 'radiusKm': 15}
      : {'around': district};
}

/// Preserve co-located listings, using the server's privacy-rounded pin.
Map<LatLng, List<NearbyItem>> groupNearbyPins(List<NearbyItem> items) {
  final groups = <LatLng, List<NearbyItem>>{};
  for (final item in items) {
    if (item.pin != null) (groups[item.pin!] ??= []).add(item);
  }
  return groups;
}
