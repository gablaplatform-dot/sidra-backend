class BusTicket {
  const BusTicket({
    required this.ticketNumber,
    required this.passengerName,
    required this.seatLabel,
    required this.status,
    required this.trip,
    this.companyName,
    this.boardingPoint,
    this.ticketTypeName,
    this.bookingStatus,
    this.delayMinutes = 0,
  });
  factory BusTicket.fromJson(
    Map<String, dynamic> j, {
    Map<String, dynamic>? booking,
  }) {
    final b = booking ?? j;
    final t = b['trip'] as Map<String, dynamic>? ?? const {};
    final r = t['route'] as Map<String, dynamic>? ?? const {};
    final o = b['operator'] as Map<String, dynamic>? ?? const {};
    return BusTicket(
      ticketNumber: j['ticketNumber'] as String? ?? '',
      passengerName: j['passengerName'] as String? ?? '',
      seatLabel:
          '${j['seatNumber'] ?? j['seatLabel'] ?? 'Assigned after payment'}',
      status: j['status'] as String? ?? 'issued',
      trip: BusTripRef.fromJson(t),
      companyName: o['companyName'] as String?,
      boardingPoint: r['boardingPoint'] as String? ?? o['parkName'] as String?,
      ticketTypeName: j['ticketTypeName'] as String?,
      bookingStatus: b['status'] as String?,
      delayMinutes: (t['delayMinutes'] as num?)?.toInt() ?? 0,
    );
  }
  final String ticketNumber, passengerName, seatLabel, status;
  final BusTripRef trip;
  final String? companyName, boardingPoint, ticketTypeName, bookingStatus;
  final int delayMinutes;
  DateTime get departAtEat =>
      trip.departAt.toUtc().add(Duration(hours: 3, minutes: delayMinutes));
  bool get canBoard =>
      !['cancelled', 'refund_due'].contains(bookingStatus) &&
      !['cancelled', 'used'].contains(status) &&
      trip.status != 'cancelled' &&
      DateTime.now().toUtc().isBefore(
        trip.departAt.toUtc().add(
          Duration(minutes: trip.durationMinutes + delayMinutes),
        ),
      );
}

class BusTripRef {
  const BusTripRef({
    required this.originName,
    required this.destinationName,
    required this.departAt,
    this.durationMinutes = 0,
    this.status = 'scheduled',
  });
  factory BusTripRef.fromJson(Map<String, dynamic> j) {
    final r = j['route'] as Map<String, dynamic>? ?? const {};
    return BusTripRef(
      durationMinutes: (r['durationMinutes'] as num?)?.toInt() ?? 0,
      status: j['status'] as String? ?? 'scheduled',
      originName: r['originName'] as String? ?? '',
      destinationName: r['destinationName'] as String? ?? '',
      departAt:
          DateTime.tryParse('${j['departureAt'] ?? j['departAt'] ?? ''}') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    );
  }
  final String originName, destinationName;
  final DateTime departAt;
  final int durationMinutes;
  final String status;
}
