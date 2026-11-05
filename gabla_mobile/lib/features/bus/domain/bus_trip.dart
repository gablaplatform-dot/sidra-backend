import '../../../core/utils/parsing.dart';

class BusTicketType {
  const BusTicketType({
    required this.id,
    required this.name,
    required this.price,
    this.description,
  });
  factory BusTicketType.fromJson(Map<String, dynamic> j) => BusTicketType(
    id: '${j['id']}',
    name: j['name'] as String? ?? 'Ticket',
    price: asDouble(j['price']),
    description: j['description'] as String?,
  );
  final String id, name;
  final double price;
  final String? description;
}

class BusTrip {
  const BusTrip({
    required this.id,
    required this.originName,
    required this.destinationName,
    required this.departAt,
    required this.price,
    this.companyName,
    this.parkName,
    this.seatsAvailable,
    this.durationMinutes = 0,
    this.delayMinutes = 0,
    this.bookable = false,
    this.maxPerBooking = 10,
    this.ticketTypes = const [],
    this.amenities = const [],
    this.boardingPoint,
    this.dropoffPoint,
    this.contactPhone,
    this.busTypeName,
    this.imageUrl,
    this.note,
    this.operatorSlug,
  });
  factory BusTrip.fromJson(Map<String, dynamic> j) {
    final r = j['route'] as Map<String, dynamic>? ?? const {};
    final o = j['operator'] as Map<String, dynamic>? ?? const {};
    final b = j['busType'] as Map<String, dynamic>? ?? const {};
    return BusTrip(
      id: j['id'] as String? ?? '',
      originName:
          r['originName'] as String? ??
          j['originName'] as String? ??
          j['from'] as String? ??
          '',
      destinationName:
          r['destinationName'] as String? ??
          j['destinationName'] as String? ??
          j['to'] as String? ??
          '',
      departAt:
          DateTime.tryParse('${j['departureAt'] ?? j['departAt'] ?? ''}') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      price: asDouble(j['priceFrom'] ?? j['minPrice'] ?? j['price']),
      companyName: o['companyName'] as String?,
      parkName: o['parkName'] as String?,
      seatsAvailable: asInt(j['seatsLeft'] ?? j['seatsAvailable']),
      durationMinutes: asInt(r['durationMinutes']) ?? 0,
      delayMinutes: asInt(j['delayMinutes']) ?? 0,
      bookable: j['bookable'] == true,
      maxPerBooking: asInt(j['maxPerBooking']) ?? 10,
      ticketTypes: (j['ticketTypes'] as List? ?? [])
          .map((t) => BusTicketType.fromJson(Map<String, dynamic>.from(t)))
          .toList(),
      amenities: (b['amenities'] as List? ?? []).map((a) => '$a').toList(),
      boardingPoint: r['boardingPoint'] as String?,
      dropoffPoint: r['dropoffPoint'] as String?,
      contactPhone: o['contactPhone'] as String?,
      busTypeName: b['name'] as String?,
      imageUrl: b['imageUrl'] as String?,
      note: j['note'] as String?,
      operatorSlug: o['slug'] as String?,
    );
  }
  final String id, originName, destinationName;
  final DateTime departAt;
  final double price;
  final String? companyName,
      parkName,
      boardingPoint,
      dropoffPoint,
      contactPhone,
      busTypeName,
      imageUrl,
      note,
      operatorSlug;
  final int? seatsAvailable;
  final int durationMinutes, delayMinutes, maxPerBooking;
  final bool bookable;
  final List<BusTicketType> ticketTypes;
  final List<String> amenities;
  DateTime get departAtEat =>
      departAt.toUtc().add(Duration(hours: 3, minutes: delayMinutes));
  DateTime get arriveAtEat =>
      departAtEat.add(Duration(minutes: durationMinutes));
}

String normalizeBusPhone(String value) {
  final n = value.replaceAll(RegExp(r'\D'), '');
  if (n.startsWith('256') && n.length == 12) return n;
  if (n.startsWith('0') && n.length == 10) return '256${n.substring(1)}';
  if (n.length == 9) return '256$n';
  return '';
}
