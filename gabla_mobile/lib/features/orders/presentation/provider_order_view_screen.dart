import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/workspace_form.dart';
import 'my_orders_screen.dart';

class ProviderOrderViewScreen extends ConsumerStatefulWidget {
  const ProviderOrderViewScreen({super.key, required this.orderId});
  final String orderId;
  @override
  ConsumerState<ProviderOrderViewScreen> createState() =>
      _ProviderOrderViewScreenState();
}

class _ProviderOrderViewScreenState
    extends ConsumerState<ProviderOrderViewScreen> {
  String get path => '/engagement/provider/orders/${widget.orderId}';
  bool _busy = false;
  String? _error;
  Future<void> _change(String status) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Mark this order $status?'),
        content: Text(
          status == 'fulfilled'
              ? 'Confirm the order was delivered or collected. Cash orders will be recorded as paid.'
              : 'The customer will see this updated order status.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Go back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Update order'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).patch(path, body: {'status': status});
      ref.invalidate(workspaceDataProvider(path));
      ref.invalidate(
        workspaceDataProvider('/engagement/provider/orders?limit=50'),
      );
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const CommerceAppBar(title: 'Customer order'),
    body: AsyncValueView(
      value: ref.watch(workspaceDataProvider(path)),
      onRetry: () => ref.invalidate(workspaceDataProvider(path)),
      data: (context, raw) {
        final order = Map<String, dynamic>.from(raw),
            customer = order['customer'] as Map? ?? {},
            fulfillment = order['fulfillment'] as Map? ?? {};
        final status = '${order['status']}',
            method = '${order['paymentMethod']}';
        final open = ['pending', 'accepted'].contains(status);
        final quote =
            open &&
            ['cash', 'online'].contains(method) &&
            !['paid_cash', 'paid'].contains(order['paymentStatus']);
        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              '${customer['name'] ?? 'Customer order'}',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 10),
            Text(
              'Order ${widget.orderId.substring(widget.orderId.length > 6 ? widget.orderId.length - 6 : 0).toUpperCase()} · $status',
            ),
            const SizedBox(height: 22),
            CommercePanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final item in order['items'] as List? ?? [])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              '${item['quantity']} × ${item['name']}',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            formatUgx(
                              num.tryParse(
                                '${item['total'] ?? (num.tryParse('${item['unitPrice']}') ?? 0) * (item['quantity'] as num? ?? 1)}',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Divider(),
                  Text(
                    formatUgx(num.tryParse('${order['total']}')),
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  Text('$method · ${order['paymentStatus'] ?? ''}'),
                ],
              ),
            ),
            const CommerceTitle('Customer & fulfillment'),
            CommercePanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${customer['name'] ?? ''}'),
                  Text('${customer['phone'] ?? ''}'),
                  if (customer['notes'] != null) Text('${customer['notes']}'),
                  Text('${fulfillment['method'] ?? 'Arrange with customer'}'),
                  if (fulfillment['address'] != null)
                    Text('${fulfillment['address']}'),
                  if (customer['phone'] != null)
                    TextButton.icon(
                      onPressed: () => launchUrl(
                        Uri(scheme: 'tel', path: '${customer['phone']}'),
                      ),
                      icon: const Icon(Icons.phone_outlined),
                      label: const Text('Call customer'),
                    ),
                ],
              ),
            ),
            const CommerceTitle('Update order'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final next in switch (status) {
                  'pending' => ['accepted', 'rejected', 'canceled'],
                  'accepted' => ['delivering', 'fulfilled', 'canceled'],
                  'delivering' => ['fulfilled', 'canceled'],
                  _ => <String>[],
                })
                  FilledButton.tonal(
                    onPressed: _busy ? null : () => _change(next),
                    child: Text(next[0].toUpperCase() + next.substring(1)),
                  ),
              ],
            ),
            if (quote)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: OutlinedButton.icon(
                  onPressed: () => showWorkspaceForm(
                    context,
                    title: 'Prepare quotation',
                    action: 'Issue quotation',
                    fields: const [
                      WorkspaceField(
                        'discount',
                        'Discount amount (UGX)',
                        type: 'number',
                        value: 0,
                      ),
                      WorkspaceField(
                        'deliveryFee',
                        'Delivery fee (UGX)',
                        type: 'number',
                        value: 0,
                      ),
                      WorkspaceField(
                        'validityDays',
                        'Valid for days',
                        type: 'number',
                        value: 14,
                      ),
                      WorkspaceField('note', 'Note to customer', type: 'long'),
                      WorkspaceField(
                        'send',
                        'Email to customer',
                        type: 'bool',
                        value: true,
                      ),
                    ],
                    save: (v) async {
                      await ref
                          .read(apiClientProvider)
                          .post(
                            '/documents/orders/${widget.orderId}/quotation',
                            body: v,
                          );
                      ref.invalidate(workspaceDataProvider(path));
                    },
                  ),
                  icon: const Icon(Icons.description_outlined),
                  label: const Text('Issue or revise quotation'),
                ),
              ),
            if ((order['documents'] as List? ?? []).isNotEmpty) ...[
              const CommerceTitle('Documents'),
              for (final d in order['documents'] as List)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.picture_as_pdf_outlined),
                  title: Text('${d['type']} ${d['number']}'),
                  trailing: const Icon(Icons.open_in_new),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => OrderPdfScreen(
                        document: Map<String, dynamic>.from(d),
                      ),
                    ),
                  ),
                ),
            ],
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        );
      },
    ),
  );
}
