import 'dart:convert';

/// Immutable, value-keyed query shared by listings and facets.
class BrowseQuery {
  const BrowseQuery({
    this.categoryId,
    this.providerId,
    this.shopCategoryId,
    this.kind = 'product',
    this.collection = 'all',
    this.q = '',
    this.around = '',
    this.sort = 'featured',
    this.page = 1,
    this.min,
    this.max,
    this.discount = false,
    this.district = '',
    this.everywhere = false,
    this.lat,
    this.lng,
    this.country = '',
    this.culture = '',
    this.attrs = const {},
  });
  final String? categoryId, providerId, shopCategoryId;
  final String kind, collection, q, sort, district, country, culture, around;
  final int page;
  final double? min, max, lat, lng;
  final bool discount, everywhere;
  final Map<String, List<String>> attrs;
  Map<String, dynamic> get filters => {
    'type': kind,
    if (around.isNotEmpty && district.isEmpty && lat == null && !everywhere)
      'around': around,
    if (categoryId != null)
      (kind == 'service' ? 'serviceCategoryId' : 'productCategoryId'):
          categoryId,
    if (providerId != null) 'providerId': providerId,
    if (shopCategoryId != null) 'shopCategoryId': shopCategoryId,
    if (q.trim().isNotEmpty) 'q': q.trim(),
    if (collection == 'new') 'newArrivals': true,
    if (min != null) 'minPrice': min,
    if (max != null) 'maxPrice': max,
    if (discount) 'discountOnly': true,
    if (country.isNotEmpty) 'countryId': country,
    if (culture.isNotEmpty) 'cultureId': culture,
    if (attrs.isNotEmpty) 'attrs': jsonEncode(attrs),
    if (lat != null && lng != null) ...{
      'lat': lat,
      'lng': lng,
      'radiusKm': 15,
    } else if (district.isNotEmpty)
      'district': district,
  };
  Map<String, dynamic> get parameters => {
    ...filters,
    'page': page,
    'limit': 24,
    'sort': sort,
  };
  BrowseQuery copyWith({
    String? q,
    String? around,
    String? sort,
    int? page,
    double? min,
    double? max,
    bool? discount,
    String? district,
    bool? everywhere,
    double? lat,
    double? lng,
    String? country,
    String? culture,
    Map<String, List<String>>? attrs,
    bool clearPrice = false,
    bool clearLocation = false,
    String? categoryId,
    String? shopCategoryId,
    bool clearCategory = false,
  }) => BrowseQuery(
    kind: kind,
    collection: collection,
    categoryId: clearCategory ? null : categoryId ?? this.categoryId,
    shopCategoryId: clearCategory
        ? null
        : shopCategoryId ?? this.shopCategoryId,
    providerId: providerId,
    q: q ?? this.q,
    around: around ?? this.around,
    sort: sort ?? this.sort,
    page: page ?? 1,
    min: clearPrice ? null : min ?? this.min,
    max: clearPrice ? null : max ?? this.max,
    discount: discount ?? this.discount,
    district: clearLocation ? '' : district ?? this.district,
    everywhere: everywhere ?? this.everywhere,
    lat: clearLocation ? null : lat ?? this.lat,
    lng: clearLocation ? null : lng ?? this.lng,
    country: country ?? this.country,
    culture: culture ?? this.culture,
    attrs: attrs ?? this.attrs,
  );
  int get activeCount =>
      (min != null || max != null ? 1 : 0) +
      (discount ? 1 : 0) +
      (country.isEmpty ? 0 : 1) +
      (culture.isEmpty ? 0 : 1) +
      attrs.values.fold(0, (n, v) => n + v.length);
  @override
  bool operator ==(Object other) =>
      other is BrowseQuery &&
      jsonEncode(parameters) == jsonEncode(other.parameters) &&
      everywhere == other.everywhere;
  @override
  int get hashCode => Object.hash(jsonEncode(parameters), everywhere);
}
