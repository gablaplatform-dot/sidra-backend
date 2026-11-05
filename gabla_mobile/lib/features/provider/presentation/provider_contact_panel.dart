import '../../../core/location/google_route_map.dart';
import '../../ride/domain/ride_location.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/provider_providers.dart';

class ProviderContactPanel extends ConsumerWidget {
  const ProviderContactPanel({super.key, required this.providerId});
  final String providerId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = ref.watch(providerDetailProvider(providerId));
    return provider.when(
      loading: () => const CommerceLoading(rows: 1),
      error: (_, _) => TextButton(
        onPressed: () => ref.invalidate(providerDetailProvider(providerId)),
        child: const Text('Reload seller contact'),
      ),
      data: (p) {
        final locked = p['contactLocked'] == true;
        final contact = Map<String, dynamic>.from(p['contact'] as Map? ?? {});
        final location = Map<String, dynamic>.from(p['location'] as Map? ?? {});
        Future<void> open(String type, String raw, String value) async {
          final uri = Uri.tryParse(value);
          if (uri == null ||
              !['https', 'http', 'tel', 'mailto'].contains(uri.scheme))
            return;
          try {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
            ref
                .read(apiClientProvider)
                .post(
                  '/engagement/providers/$providerId/contact-events',
                  body: {'type': type, 'value': raw},
                )
                .catchError((_) => null);
          } catch (e) {
            if (context.mounted)
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Could not open this contact: $e')),
              );
          }
        }

        Widget line(
          IconData icon,
          String label,
          String value,
          String type,
          String href,
        ) => ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          title: Text(label, style: Theme.of(context).textTheme.labelSmall),
          subtitle: Text(value),
          onTap: () => open(type, value, href),
          trailing: IconButton(
            tooltip: 'Copy $label',
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: value));
              if (context.mounted)
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text('$label copied')));
            },
            icon: const Icon(Icons.copy_outlined, size: 17),
          ),
        );
        final geo = location['geo'] as Map?;
        final coords = geo?['coordinates'] as List?;
        final directions = coords != null && coords.length >= 2
            ? 'https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}'
            : location['address'] != null
            ? 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(location['address'].toString())}'
            : null;
        return CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommerceTitle(
                locked ? 'Contact access' : 'Contact & location',
                subtitle: p['businessName']?.toString(),
              ),
              if (locked) ...[
                const Text(
                  'This provider’s contact details are locked. Review the access fee below before continuing.',
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  icon: const Icon(Icons.lock_open_outlined, size: 18),
                  onPressed: () async {
                    final success = await showCommercePayment(
                      context,
                      endpoint: '/payments/contacts/unlock',
                      providerId: providerId,
                      amount:
                          double.tryParse(p['contactFee']?.toString() ?? '') ??
                          0,
                      title: 'Unlock contact',
                    );
                    if (success == true)
                      ref.invalidate(providerDetailProvider(providerId));
                  },
                  label: Text(
                    'Unlock · ${formatUgx(double.tryParse(p['contactFee']?.toString() ?? '') ?? 0)}',
                  ),
                ),
              ] else ...[
                if (contact['phone'] != null &&
                    contact['phone'].toString().isNotEmpty)
                  line(
                    Icons.call_outlined,
                    'Phone',
                    contact['phone'].toString(),
                    'call',
                    'tel:${contact['phone']}',
                  ),
                if (contact['whatsapp'] != null &&
                    contact['whatsapp'].toString().isNotEmpty)
                  line(
                    Icons.chat_bubble_outline,
                    'WhatsApp',
                    contact['whatsapp'].toString(),
                    'whatsapp',
                    'https://wa.me/${contact['whatsapp'].toString().replaceAll(RegExp(r'\D'), '')}',
                  ),
                if (contact['email'] != null)
                  line(
                    Icons.mail_outline,
                    'Email',
                    contact['email'].toString(),
                    'email',
                    'mailto:${contact['email']}',
                  ),
                if (contact['website'] != null)
                  line(
                    Icons.language,
                    'Website',
                    contact['website'].toString(),
                    'website',
                    contact['website'].toString().startsWith('http')
                        ? contact['website'].toString()
                        : 'https://${contact['website']}',
                  ),
                if (location['address'] != null)
                  Text(location['address'].toString()),
                if (coords != null && coords.length >= 2) ...[
                  const SizedBox(height: 12),
                  GoogleRouteMap(
                    from: RideLocation(
                      lat: (coords[1] as num).toDouble(),
                      lng: (coords[0] as num).toDouble(),
                      address:
                          location['address']?.toString() ?? 'Seller location',
                    ),
                    fromLabel: 'Seller location',
                    height: 160,
                  ),
                ],
                if (directions != null)
                  TextButton.icon(
                    onPressed: () => open('directions', '', directions),
                    icon: const Icon(Icons.directions_outlined),
                    label: const Text('Get directions'),
                  ),
                if (contact.isEmpty && location['address'] == null)
                  const Text('No public contact details have been supplied.'),
              ],
            ],
          ),
        );
      },
    );
  }
}
