import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfrx/pdfrx.dart';
import '../../../core/discovery/discovery_widgets.dart';
import '../../../core/location/google_place_picker.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/media/sound_video_screen.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../orders/presentation/my_orders_screen.dart';
import '../../payments/presentation/payment_sheet.dart';
import '../../provider/domain/provider_summary.dart';
import '../../shop/domain/product.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../shop/presentation/product_gallery.dart';
import '../application/workspace_providers.dart';
import 'workspace_form.dart';

const workspacePaths = {
  'listings': '/listings/me?limit=100',
  'business': '/providers/me',
  'wallet': '/payments/wallet',
  'documents': '/documents?limit=100',
  'orders': '/engagement/provider/orders?limit=50',
  'bookings': '/bookings/provider',
  'categories': '/shop-categories/mine',
  'analytics': '/engagement/provider/analytics?days=30',
  'ads': '/promotions/mine',
  'saved': '/engagement/favorites',
  'inquiries': '/engagement/provider/inquiries?limit=100',
};
const workspaceTitles = {
  'listings': 'My listings',
  'business': 'My business',
  'wallet': 'Wallet',
  'documents': 'Quotes & receipts',
  'orders': 'Seller orders',
  'bookings': 'Service reservations',
  'categories': 'Shop collections',
  'analytics': 'Business insights',
  'ads': 'My promotions',
  'saved': 'Saved businesses',
  'inquiries': 'Customer inquiries',
};

class WorkspaceScreen extends ConsumerStatefulWidget {
  const WorkspaceScreen({super.key, required this.section});
  final String section;
  @override
  ConsumerState<WorkspaceScreen> createState() => _WorkspaceScreenState();
}

