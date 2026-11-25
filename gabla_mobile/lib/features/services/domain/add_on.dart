/// An optional (or provider-required) add-on for a bookable listing, picked
/// at booking time and billed alongside the base price. See
/// `ServiceProduct.items` / the snapshotted `ServiceBooking.items` on the
/// server.
class AddOn {
  const AddOn({required this.name, this.price, this.required = false});

  factory AddOn.fromJson(Map<String, dynamic> json) => AddOn(
    name: json['name']?.toString() ?? '',
    price: (json['price'] as num?)?.toDouble(),
    required: json['required'] == true,
  );

  final String name;
  final double? price;
  final bool required;
}
