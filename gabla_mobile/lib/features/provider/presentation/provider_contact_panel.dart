import '../../../core/location/google_route_map.dart';
import '../../ride/domain/ride_location.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/widgets/page_band.dart';
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
        if (locked) {
          final fee = double.tryParse(p['contactFee']?.toString() ?? '') ?? 0;
          return _ContactPass(
            providerName: p['businessName']?.toString(),
            fee: fee,
            style: commerceStyle(ref),
            onUnlock: () async {
              final success = await showCommercePayment(
                context,
                endpoint: '/payments/contacts/unlock',
                providerId: providerId,
                amount: fee,
                title: 'Unlock contact',
              );
              if (success == true && context.mounted) {
                ref.invalidate(providerDetailProvider(providerId));
              }
            },
          );
        }
        return CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommerceTitle(
                'Contact & location',
                subtitle: p['businessName']?.toString(),
              ),
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
                  height: 200,
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
          ),
        );
      },
    );
  }
}

class _ContactPass extends StatelessWidget {
  const _ContactPass({
    required this.providerName,
    required this.fee,
    required this.style,
    required this.onUnlock,
  });

  final String? providerName;
  final double fee;
  final AppThemeStyle style;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final headerColor = switch (style) {
      AppThemeStyle.gabla => c.primaryContainer,
      AppThemeStyle.editorial => c.surfaceContainerHigh,
      AppThemeStyle.discover => c.primaryContainer,
      AppThemeStyle.cinematic => c.surfaceContainerHighest,
      AppThemeStyle.orbit => c.secondaryContainer,
    };
    final ink = switch (style) {
      AppThemeStyle.gabla || AppThemeStyle.discover => c.onPrimaryContainer,
      AppThemeStyle.orbit => c.onSecondaryContainer,
      _ => c.onSurface,
    };
    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Unlock seller contact',
          style: theme.textTheme.titleLarge?.copyWith(
            color: ink,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (providerName?.isNotEmpty == true) ...[
          const SizedBox(height: 4),
          Text(
            providerName!,
            style: theme.textTheme.bodyMedium?.copyWith(color: ink),
          ),
        ],
      ],
    );
    final lock = DecoratedBox(
      decoration: BoxDecoration(
        color: ink.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: SizedBox.square(
        dimension: 48,
        child: Icon(Icons.lock_outline, color: ink),
      ),
    );
    final price = formatUgx(fee);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        border: Border.all(color: c.outlineVariant),
        borderRadius: BorderRadius.circular(commerceRadius(style)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageBand(
            color: headerColor,
            children: [
              if (style == AppThemeStyle.editorial ||
                  style == AppThemeStyle.cinematic) ...[
                Align(alignment: AlignmentDirectional.centerStart, child: lock),
                const SizedBox(height: 10),
                title,
              ] else
                Row(
                  children: [
                    lock,
                    const SizedBox(width: 12),
                    Expanded(child: title),
                  ],
                ),
            ],
          ),
          PageBand(
            color: c.surface,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            children: [
              Text(
                'See the seller’s available contact details and exact location.',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  for (final (icon, label) in [
                    (Icons.call_outlined, 'Contact details'),
                    (Icons.location_on_outlined, 'Seller location'),
                  ])
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 16, color: c.primary),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            label,
                            style: theme.textTheme.labelMedium,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              Divider(height: 28, color: c.outlineVariant),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                runSpacing: 8,
                children: [
                  Text('One-time fee', style: theme.textTheme.labelMedium),
                  Text(
                    price,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: onUnlock,
                icon: const Icon(Icons.lock_open_outlined, size: 18),
                label: const Text('Continue to payment'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
