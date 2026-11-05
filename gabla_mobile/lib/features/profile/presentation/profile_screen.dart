import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/font_group.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).valueOrNull?.user,
        c = Theme.of(context).colorScheme;
    final business = user?.roles.contains('provider') == true,
        operator = user?.roles.contains('bus_operator') == true;
    final entries = [
      (
        'Account details',
        'Your name, photo, phone and district',
        '/welcome',
        Icons.manage_accounts_outlined,
      ),
      (
        'My orders',
        'Purchases and delivery updates',
        '/orders',
        Icons.shopping_bag_outlined,
      ),
      (
        'My bookings',
        'Stays, appointments and experiences',
        '/profile/bookings',
        Icons.event_available_outlined,
      ),
      (
        'Bus tickets',
        'Your next journey and boarding passes',
        '/bus/tickets',
        Icons.confirmation_number_outlined,
      ),
      (
        'Saved businesses',
        'Your trusted people, together',
        '/profile/saved',
        Icons.favorite_border,
      ),
      if (business) ...[
        (
          'Customer inquiries',
          'Questions and messages from customers',
          '/profile/inquiries',
          Icons.chat_bubble_outline,
        ),
        (
          'My business',
          'Profile, contact details and gallery',
          '/profile/business',
          Icons.storefront_outlined,
        ),
        (
          'My listings',
          'Create and manage products & services',
          '/profile/listings',
          Icons.inventory_2_outlined,
        ),
        (
          'Seller orders',
          'Review and fulfill customer orders',
          '/profile/seller-orders',
          Icons.local_shipping_outlined,
        ),
        (
          'Service reservations',
          'Accept and manage customer bookings',
          '/profile/reservations',
          Icons.calendar_month_outlined,
        ),
        (
          'Shop collections',
          'Organize your catalog',
          '/profile/categories',
          Icons.category_outlined,
        ),
        (
          'Business insights',
          'Real customer engagement',
          '/profile/analytics',
          Icons.insights_outlined,
        ),
        (
          'Promotions',
          'Create photo and video campaigns',
          '/profile/ads',
          Icons.campaign_outlined,
        ),
        (
          'Wallet',
          'Balance, subscriptions and payouts',
          '/profile/wallet',
          Icons.account_balance_wallet_outlined,
        ),
        (
          'Quotes & receipts',
          'Documents with your signature',
          '/profile/documents',
          Icons.description_outlined,
        ),
      ],
      if (operator)
        (
          'Operator workspace',
          'Routes, trips and passengers',
          '/bus/operator/dashboard',
          Icons.directions_bus_outlined,
        ),
      (
        'Design Studio',
        'Five designs, colors, fonts and motion',
        '/settings/appearance',
        Icons.tune,
      ),
    ];
    return Scaffold(
      appBar: const CommerceAppBar(title: 'Your space'),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          CommercePanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: c.primaryContainer,
                  child: Text(
                    user?.name.isNotEmpty == true
                        ? user!.name[0].toUpperCase()
                        : 'G',
                    style: TextStyle(fontSize: 28, color: c.onPrimaryContainer),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  user?.name ?? 'Welcome to Gabla',
                  style: AppTypography.of(context).display(size: 30),
                ),
                const SizedBox(height: 8),
                Text(user?.email ?? 'Your next good find starts here.'),
              ],
            ),
          ),
          const SizedBox(height: 22),
          for (final e in entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 5,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    commerceRadius(commerceStyle(ref)),
                  ),
                ),
                tileColor: c.surfaceContainerLow,
                leading: Icon(e.$4, color: c.primary),
                title: Text(
                  e.$1,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(e.$2, style: const TextStyle(fontSize: 11)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push(e.$3),
              ),
            ),
          const SizedBox(height: 18),
          TextButton.icon(
            onPressed: () => context.push('/account/delete'),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Delete account'),
          ),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).signOut();
              if (context.mounted) context.go('/home');
            },
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
