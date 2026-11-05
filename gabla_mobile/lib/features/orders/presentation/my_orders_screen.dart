import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pdfrx/pdfrx.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/order_providers.dart';
import '../domain/order.dart';

class MyOrdersScreen extends ConsumerStatefulWidget {
  const MyOrdersScreen({super.key});
  @override
  ConsumerState<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends ConsumerState<MyOrdersScreen> {
  String _filter = 'all';
  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(myOrdersProvider);
    return Scaffold(
      appBar: CommerceAppBar(
        title: 'Your orders',
        actions: [
          IconButton(
            tooltip: 'My bookings',
            onPressed: () => context.push('/profile/bookings'),
            icon: const Icon(Icons.calendar_month_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myOrdersProvider);
          await ref.read(myOrdersProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const CommerceTitle(
              'From shop to doorstep.',
              subtitle:
                  'Track progress, pay accepted orders, and keep your documents together.',
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final entry in {
                    'all': 'All',
                    'open': 'In progress',
                    'done': 'Completed',
                    'closed': 'Closed',
                  }.entries)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(
                          '${entry.value} · ${(orders.valueOrNull ?? []).where((o) => entry.key == 'all' || o.bucket == entry.key).length}',
                        ),
                        selected: _filter == entry.key,
                        onSelected: (_) => setState(() => _filter = entry.key),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            orders.when(
              loading: () => const CommerceLoading(),
              error: (e, _) => CommerceEmpty(
                title: 'Couldn’t load your orders',
                message: '$e',
                action: 'Try again',
                onAction: () => ref.invalidate(myOrdersProvider),
              ),
              data: (items) {
                final shown = items
                    .where((o) => _filter == 'all' || o.bucket == _filter)
                    .toList();
                return shown.isEmpty
                    ? CommerceEmpty(
                        title: items.isEmpty
                            ? 'Your next find starts here'
                            : 'No orders in this view',
                        message: items.isEmpty
                            ? 'Your orders will appear here once sent to a seller.'
                            : 'Try another status filter.',
                        onAction: items.isEmpty
                            ? () => context.push('/shop')
                            : null,
                      )
                    : Column(
                        children: [
                          for (var i = 0; i < shown.length; i++)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 20),
                              child: OrderReceiptCard(
                                order: shown[i],
                                index: i,
                              ),
                            ),
                        ],
                      );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class OrderReceiptCard extends ConsumerWidget {
  const OrderReceiptCard({super.key, required this.order, this.index = 0});
  final Order order;
  final int index;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = Theme.of(context).colorScheme;
    final step = orderStatusStep(order.status);
    final tone = order.status == OrderStatus.fulfilled
        ? Colors.green
        : order.bucket == 'closed'
        ? c.error
        : c.primary;
    return CommercePanel(
      index: index,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: order.providerId == null
                      ? null
                      : () => context.push('/provider/${order.providerId}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.providerName ?? 'Seller',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${order.reference} · ${DateFormat.yMMMd().format(order.createdAt)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  order.status.name,
                  style: TextStyle(
                    color: tone,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          if (step >= 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 22),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < 4; i++)
                    Expanded(
                      child: Column(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: i <= step
                                  ? c.primary
                                  : c.surfaceContainerHighest,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              i <= step ? Icons.check : Icons.circle_outlined,
                              size: 15,
                              color: i <= step ? c.onPrimary : c.outline,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            [
                              'Placed',
                              'Accepted',
                              'Delivering',
                              'Completed',
                            ][i],
                            style: TextStyle(
                              fontSize: 9,
                              color: i <= step
                                  ? c.onSurface
                                  : c.onSurfaceVariant,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: InkWell(
                onTap: item['listingId'] == null
                    ? null
                    : () => context.push('/shop/product/${item['listingId']}'),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${item['name'] ?? 'Item'} × ${item['quantity'] ?? 1}',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      formatUgx(
                        num.tryParse(item['total']?.toString() ?? '') ??
                            (num.tryParse(
                                      item['unitPrice']?.toString() ?? '',
                                    ) ??
                                    0) *
                                (num.tryParse(
                                      item['quantity']?.toString() ?? '',
                                    ) ??
                                    1),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const Divider(height: 28),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.paid ? 'Paid' : 'Total to pay',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      formatUgx(order.total),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
              ),
              if (order.canPay)
                FilledButton(
                  onPressed: () async {
                    final paid = await showCommercePayment(
                      context,
                      endpoint:
                          '/payments/orders/${Uri.encodeComponent(order.id)}/pay',
                      amount: order.total,
                      title: 'Pay for ${order.reference}',
                    );
                    if (paid == true) ref.invalidate(myOrdersProvider);
                  },
                  child: const Text('Pay now'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            order.paid
                ? 'Payment received'
                : order.canPay
                ? 'Seller accepted. You can now pay securely.'
                : order.paymentMethod == 'online'
                ? (order.paymentStatus == 'closed'
                      ? 'Closed · you were not charged'
                      : 'Waiting for seller acceptance · no payment taken')
                : order.fulfillment['method'] == 'pickup'
                ? 'Cash on pickup'
                : 'Cash on delivery',
            style: TextStyle(fontSize: 12, color: c.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.location_on_outlined, size: 18, color: c.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.fulfillment['method'] == 'pickup'
                      ? 'Pickup · arrange collection with the seller'
                      : order.fulfillment['address']?.toString() ??
                            'Delivery details with the seller',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          const Divider(height: 28),
          Text(
            'Quotations & receipts',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (order.documents.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                order.paid
                    ? 'Your receipt will appear here when issued.'
                    : 'A quotation will appear here when issued.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          for (final doc in order.documents)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined),
              title: Text(
                '${doc['type'] == 'receipt' ? 'Receipt' : 'Quotation'} ${doc['number'] ?? ''}',
                style: const TextStyle(fontSize: 13),
              ),
              subtitle: Text(
                '${doc['status'] == 'superseded' ? 'Replaced · ' : ''}Revision ${doc['revision'] ?? 1}${doc['emailedAt'] != null ? ' · emailed to ${doc['emailedTo'] ?? 'you'}' : ''}',
                style: const TextStyle(fontSize: 10),
              ),
              trailing: const Icon(Icons.open_in_new, size: 18),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OrderPdfScreen(document: doc),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class OrderPdfScreen extends ConsumerStatefulWidget {
  const OrderPdfScreen({super.key, required this.document});
  final Map<String, dynamic> document;
  @override
  ConsumerState<OrderPdfScreen> createState() => _OrderPdfScreenState();
}

class _OrderPdfScreenState extends ConsumerState<OrderPdfScreen> {
  late Future<Uint8List> _bytes;
  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _bytes = ref
        .read(apiClientProvider)
        .getPdf(
          '/documents/${Uri.encodeComponent(widget.document['id'].toString())}/pdf',
        );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        '${widget.document['type'] ?? 'Document'} ${widget.document['number'] ?? ''}',
      ),
    ),
    body: FutureBuilder<Uint8List>(
      future: _bytes,
      builder: (context, snapshot) {
        if (snapshot.hasError)
          return CommerceEmpty(
            title: 'Couldn’t open this document',
            message: '${snapshot.error}',
            action: 'Try again',
            onAction: () => setState(_load),
          );
        if (!snapshot.hasData)
          return const Center(child: CircularProgressIndicator());
        return PdfViewer.data(
          snapshot.data!,
          sourceName: '${widget.document['id']}.pdf',
        );
      },
    ),
  );
}