class _WorkspaceScreenState extends ConsumerState<WorkspaceScreen> {
  int _analyticsDays = 30;
  String get path => widget.section == 'analytics'
      ? '/engagement/provider/analytics?days=$_analyticsDays'
      : workspacePaths[widget.section] ?? '/providers/me';
  void reload() => ref.invalidate(workspaceDataProvider(path));
  Future<void> run(Future<void> Function() action) async {
    try {
      await action();
      if (mounted) {
        reload();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Changes saved.')));
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(workspaceErrorMessage(e))));
    }
  }

  Future<bool> confirm(String title) async =>
      await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(title),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Keep it'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Remove'),
            ),
          ],
        ),
      ) ??
      false;
  @override
  Widget build(BuildContext context) {
    final title = workspaceTitles[widget.section] ?? 'My business';
    final signedIn = ref.watch(isSignedInProvider);
    if (!signedIn)
      return Scaffold(
        appBar: AppBar(title: Text(title)),
        body: Center(
          child: CommerceEmpty(
            title: 'Sign in to view $title',
            message: 'Continue with your Gabla account to access this page.',
            action: 'Sign in',
            onAction: () => context.push(
              '/login?next=${Uri.encodeComponent('/profile/${widget.section}')}',
            ),
            icon: Icons.account_circle_outlined,
          ),
        ),
      );
    return Scaffold(
      appBar: CommerceAppBar(
        title: title,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: AsyncValueView(
        value: ref.watch(workspaceDataProvider(path)),
        onRetry: reload,
        data: (context, data) => RefreshIndicator(
          onRefresh: () async => reload(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.all(18),
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                _description,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              ...switch (widget.section) {
                'listings' => _listings(data),
                'business' => _business(Map<String, dynamic>.from(data)),
                'wallet' => _wallet(Map<String, dynamic>.from(data)),
                'documents' => _documents(data),
                'orders' => _orders(data),
                'bookings' => _bookings(data),
                'categories' => _categories(data),
                'analytics' => _analytics(Map<String, dynamic>.from(data)),
                'ads' => _ads(data),
                'saved' => _saved(data),
                'inquiries' => _inquiries(data),
                _ => <Widget>[],
              },
            ],
          ),
        ),
      ),
    );
  }

  String get _description => switch (widget.section) {
    'listings' => 'Your products and services, ready for their next customer.',
    'business' => 'Give customers a clear picture of your business.',
    'wallet' => 'Your balance, subscriptions, payouts and transaction history.',
    'documents' =>
      'Professional quotations and receipts, designed around your business.',
    'orders' => 'Review requests and keep customers updated.',
    'bookings' => 'Manage dates, guests and reservation requests.',
    'categories' => 'Organize your storefront into collections.',
    'analytics' => 'See how customers discover and engage with your business.',
    'ads' => 'Manage photo and video promotions and check their review status.',
    'inquiries' => 'Read customer messages and update their status.',
    'saved' => 'Find the businesses you have saved.',
    _ => 'Manage your business details.',
  };
  List<Widget> _listings(dynamic data) => [
    FilledButton.icon(
      onPressed: () => context.push('/profile/listings/new'),
      icon: const Icon(Icons.add),
      label: const Text('Create a listing'),
    ),
    const SizedBox(height: 18),
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'Your storefront starts here',
        message: 'Add your first product or service using the button above.',
        icon: Icons.storefront_outlined,
      ),
    for (final row in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListingDiscoveryCard(product: Product.fromJson(row)),
              Text(
                '${row['status'] ?? 'Pending review'}',
                style: const TextStyle(fontSize: 12),
              ),
              Wrap(
                spacing: 8,
                children: [
                  TextButton.icon(
                    onPressed: () =>
                        context.push('/profile/listings/${row['id']}/edit'),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit'),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      if (await confirm('Remove ${row['name']}?'))
                        run(() async {
                          await ref
                              .read(apiClientProvider)
                              .delete('/listings/${row['id']}');
                        });
                    },
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Remove'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _business(Map<String, dynamic> p) {
    final contact = Map<String, dynamic>.from(p['contact'] as Map? ?? {}),
        media = Map<String, dynamic>.from(p['media'] as Map? ?? {});
    final gallery = (media['gallery'] as List? ?? []).map((s) => '$s').toList();
    Future<void> saveMedia(Map<String, dynamic> patch) => run(() async {
      await ref
          .read(apiClientProvider)
          .put(
            '/providers/me',
            body: {
              'media': {...media, ...patch},
            },
          );
    });
    return [
      CommercePanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${p['businessName'] ?? 'Your business'}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (p['description'] != null) Text('${p['description']}'),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => showWorkspaceForm(
                context,
                title: 'Business details',
                fields: [
                  WorkspaceField(
                    'businessName',
                    'Business name',
                    value: p['businessName'],
                    required: true,
                  ),
                  WorkspaceField(
                    'description',
                    'About your business',
                    type: 'long',
                    value: p['description'],
                  ),
                  WorkspaceField('phone', 'Phone', value: contact['phone']),
                  WorkspaceField(
                    'whatsapp',
                    'WhatsApp',
                    value: contact['whatsapp'],
                  ),
                  WorkspaceField(
                    'website',
                    'Website',
                    value: contact['website'],
                  ),
                  WorkspaceField(
                    'onlinePaymentsEnabled',
                    'Accept online payments',
                    type: 'bool',
                    value: p['onlinePaymentsEnabled'] != false,
                  ),
                ],
                save: (v) async {
                  await ref
                      .read(apiClientProvider)
                      .put(
                        '/providers/me',
                        body: {
                          'businessName': v['businessName'],
                          'description': v['description'],
                          'onlinePaymentsEnabled': v['onlinePaymentsEnabled'],
                          'contact': {
                            ...contact,
                            'phone': v['phone'],
                            'whatsapp': v['whatsapp'],
                            'website': '${v['website']}'.isEmpty
                                ? null
                                : v['website'],
                          },
                        },
                      );
                  reload();
                },
              ),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Edit business'),
            ),
            TextButton.icon(
              onPressed: () async {
                final location = await pickGoogleLocation(
                  context,
                  title: 'Choose business location',
                );
                if (location != null)
                  run(() async {
                    await ref
                        .read(apiClientProvider)
                        .put(
                          '/providers/me',
                          body: {
                            'location': {
                              ...?p['location'] as Map?,
                              'address': location.address,
                              'geo': {
                                'type': 'Point',
                                'coordinates': [location.lng, location.lat],
                              },
                            },
                          },
                        );
                  });
              },
              icon: const Icon(Icons.location_on_outlined),
              label: const Text('Set business location on map'),
            ),
          ],
        ),
      ),
      OutlinedButton.icon(
        onPressed: () => _audiences(p),
        icon: const Icon(Icons.public),
        label: const Text('Communities & countries served'),
      ),
      const CommerceTitle('Business photos'),
      MediaUploadButton(
        folder: 'provider-avatar',
        video: false,
        label: 'Update business photo',
        onUploaded: (u) => saveMedia({'avatarUrl': u}),
      ),
      MediaUploadButton(
        folder: 'provider-cover',
        video: false,
        label: 'Update cover photo',
        onUploaded: (u) => saveMedia({'coverUrl': u}),
      ),
      const CommerceTitle('Gallery'),
      if (gallery.isEmpty)
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text(
            'No gallery photos or videos yet. Add media to show customers your work.',
          ),
        ),
      if (gallery.isNotEmpty)
        SizedBox(height: 280, child: ProductGallery(images: gallery)),
      MediaUploadButton(
        folder: 'provider-gallery',
        onUploaded: (u) => saveMedia({
          'gallery': [...gallery, u],
        }),
      ),
      for (final u in gallery)
        ListTile(
          leading: Icon(
            isVideoUrl(u) ? Icons.videocam_outlined : Icons.image_outlined,
          ),
          title: Text('Gallery item ${gallery.indexOf(u) + 1}'),
          trailing: IconButton(
            tooltip: 'Remove media',
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              if (await confirm('Remove this gallery item?'))
                saveMedia({'gallery': gallery.where((v) => v != u).toList()});
            },
          ),
        ),
    ];
  }

  Future<void> _audiences(Map<String, dynamic> provider) async {
    try {
      final catalog = await ref
          .read(apiClientProvider)
          .get<Map<String, dynamic>>('/audiences');
      if (!mounted) return;
      final selected = {
        for (final a in provider['audiences'] as List? ?? []) '${a['id']}',
      };
      final suggestion = TextEditingController();
      String kind = 'culture';
      bool busy = false;
      String? error;
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (sheet) => StatefulBuilder(
          builder: (context, update) => Padding(
            padding: EdgeInsets.fromLTRB(
              22,
              8,
              22,
              MediaQuery.viewInsetsOf(context).bottom + 22,
            ),
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * .72,
              child: ListView(
                children: [
                  Text(
                    'Communities you serve',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 18),
                  for (final group in ['countries', 'cultures']) ...[
                    Text(
                      group == 'countries' ? 'Countries' : 'Cultures',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final audience in catalog[group] as List? ?? [])
                          FilterChip(
                            label: Text('${audience['name']}'),
                            selected: selected.contains('${audience['id']}'),
                            onSelected: busy
                                ? null
                                : (value) => update(() {
                                    if (value) {
                                      selected.add('${audience['id']}');
                                    } else {
                                      selected.remove('${audience['id']}');
                                    }
                                  }),
                          ),
                      ],
                    ),
                    const SizedBox(height: 18),
                  ],
                  DropdownButtonFormField<String>(
                    initialValue: kind,
                    decoration: const InputDecoration(
                      labelText: 'Suggest a missing community',
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'culture',
                        child: Text('Culture'),
                      ),
                      DropdownMenuItem(
                        value: 'country',
                        child: Text('Country'),
                      ),
                    ],
                    onChanged: busy ? null : (v) => kind = v ?? 'culture',
                  ),
                  TextField(
                    controller: suggestion,
                    enabled: !busy,
                    maxLength: 60,
                    decoration: const InputDecoration(
                      labelText: 'Community name (optional)',
                    ),
                  ),
                  if (error != null)
                    Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () async {
                            update(() => busy = true);
                            try {
                              await ref
                                  .read(apiClientProvider)
                                  .put(
                                    '/providers/me',
                                    body: {
                                      'audienceIds': selected.toList(),
                                      if (suggestion.text.trim().isNotEmpty)
                                        'newAudiences': [
                                          {
                                            'kind': kind,
                                            'name': suggestion.text.trim(),
                                          },
                                        ],
                                    },
                                  );
                              reload();
                              if (sheet.mounted) Navigator.pop(sheet);
                            } catch (e) {
                              if (sheet.mounted)
                                update(() {
                                  busy = false;
                                  error = workspaceErrorMessage(e);
                                });
                            }
                          },
                    child: Text(busy ? 'Saving…' : 'Save communities'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      suggestion.dispose();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(workspaceErrorMessage(e))));
    }
  }

  List<Widget> _wallet(Map<String, dynamic> wallet) => [
    CommercePanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.account_balance_wallet_outlined, size: 32),
          const SizedBox(height: 20),
          const Text('Available balance'),
          Text(
            formatUgx(num.tryParse('${wallet['balance'] ?? 0}')),
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => showWorkspaceForm(
              context,
              title: 'Request a withdrawal',
              action: 'Request withdrawal',
              fields: const [
                WorkspaceField(
                  'amount',
                  'Amount (UGX)',
                  type: 'number',
                  required: true,
                ),
                WorkspaceField('note', 'Note (optional)'),
              ],
              save: (v) async {
                if ((v['amount'] as num? ?? 0) <= 0)
                  throw StateError('Enter an amount greater than zero.');
                await ref
                    .read(apiClientProvider)
                    .post('/payments/withdrawals', body: v);
                ref.invalidate(
                  workspaceDataProvider('/payments/withdrawals?limit=100'),
                );
                reload();
              },
            ),
            child: const Text('Request withdrawal'),
          ),
        ],
      ),
    ),
    const CommerceTitle('Subscription'),
    _remote(
      '/payments/subscription',
      (d) => CommercePanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Status · ${d['status'] ?? 'inactive'}'),
            Text(
              'Subscription fee · ${formatUgx(num.tryParse('${d['fee'] ?? 0}'))}',
            ),
            if (d['expiresAt'] != null) Text('Until ${d['expiresAt']}'),
            if (d['enabled'] == true)
              TextButton(
                onPressed: () async {
                  await showCommercePayment(
                    context,
                    endpoint: '/payments/subscriptions/activate',
                    amount: double.tryParse('${d['fee'] ?? 0}') ?? 0,
                    title: 'Business subscription',
                  );
                  ref.invalidate(
                    workspaceDataProvider('/payments/subscription'),
                  );
                },
                child: const Text('Activate or renew'),
              ),
          ],
        ),
      ),
    ),
    const CommerceTitle('Withdrawal history'),
    _remote(
      '/payments/withdrawals?limit=100',
      (d) => _history(d, 'No withdrawal requests yet.'),
    ),
    const CommerceTitle('Transactions'),
    _remote(
      '/payments/transactions?limit=100',
      (d) => _history(d, 'Your transactions will appear here.'),
    ),
  ];
  Widget _history(dynamic data, String empty) => workspaceItems(data).isEmpty
      ? CommercePanel(child: Text(empty))
      : Column(
          children: [
            for (final r in workspaceItems(data))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.receipt_long_outlined),
                title: Text(formatUgx(num.tryParse('${r['amount'] ?? 0}'))),
                subtitle: Text(
                  '${r['type'] ?? r['reference'] ?? r['note'] ?? ''}',
                ),
                trailing: Text('${r['status'] ?? ''}'),
              ),
          ],
        );
  Widget _remote(String endpoint, Widget Function(dynamic) builder) =>
      AsyncValueView(
        value: ref.watch(workspaceDataProvider(endpoint)),
        onRetry: () => ref.invalidate(workspaceDataProvider(endpoint)),
        data: (context, data) => builder(data),
      );
  List<Widget> _documents(dynamic data) => [
    FilledButton.icon(
      onPressed: () => context.push('/profile/document-design'),
      icon: const Icon(Icons.design_services_outlined),
      label: const Text('Design quotes & receipts'),
    ),
    const SizedBox(height: 18),
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'No quotes or receipts yet',
        message:
            'Quotations and receipts issued for your orders will be kept here.',
        icon: Icons.description_outlined,
      ),
    for (final d in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${d['type']} · ${d['number']}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                '${d['emailStatus'] ?? 'Not emailed'}',
                style: const TextStyle(fontSize: 12),
              ),
              Wrap(
                spacing: 8,
                children: [
                  TextButton.icon(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OrderPdfScreen(document: d),
                      ),
                    ),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Open PDF'),
                  ),
                  TextButton.icon(
                    onPressed: () => run(() async {
                      await ref
                          .read(apiClientProvider)
                          .post('/documents/${d['id']}/resend', body: {});
                    }),
                    icon: const Icon(Icons.mail_outline),
                    label: const Text('Resend email'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _orders(dynamic data) => [
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'No customer orders yet',
        message:
            'New customer orders will arrive here. Keep your listings up to date.',
        icon: Icons.shopping_bag_outlined,
      ),
    for (final o in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: InkWell(
          onTap: () => context.push('/profile/orders/${o['id']}'),
          child: CommercePanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${(o['customer'] as Map?)?['name'] ?? 'Customer order'}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  '${o['status']} · ${formatUgx(num.tryParse('${o['total']}'))}',
                ),
                const SizedBox(height: 10),
                const Text('Review order →'),
              ],
            ),
          ),
        ),
      ),
  ];
  List<Widget> _bookings(dynamic data) => [
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'No reservations yet',
        message: 'Publish a bookable service to start receiving requests.',
        icon: Icons.event_available_outlined,
      ),
    for (final b in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${(b['listing'] as Map?)?['name'] ?? 'Reservation'}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('${b['startDate']} → ${b['endDate'] ?? b['startDate']}'),
              Text(
                '${b['status']} · ${formatUgx(num.tryParse('${b['total']}'))}',
              ),
              Text(
                '${(b['customer'] as Map?)?['name'] ?? ''} · ${(b['customer'] as Map?)?['phone'] ?? ''}',
              ),
              Wrap(
                children: [
                  for (final action
                      in b['status'] == 'pending'
                          ? ['accept', 'decline']
                          : b['status'] == 'confirmed'
                          ? ['complete', 'cancel']
                          : <String>[])
                    TextButton(
                      onPressed: () => showWorkspaceForm(
                        context,
                        title:
                            '${action[0].toUpperCase()}${action.substring(1)} booking',
                        action: action[0].toUpperCase() + action.substring(1),
                        fields: const [
                          WorkspaceField(
                            'note',
                            'Note to customer',
                            type: 'long',
                          ),
                        ],
                        save: (v) async {
                          await ref
                              .read(apiClientProvider)
                              .patch(
                                '/bookings/provider/${b['id']}',
                                body: {'action': action, 'note': v['note']},
                              );
                          reload();
                        },
                      ),
                      child: Text(
                        action[0].toUpperCase() + action.substring(1),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _categories(dynamic data) {
    final items = <Map<String, dynamic>>[];
    void flatten(List<Map<String, dynamic>> nodes) {
      for (final n in nodes) {
        items.add(n);
        flatten(workspaceItems(n['children']));
      }
    }

    flatten(workspaceItems(data));
    return [
      FilledButton.icon(
        onPressed: () => showWorkspaceForm(
          context,
          title: 'New shop collection',
          fields: const [
            WorkspaceField('name', 'Collection name', required: true),
          ],
          save: (v) async {
            await ref
                .read(apiClientProvider)
                .post('/shop-categories', body: {...v, 'parentId': null});
            reload();
          },
        ),
        icon: const Icon(Icons.add),
        label: const Text('Create collection'),
      ),
      if (items.isEmpty)
        const CommerceEmpty(
          title: 'No collections yet',
          message:
              'Group your products into collections customers can explore.',
          icon: Icons.category_outlined,
        ),
      for (final row in items)
        ListTile(
          title: Text('${row['name']}'),
          leading: const Icon(Icons.folder_outlined),
          trailing: PopupMenuButton<String>(
            onSelected: (action) async {
              if (action == 'remove') {
                if (await confirm('Remove this collection?'))
                  run(() async {
                    await ref
                        .read(apiClientProvider)
                        .delete('/shop-categories/${row['id']}');
                  });
              } else {
                showWorkspaceForm(
                  context,
                  title: action == 'child'
                      ? 'Add subcollection'
                      : 'Rename collection',
                  fields: [
                    WorkspaceField(
                      'name',
                      'Collection name',
                      required: true,
                      value: action == 'child' ? '' : row['name'],
                    ),
                  ],
                  save: (v) async {
                    if (action == 'child') {
                      await ref
                          .read(apiClientProvider)
                          .post(
                            '/shop-categories',
                            body: {...v, 'parentId': row['id']},
                          );
                    } else {
                      await ref
                          .read(apiClientProvider)
                          .patch('/shop-categories/${row['id']}', body: v);
                    }
                    reload();
                  },
                );
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'rename', child: Text('Rename')),
              PopupMenuItem(value: 'child', child: Text('Add subcollection')),
              PopupMenuItem(value: 'remove', child: Text('Remove')),
            ],
          ),
        ),
    ];
  }

  List<Widget> _analytics(Map<String, dynamic> data) {
    final totals = data['totals'] as Map? ?? {};
    final daily = (data['dailyVisits'] as List? ?? [])
        .whereType<Map>()
        .toList();
    return [
      Wrap(
        spacing: 8,
        children: [
          for (final days in [7, 30, 90])
            ChoiceChip(
              label: Text('$days days'),
              selected: _analyticsDays == days,
              onSelected: (_) => setState(() => _analyticsDays = days),
            ),
        ],
      ),
      const SizedBox(height: 20),
      Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final entry in {
            'profileViews': 'Profile views',
            'listingViews': 'Listing views',
            'contactUnlocks': 'Contact unlocks',
            'orders': 'Orders',
            'favorites': 'Saved by customers',
          }.entries)
            SizedBox(
              width: (MediaQuery.sizeOf(context).width - 48) / 2,
              child: CommercePanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${totals[entry.key] ?? 0}',
                      style: Theme.of(context).textTheme.headlineLarge,
                    ),
                    Text(entry.value, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            ),
        ],
      ),
      const CommerceTitle('Profile visits over time'),
      if (daily.isNotEmpty)
        CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 130,
                child: CustomPaint(
                  painter: _ActivityPainter([
                    for (final d in daily) (d['count'] as num? ?? 0).toDouble(),
                  ], Theme.of(context).colorScheme.primary),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${daily.first['date']}',
                      style: const TextStyle(fontSize: 10),
                    ),
                  ),
                  Text(
                    '${daily.last['date']}',
                    style: const TextStyle(fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
        )
      else
        const CommercePanel(
          child: Text(
            'Your visits will appear here as customers discover your business.',
          ),
        ),
      for (final entry in {
        'contactEventsByType': 'How customers connect',
        'topListings': 'Your most viewed listings',
      }.entries)
        if ((data[entry.key] as List? ?? []).isNotEmpty) ...[
          CommerceTitle(entry.value),
          for (final row in data[entry.key] as List)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${row['name'] ?? row['type'] ?? 'Listing'}'),
              trailing: Text('${row['count'] ?? row['views'] ?? 0}'),
            ),
        ],
    ];
  }

  List<Widget> _ads(dynamic data) => [
    FilledButton.icon(
      onPressed: () => context.push('/profile/promotion-new'),
      icon: const Icon(Icons.add),
      label: const Text('Create promotion'),
    ),
    const SizedBox(height: 16),
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'No promotions yet',
        message:
            'Create an image or video promotion. The team reviews it before publishing.',
        icon: Icons.campaign_outlined,
      ),
    for (final ad in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (ad['videoUrl'] != null)
                TextButton.icon(
                  onPressed: () => openSoundVideo(context, '${ad['videoUrl']}'),
                  icon: const Icon(Icons.play_circle_outline),
                  label: const Text('Play video with sound'),
                )
              else if (ad['imageUrl'] != null)
                SizedBox(
                  height: 160,
                  width: double.infinity,
                  child: CommerceImage('${ad['imageUrl']}'),
                ),
              const SizedBox(height: 12),
              Text(
                '${ad['title']}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('${ad['subtitle'] ?? ''}'),
              Text('${ad['status'] ?? 'Pending review'}'),
              TextButton(
                onPressed: () async {
                  if (await confirm('Remove this promotion?'))
                    run(() async {
                      await ref
                          .read(apiClientProvider)
                          .delete('/promotions/mine/${ad['id']}');
                    });
                },
                child: const Text('Remove'),
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _inquiries(dynamic data) => [
    if (workspaceItems(data).isEmpty)
      const CommerceEmpty(
        title: 'No customer inquiries yet',
        message: 'Questions from customers will appear here.',
        icon: Icons.chat_bubble_outline,
      ),
    for (final item in workspaceItems(data))
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: CommercePanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${item['name'] ?? 'Customer inquiry'}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text('${item['phone'] ?? ''} ${item['email'] ?? ''}'),
              Text('${item['message'] ?? ''}'),
              const SizedBox(height: 12),
              PopupMenuButton<String>(
                onSelected: (status) => run(() async {
                  await ref
                      .read(apiClientProvider)
                      .patch(
                        '/engagement/provider/inquiries/${item['id']}',
                        body: {'status': status},
                      );
                }),
                itemBuilder: (_) => [
                  for (final status in ['new', 'open', 'closed', 'archived'])
                    PopupMenuItem(
                      value: status,
                      child: Text(
                        status[0].toUpperCase() + status.substring(1),
                      ),
                    ),
                ],
                child: Chip(
                  label: Text('Status · ${item['status'] ?? 'new'}'),
                  avatar: const Icon(Icons.edit_outlined, size: 16),
                ),
              ),
            ],
          ),
        ),
      ),
  ];
  List<Widget> _saved(dynamic data) => [
    if (workspaceItems(data).isEmpty)
      CommerceEmpty(
        title: 'No saved businesses yet',
        message: 'Save a business from its profile to find it here later.',
        action: 'Discover businesses',
        onAction: () => context.push('/search'),
        icon: Icons.favorite_border,
      ),
    for (final row in workspaceItems(data))
      ProviderDiscoveryCard(
        provider: ProviderSummary.fromJson(
          Map<String, dynamic>.from(row['provider'] as Map? ?? row),
        ),
      ),
  ];
}

