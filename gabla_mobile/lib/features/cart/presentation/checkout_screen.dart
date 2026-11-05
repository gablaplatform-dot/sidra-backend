import 'delivery_location_field.dart';
import '../../ride/domain/ride_location.dart';
import '../../shop/application/commerce_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/utils/money.dart';
import '../../auth/application/session_controller.dart';
import '../../orders/application/order_providers.dart';
import '../../orders/domain/order_input.dart';
import '../../shop/domain/product.dart';
import '../../shop/application/shop_providers.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/checkout_controller.dart';
import '../application/cart_controller.dart';
import 'cart_screen.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({
    super.key,
    this.quickBuyId,
    this.initialPaymentMethod = 'cash',
  });
  final String? quickBuyId;
  final String initialPaymentMethod;
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _phone = TextEditingController(),
      _address = TextEditingController(),
      _notes = TextEditingController();
  String _fulfillment = 'delivery';
  RideLocation? _point;
  String? _locationSource;
  late String _payment = widget.initialPaymentMethod;
  int _quantity = 1;
  bool _prefilled = false;
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _prefill() {
    if (_prefilled) return;
    final session = ref.read(sessionControllerProvider).valueOrNull;
    if (session != null) {
      _name.text = session.user.name;
      _phone.text = session.user.phone ?? '';
    }
    _prefilled = true;
  }

  @override
  Widget build(BuildContext context) {
    final result = ref.watch(checkoutControllerProvider);
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    if (result.valueOrNull != null)
      return _CheckoutResultView(
        result: result.valueOrNull!,
        payment: _payment,
        onRetry: () => ref.read(checkoutControllerProvider.notifier).reset(),
      );
    final cart = widget.quickBuyId == null
        ? ref.watch(cartControllerProvider)
        : {widget.quickBuyId!: _quantity};
    final AsyncValue<Map<String, Product>> products = widget.quickBuyId == null
        ? ref.watch(cartProductsProvider)
        : ref
              .watch(productDetailProvider(widget.quickBuyId!))
              .whenData((p) => {p.id: p});
    final loading = products.isLoading;
    final entries = products.valueOrNull ?? {};
    _prefill();
    final groupsByProvider = <String, ProviderOrderGroup>{};
    for (final entry in cart.entries) {
      final p = entries[entry.key];
      if (p == null || p.providerId == null) continue;
      final previous = groupsByProvider[p.providerId];
      groupsByProvider[p.providerId!] = ProviderOrderGroup(
        providerId: p.providerId!,
        providerName: p.providerName ?? 'Seller',
        items: [
          ...?previous?.items,
          OrderItemInput(
            listingId: p.id,
            name: p.name,
            quantity: entry.value,
            unitPrice: p.price,
          ),
        ],
      );
    }
    final groups = groupsByProvider.values.toList();
    final total = groups.fold<double>(0, (n, g) => n + g.subtotal);
    final delivery = entries.values.any((p) => p.type == 'product');
    Future<void> submit() async {
      if (!ref.read(isSignedInProvider)) {
        final next =
            '/checkout${widget.quickBuyId != null ? '?buy=${Uri.encodeComponent(widget.quickBuyId!)}&payment=$_payment' : ''}';
        context.push('/login?next=${Uri.encodeComponent(next)}');
        return;
      }
      if (!(_form.currentState?.validate() ?? false) ||
          groups.isEmpty ||
          entries.length != cart.length)
        return;
      await ref
          .read(checkoutControllerProvider.notifier)
          .submit(
            groups: groups,
            paymentMethod: _payment,
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            notes: _notes.text.trim(),
            clearCart: widget.quickBuyId == null,
            fulfillment: delivery
                ? (_fulfillment == 'delivery'
                      ? FulfillmentInput.delivery(
                          address: _address.text.trim(),
                          lat: _point?.lat,
                          lng: _point?.lng,
                          locationSource: _locationSource,
                        )
                      : const FulfillmentInput.pickup())
                : null,
          );
      if (!mounted) return;
      final placed = ref.read(checkoutControllerProvider).valueOrNull;
      if (placed != null)
        for (final g in groups) {
          if (placed.succeededProviderIds.contains(g.providerId))
            for (final item in g.items) {
              trackCommerce(ref, {
                'type': 'order',
                'listingId': item.listingId,
              });
            }
        }
      ref.invalidate(myOrdersProvider);
    }

    return CommerceScaffold(
      appBar: const CommerceAppBar(title: 'Checkout'),
      bottomNavigationBar: cart.isEmpty || products.hasError
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: loading || result.isLoading || groups.isEmpty
                        ? null
                        : submit,
                    child: Text(
                      result.isLoading
                          ? 'Sending to sellers…'
                          : ref.watch(isSignedInProvider)
                          ? 'Send ${groups.length > 1 ? 'orders' : 'order'} · ${formatUgx(total)}'
                          : 'Sign in to place your order',
                    ),
                  ),
                ),
              ),
            ),
      body: cart.isEmpty
          ? CommerceEmpty(
              title: 'Your cart is empty',
              message: 'Add a product before placing an order.',
              onAction: () => context.push('/shop'),
            )
          : loading
          ? const Padding(padding: EdgeInsets.all(20), child: CommerceLoading())
          : products.hasError
          ? CommerceEmpty(
              title: 'Couldn’t prepare checkout',
              message: 'Review your cart and retry unavailable listings.',
              action: 'Back to cart',
              onAction: () => context.pop(),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const CommerceFlowHeader(
                    title: 'Review and send order',
                    message:
                        'No payment is collected now. Each seller reviews their order before payment or collection.',
                    icon: Icons.receipt_long_outlined,
                  ),
                  const CommerceTitle('Order summary'),
                  if (widget.quickBuyId != null)
                    CommercePanel(
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Quantity',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ),
                          QuantityStepper(
                            quantity: _quantity,
                            onChanged: (q) => setState(() => _quantity = q),
                          ),
                        ],
                      ),
                    ),
                  for (final group in groups)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: CommercePanel(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              group.providerName,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const Divider(height: 24),
                            for (final item in group.items)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${item.name} × ${item.quantity}',
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                    ),
                                    Text(
                                      formatUgx(item.quantity * item.unitPrice),
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                            const Divider(),
                            Row(
                              children: [
                                const Expanded(child: Text('Seller total')),
                                Text(
                                  formatUgx(group.subtotal),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (entries.values.any((p) => p.providerId == null))
                    Text(
                      'Some listings have no seller and cannot be ordered.',
                      style: TextStyle(color: c.error),
                    ),
                  if (delivery) ...[
                    const CommerceTitle('Pickup or delivery'),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'pickup',
                          icon: Icon(Icons.storefront_outlined),
                          label: Text('Pickup'),
                        ),
                        ButtonSegment(
                          value: 'delivery',
                          icon: Icon(Icons.local_shipping_outlined),
                          label: Text('Delivery'),
                        ),
                      ],
                      selected: {_fulfillment},
                      onSelectionChanged: (v) =>
                          setState(() => _fulfillment = v.first),
                    ),
                    AnimatedSize(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 280),
                      child: _fulfillment == 'delivery'
                          ? Padding(
                              padding: const EdgeInsets.only(top: 14),
                              child: DeliveryLocationField(
                                controller: _address,
                                onLocated: (point, source) {
                                  _point = point;
                                  _locationSource = source;
                                },
                                onEdited: () {
                                  _point = null;
                                  _locationSource = null;
                                },
                              ),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],
                  const CommerceTitle('Payment method'),
                  for (final method in ['cash', 'online'])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: RadioListTile<String>(
                        value: method,
                        groupValue: _payment,
                        onChanged: (v) => setState(() => _payment = v!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            commerceRadius(style),
                          ),
                          side: BorderSide(
                            color: method == _payment
                                ? c.primary
                                : c.outlineVariant,
                          ),
                        ),
                        title: Text(
                          method == 'cash'
                              ? 'Cash on ${_fulfillment == 'pickup' ? 'pickup' : 'delivery'}'
                              : 'Online after acceptance',
                        ),
                        subtitle: Text(
                          method == 'cash'
                              ? 'Pay the seller when you receive your order.'
                              : 'The seller accepts first. Then pay from My orders.',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                    ),
                  const CommerceTitle('Your details'),
                  TextFormField(
                    controller: _name,
                    autofillHints: const [AutofillHints.name],
                    decoration: const InputDecoration(labelText: 'Full name'),
                    validator: (v) =>
                        v?.trim().isEmpty ?? true ? 'Enter your name.' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                    ),
                    validator: (v) =>
                        (v ?? '').replaceAll(RegExp(r'\D'), '').length < 7
                        ? 'Enter a valid phone number.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _notes,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes to your seller (optional)',
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(
                    'One order is sent to each seller. Delivery arrangements and any delivery cost are confirmed with the seller.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.5,
                      color: c.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
    );
  }
}

