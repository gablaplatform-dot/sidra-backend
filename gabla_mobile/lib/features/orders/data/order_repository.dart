import '../../../core/network/api_client.dart';
import '../domain/order.dart';
import '../domain/order_input.dart';

class OrderRepository {
  OrderRepository(this._client);

  final ApiClient _client;

  Future<List<Order>> fetchMine({int limit = 50}) async {
    final data =
        await _client.getList('/engagement/orders/mine', query: {'limit': limit});
    return data.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Order> fetchById(String orderId) async {
    final data = await _client.get<Map<String, dynamic>>('/engagement/provider/orders/$orderId');
    return Order.fromJson(data);
  }

  /// One order per seller - see `ProviderOrderGroup`. No payment is
  /// collected here for either method: `cash` is paid on
  /// delivery/pickup, `online` just flags that the buyer pays later, from
  /// My Orders, once the seller accepts. Mirrors the `request("/engagement/orders", ...)`
  /// call in `public_app/src/pages/Cart.jsx`.
  Future<Order> createOrder({
    required String providerId,
    required List<OrderItemInput> items,
    required String paymentMethod,
    required String customerName,
    required String customerPhone,
    String? notes,
    FulfillmentInput? fulfillment,
  }) async {
    final data = await _client.post<Map<String, dynamic>>('/engagement/orders', body: {
      'providerId': providerId,
      'items': items.map((item) => item.toJson()).toList(),
      'paymentMethod': paymentMethod,
      'customer': {
        'name': customerName,
        'phone': customerPhone,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
      if (fulfillment != null) 'fulfillment': fulfillment.toJson(),
    });
    return Order.fromJson(data);
  }
}
