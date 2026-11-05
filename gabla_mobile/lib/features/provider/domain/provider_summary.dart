import '../../../core/utils/parsing.dart';

/// A provider (seller / service business) as shown in listings such as
/// `/providers?sort=top-rated`. Kept deliberately loose since the public
/// fields vary by provider type (shop, service, bus operator, ...).
class ProviderSummary {
  const ProviderSummary({
    required this.id,
    required this.businessName,
    this.logoUrl,
    this.categoryName,
    this.district,
    this.rating,
    this.ratingCount = 0,
  });

  factory ProviderSummary.fromJson(Map<String, dynamic> json) {
    final media = json['media'] as Map<String, dynamic>?;
    final location = json['location'] as Map<String, dynamic>?;
    return ProviderSummary(
      id: json['id'] as String,
      businessName: json['businessName'] as String? ?? 'Provider',
      logoUrl: media?['avatarUrl'] as String? ?? media?['logoUrl'] as String?,
      categoryName: json['categoryName'] as String?,
      district: location?['city'] as String? ?? location?['region'] as String?,
      ratingCount: asInt(json['ratingCount']) ?? 0,
      rating: asNum(json['ratingAvg'] ?? json['rating'])?.toDouble(),
    );
  }

  final String id;
  final String businessName;
  final String? logoUrl;
  final String? categoryName;
  final String? district;
  final double? rating;
  final int ratingCount;
}
