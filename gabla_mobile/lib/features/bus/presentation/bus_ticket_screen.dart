import 'bus_design_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/config/env.dart';
import '../../../core/theme/style_tokens.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/async_value_view.dart';
import '../application/bus_providers.dart';

class BusTicketScreen extends ConsumerWidget {
  const BusTicketScreen({super.key, required this.ticketNumber});
  final String ticketNumber;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticket = ref.watch(ticketDetailProvider(ticketNumber));
    final c = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bus ticket'),
        actions: [
          IconButton(
            tooltip: 'Refresh ticket',
            onPressed: () => ref.invalidate(ticketDetailProvider(ticketNumber)),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: AsyncValueView(
        value: ticket,
        onRetry: () => ref.invalidate(ticketDetailProvider(ticketNumber)),
        data: (context, t) => SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: c.primary,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(
                      Theme.of(context).extension<StyleTokens>()?.cardRadius ??
                          8,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'BUS TICKET',
                      style: TextStyle(
                        color: c.onPrimary,
                        letterSpacing: 1,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${t.trip.originName}\n→ ${t.trip.destinationName}',
                      style: AppTypography.of(
                        context,
                      ).display(size: 28, color: c.onPrimary),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      t.companyName ?? 'Bus operator',
                      style: TextStyle(color: c.onPrimary),
                    ),
                  ],
                ),
              ),
              BusPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _row(context, 'Passenger', t.passengerName),
                    _row(context, 'Seat', t.seatLabel),
                    _row(
                      context,
                      'Departs · EAT',
                      DateFormat('EEE, d MMM · HH:mm').format(t.departAtEat),
                    ),
                    if (t.boardingPoint != null)
                      _row(context, 'Board at', t.boardingPoint!),
                    if (t.ticketTypeName != null)
                      _row(context, 'Ticket type', t.ticketTypeName!),
                    _row(
                      context,
                      'Status',
                      t.bookingStatus == 'refund_due'
                          ? 'Refund due'
                          : t.status.replaceAll('_', ' '),
                    ),
                    if (t.delayMinutes > 0)
                      _row(context, 'Delay', '${t.delayMinutes} minutes'),
                    const Divider(height: 36),
                    Center(
                      child: Image.network(
                        '${Env.apiBaseUrl}/bus/tickets/${Uri.encodeComponent(t.ticketNumber)}/qr.png',
                        width: 190,
                        height: 190,
                        fit: BoxFit.contain,
                        semanticLabel:
                            'Boarding QR code for ticket ${t.ticketNumber}',
                        loadingBuilder: (_, child, progress) => progress == null
                            ? child
                            : const SizedBox(
                                width: 190,
                                height: 190,
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                        errorBuilder: (_, _, _) => const SizedBox(
                          height: 150,
                          child: Center(
                            child: Text(
                              'QR unavailable. Reconnect, then use Refresh ticket above.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SelectableText(
                      t.ticketNumber,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      t.canBoard
                          ? 'Show this QR to your bus crew when boarding.'
                          : 'This ticket is not valid for boarding.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 3,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}
