/// The API serializes Prisma `Decimal` fields (price, totals, ratings, ...)
/// as JSON strings, not numbers, to avoid float precision loss - e.g.
/// `"price": "300"` rather than `"price": 300`. A plain `as num?` cast on
/// those throws, so every money/decimal field in a `fromJson` must go
/// through this instead of casting directly.
num? asNum(dynamic value) {
  if (value == null) return null;
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}

double asDouble(dynamic value, {double fallback = 0}) =>
    asNum(value)?.toDouble() ?? fallback;

int? asInt(dynamic value) => asNum(value)?.toInt();
