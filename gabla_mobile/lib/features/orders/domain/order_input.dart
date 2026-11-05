/// One cart line as sent to `POST /engagement/orders`.
class OrderItemInput {
  const OrderItemInput({
    required this.listingId,
    required this.name,
    required this.quantity,
    required this.unitPrice,
  });

  final String listingId;
  final String name;
  final int quantity;
  final double unitPrice;

  Map<String, dynamic> toJson() => {
    'listingId': listingId,
    'name': name,
    'quantity': quantity,
    'unitPrice': unitPrice,
  };
}

/// How the order reaches the buyer. Mirrors `fulfillmentFor` in
/// `public_app/src/pages/Cart.jsx`.
class FulfillmentInput {
  const FulfillmentInput.pickup()
    : method = 'pickup',
      address = null,
      lat = null,
      lng = null,
      locationSource = null;

  const FulfillmentInput.delivery({
    required this.address,
    this.lat,
    this.lng,
    this.locationSource,
  }) : method = 'delivery';

  final String method;
  final String? address;
  final double? lat, lng;
  final String? locationSource;

  Map<String, dynamic> toJson() => {
    'method': method,
    if (address != null) 'address': address,
    if (lat != null && lng != null) ...{
      'lat': lat,
      'lng': lng,
      if (locationSource != null) 'locationSource': locationSource,
    },
  };
}

/// The cart grouped by seller - Gabla is multi-vendor, so checkout places
/// one order per provider rather than a single combined order. Mirrors the
/// `groupBy(providerId)` step in `Cart.jsx`.
class ProviderOrderGroup {
  const ProviderOrderGroup({
    required this.providerId,
    required this.providerName,
    required this.items,
  });

  final String providerId;
  final String providerName;
  final List<OrderItemInput> items;

  double get subtotal =>
      items.fold(0.0, (sum, item) => sum + item.unitPrice * item.quantity);
}