class WorkspacePdfScreen extends ConsumerStatefulWidget {
  const WorkspacePdfScreen({
    super.key,
    required this.title,
    required this.path,
    this.body,
  });
  final String title, path;
  final Object? body;
  @override
  ConsumerState<WorkspacePdfScreen> createState() => _WorkspacePdfScreenState();
}

class _WorkspacePdfScreenState extends ConsumerState<WorkspacePdfScreen> {
  late Future<Uint8List> bytes;
  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() => bytes = ref
      .read(apiClientProvider)
      .getPdf(
        widget.path,
        method: widget.body == null ? 'GET' : 'POST',
        body: widget.body,
      );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: FutureBuilder<Uint8List>(
      future: bytes,
      builder: (context, s) => s.hasError
          ? CommerceEmpty(
              title: 'Could not open this document',
              message: workspaceErrorMessage(
                s.error!,
                fallback:
                    'The document could not be loaded. Check your connection and try again.',
              ),
              action: 'Retry',
              onAction: () => setState(_load),
            )
          : s.hasData
          ? PdfViewer.data(s.data!, sourceName: '${widget.title}.pdf')
          : const Center(child: CircularProgressIndicator()),
    ),
  );
}

class _ActivityPainter extends CustomPainter {
  _ActivityPainter(this.counts, this.color);
  final List<double> counts;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    if (counts.isEmpty) return;
    final max = counts.fold<double>(1, (a, b) => a > b ? a : b);
    final step = size.width / counts.length;
    final paint = Paint()..color = color;
    for (var i = 0; i < counts.length; i++) {
      final h = counts[i] / max * (size.height - 12);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            i * step + 1,
            size.height - h - 1,
            (step - 2).clamp(1, size.width),
            h.clamp(1, size.height),
          ),
          const Radius.circular(3),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ActivityPainter old) =>
      old.counts != counts || old.color != color;
}
