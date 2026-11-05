import '../../../core/utils/parsing.dart';

/// An order's lifecycle status. Mirrors `ORDER_STATUS` in
/// `public_app/src/lib/myOrders.js` - `step` drives a progress indicator,
/// `-1` means the order stopped (rejected/canceled) rather than progressing.
enum OrderStatus {
  pending,
  accepted,
  delivering,
  fulfilled,
  rejected,
  canceled,
}

OrderStatus orderStatusFromString(String value) => OrderStatus.values
    .firstWhere((s) => s.name == value, orElse: () => OrderStatus.pending);

int orderStatusStep(OrderStatus status) => switch (status) {
  OrderStatus.pending => 0,
  OrderStatus.accepted => 1,
  OrderStatus.delivering => 2,
  OrderStatus.fulfilled => 3,
  OrderStatus.rejected || OrderStatus.canceled => -1,
};

class Order {
  const Order({
    required this.id,
    required this.status,
    required this.total,
    required this.createdAt,
    this.providerName,
    this.providerId,
    this.providerAvatar,
    this.paymentMethod = 'cash',
    this.paymentStatus = '',
    this.items = const [],
    this.documents = const [],
    this.fulfillment = const {},
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
    providerId:
        (json['provider'] as Map?)?['id']?.toString() ??
        json['providerId']?.toString(),
    providerAvatar: (json['provider'] as Map?)?['avatarUrl']?.toString(),
    paymentMethod: json['paymentMethod']?.toString() ?? 'cash',
    paymentStatus: json['paymentStatus']?.toString() ?? '',
    items: (json['items'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList(),
    documents: (json['documents'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList(),
    fulfillment: Map<String, dynamic>.from(json['fulfillment'] as Map? ?? {}),
    id: json['id'] as String,
    status: orderStatusFromString(json['status'] as String? ?? 'pending'),
    total: asDouble(json['total']),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    providerName:
        (json['provider'] as Map?)?['businessName'] as String? ??
        json['providerName'] as String?,
  );

  final String? providerId, providerAvatar;
  final String paymentMethod, paymentStatus;
  final List<Map<String, dynamic>> items, documents;
  final Map<String, dynamic> fulfillment;
  bool get paid => paymentStatus == 'paid' || paymentStatus == 'paid_cash';
  bool get canPay => paymentMethod == 'online' && paymentStatus == 'payable';
  String get bucket => status == OrderStatus.fulfilled
      ? 'done'
      : status == OrderStatus.rejected || status == OrderStatus.canceled
      ? 'closed'
      : 'open';
  String get reference =>
      '#${id.substring(id.length > 6 ? id.length - 6 : 0).toUpperCase()}';
  final String id;
  final OrderStatus status;
  final double total;
  final DateTime createdAt;
  final String? providerName;
}
