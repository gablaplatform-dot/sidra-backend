import 'bus_ticket.dart';

class BusBooking {
  const BusBooking({
    required this.id,
    required this.reference,
    required this.status,
    required this.departureAt,
    required this.origin,
    required this.destination,
    required this.company,
    required this.passenger,
    required this.seatCount,
    required this.total,
    required this.tickets,
    required this.canCancel,
    this.cancellationClosesAt,
    this.lockedAt,
    this.boardingPoint = '',
    this.boardingLat,
    this.boardingLng,
    this.tripStatus = 'scheduled',
    this.operationStatus = 'awaiting_call',
    this.refundStatus,
    this.delayMinutes = 0,
  });
  factory BusBooking.fromJson(Map<String, dynamic> j) {
    final trip = Map<String, dynamic>.from(j['trip'] as Map? ?? {});
    final route = Map<String, dynamic>.from(trip['route'] as Map? ?? {});
    final op = Map<String, dynamic>.from(j['operator'] as Map? ?? {});
    final scheduled =
        DateTime.tryParse('${trip['departureAt']}') ??
        DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    final delay = (trip['delayMinutes'] as num?)?.toInt() ?? 0;
    return BusBooking(
      id: '${j['id']}',
      reference: '${j['reference']}',
      status: '${j['status']}',
      departureAt:
          DateTime.tryParse('${trip['effectiveDepartureAt']}') ??
          scheduled.add(Duration(minutes: delay)),
      origin: '${route['originName'] ?? ''}',
      destination: '${route['destinationName'] ?? ''}',
      company: '${op['companyName'] ?? 'Gabla Bus'}',
      passenger: '${j['passengerName'] ?? ''}',
      seatCount: (j['seatCount'] as num?)?.toInt() ?? 1,
      total: double.tryParse('${j['total']}') ?? 0,
      canCancel: j['canCancel'] == true,
      cancellationClosesAt: DateTime.tryParse('${j['cancellationClosesAt']}'),
      lockedAt: DateTime.tryParse('${j['lockedAt']}'),
      boardingPoint: '${route['boardingPoint'] ?? op['parkName'] ?? ''}',
      boardingLat: double.tryParse('${route['boardingLat']}'),
      boardingLng: double.tryParse('${route['boardingLng']}'),
      tripStatus: '${trip['status'] ?? 'scheduled'}',
      operationStatus: '${j['operationStatus'] ?? 'awaiting_call'}',
      refundStatus: j['refundStatus'] as String?,
      delayMinutes: delay,
      tickets: [
        for (final t in j['tickets'] as List? ?? [])
          BusTicket.fromJson(Map<String, dynamic>.from(t), booking: j),
      ],
    );
  }
  final String id,
      reference,
      status,
      origin,
      destination,
      company,
      passenger,
      boardingPoint,
      tripStatus,
      operationStatus;
  final String? refundStatus;
  final DateTime departureAt;
  final DateTime? cancellationClosesAt, lockedAt;
  final int seatCount, delayMinutes;
  final double total;
  final double? boardingLat, boardingLng;
  final bool canCancel;
  final List<BusTicket> tickets;
  bool cancellableAt(DateTime now) =>
      canCancel &&
      status == 'confirmed' &&
      lockedAt == null &&
      tripStatus == 'scheduled' &&
      cancellationClosesAt != null &&
      now.isBefore(cancellationClosesAt!) &&
      now.isBefore(departureAt);
  bool get past =>
      ['completed', 'cancelled'].contains(tripStatus) ||
      ['cancelled', 'refund_due', 'failed', 'expired'].contains(status) ||
      departureAt.isBefore(
        DateTime.now().toUtc().subtract(const Duration(hours: 6)),
      );
}
