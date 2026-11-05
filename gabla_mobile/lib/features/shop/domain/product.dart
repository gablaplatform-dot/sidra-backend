import '../../../core/utils/parsing.dart';
import '../../services/domain/booking_config.dart';

/// A listing shown in the shop (type `product`) or services (type
/// `service`). Mirrors `mapProductDto` in
/// `public_app/src/lib/shopMappers.js`, but keeps raw numeric/UGX values
/// instead of pre-formatted strings - formatting is a presentation concern
/// here (see `core/utils/money.dart`).
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    this.originalPrice,
    this.discountPercent,
    this.isNew = false,
    this.soldCount = 0,
    this.description,
    this.distanceKm,
    this.providerId,
    this.providerName,
    this.imageUrl,
    this.gallery = const [],
    this.bookable = false,
    this.bookingMode,
    this.type = 'product',
    this.categoryId,
    this.district,
    this.createdAt,
    this.customFields = const {},
    this.onlinePaymentEnabled = true,
    this.providerOnlinePaymentsEnabled = true,
    this.booking,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final media = json['media'];
    String? image;
    List<String> gallery = const [];
    if (media is Map) {
      image = media['imageUrl'] as String?;
      gallery = (media['gallery'] as List?)?.cast<String>() ?? const [];
      image ??= gallery.isNotEmpty ? gallery.first : null;
    } else if (media is String) {
      image = media;
    }
    final provider = json['provider'] as Map<String, dynamic>?;
    return Product(
      type: json['type'] as String? ?? 'product',
      categoryId:
          (json['productCategoryId'] ?? json['serviceCategoryId']) as String?,
      district: provider?['district'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      customFields: Map<String, dynamic>.from(
        json['customFields'] as Map? ?? {},
      ),
      onlinePaymentEnabled: json['onlinePaymentEnabled'] != false,
      providerOnlinePaymentsEnabled:
          provider?['onlinePaymentsEnabled'] != false,
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Product',
      price: asDouble(json['price']),
      originalPrice: asNum(json['originalPrice'])?.toDouble(),
      discountPercent: asInt(json['discountPercent']),
      isNew: json['isNew'] as bool? ?? false,
      soldCount: asInt(json['soldCount']) ?? 0,
      description: json['description'] as String?,
      distanceKm: asNum(json['distanceKm'])?.toDouble(),
      providerId: provider?['id'] as String? ?? json['providerId'] as String?,
      providerName: provider?['businessName'] as String?,
      imageUrl: image,
      gallery: gallery,
      bookable:
          json['bookable'] as bool? ??
          (json['bookingMode'] != null &&
              json['bookingMode'] != 'none' &&
              json['booking'] != null),
      bookingMode: json['bookingMode'] as String?,
      booking: json['booking'] != null
          ? BookingConfig.fromJson(json['booking'] as Map<String, dynamic>)
          : null,
    );
  }

  final String type;
  final String? categoryId, district;
  final DateTime? createdAt;
  final Map<String, dynamic> customFields;
  final bool onlinePaymentEnabled, providerOnlinePaymentsEnabled;
  List<String> get images => {
    ...[imageUrl].whereType<String>().where((s) => s.isNotEmpty),
    ...gallery.where((s) => s.isNotEmpty),
  }.toList();
  bool get canPayOnline =>
      type == 'product' &&
      onlinePaymentEnabled &&
      providerOnlinePaymentsEnabled;
  final String id;
  final String name;
  final double price;
  final double? originalPrice;
  final int? discountPercent;
  final bool isNew;
  final int soldCount;
  final String? description;
  final double? distanceKm;
  final String? providerId;
  final String? providerName;
  final String? imageUrl;
  final List<String> gallery;
  final bool bookable;

  /// `"instant"` or a request-based mode - affects copy only, not the
  /// `POST /bookings` payload.
  final String? bookingMode;
  final BookingConfig? booking;

  bool get isOnSale => originalPrice != null && originalPrice! > price;
}