class _CheckoutResultView extends StatelessWidget {
  const _CheckoutResultView({
    required this.result,
    required this.payment,
    required this.onRetry,
  });
  final CheckoutResult result;
  final String payment;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => CommerceScaffold(
    appBar: const CommerceAppBar(title: 'Your order requests'),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(
          result.allSucceeded ? Icons.check_circle_outline : Icons.info_outline,
          size: 58,
          color: Theme.of(context).colorScheme.primary,
        ),
        CommerceTitle(
          result.allSucceeded
              ? 'Order requests sent'
              : 'Some orders were not sent',
          subtitle: payment == 'online'
              ? 'You can pay from My orders after each seller accepts.'
              : 'Your seller will confirm pickup or delivery. Pay in cash when you receive your items.',
        ),
        for (final order in result.succeeded)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: CommercePanel(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(order.providerName ?? 'Seller'),
                subtitle: Text(
                  '${order.reference} · ${formatUgx(order.total)}',
                ),
                leading: const Icon(Icons.check),
              ),
            ),
          ),
        for (final name in result.failedProviderNames)
          ListTile(
            title: Text(name),
            subtitle: Text(
              result.failureReasons[name] ??
                  'Could not be sent. Please try again.',
            ),
            leading: const Icon(Icons.error_outline),
          ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () => context.go('/orders'),
          child: const Text('Track my orders'),
        ),
        if (!result.allSucceeded) ...[
          FilledButton(
            onPressed: onRetry,
            child: const Text('Retry remaining orders'),
          ),
          TextButton(
            onPressed: () => context.go('/cart'),
            child: const Text('Return to cart'),
          ),
        ],
        TextButton(
          onPressed: () => context.go('/shop'),
          child: const Text('Keep exploring'),
        ),
      ],
    ),
  );
}
