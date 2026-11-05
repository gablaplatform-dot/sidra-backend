import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/workspace_providers.dart';
import 'workspace_screen.dart';
import 'workspace_form.dart';

const _sectionNames = {
  'brand': 'Business identity',
  'quotation': 'Quotations',
  'receipt': 'Receipts',
  'tax': 'Tax',
  'payment': 'Payment details',
  'options': 'Document appearance',
  'email': 'Email delivery',
};
String _label(String key) => key
    .replaceAllMapped(RegExp(r'([A-Z])'), (m) => ' ${m[1]!.toLowerCase()}')
    .replaceFirstMapped(RegExp(r'^.'), (m) => m[0]!.toUpperCase());

class DocumentDesignScreen extends ConsumerWidget {
  const DocumentDesignScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: const CommerceAppBar(title: 'Document studio'),
    body: AsyncValueView(
      value: ref.watch(workspaceDataProvider('/documents/settings')),
      onRetry: () =>
          ref.invalidate(workspaceDataProvider('/documents/settings')),
      data: (context, response) {
        final settings = Map<String, dynamic>.from(
          response['settings'] as Map? ?? {},
        );
        Future<void> save(String key, Map<String, dynamic> changes) async {
          await ref
              .read(apiClientProvider)
              .put('/documents/settings', body: {key: changes});
          ref.invalidate(workspaceDataProvider('/documents/settings'));
        }

        return ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              'Your business.\nOn every page.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 12),
            const Text(
              'Customize the quotations and receipts customers receive from your store.',
            ),
            const SizedBox(height: 24),
            for (final entry in _sectionNames.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  onTap: () {
                    final values = Map<String, dynamic>.from(
                      settings[entry.key] as Map? ?? {},
                    );
                    showWorkspaceForm(
                      context,
                      title: entry.value,
                      fields: [
                        for (final f in values.entries)
                          WorkspaceField(
                            f.key,
                            _label(f.key),
                            value: f.value,
                            type: f.value is bool
                                ? 'bool'
                                : f.value is num
                                ? 'number'
                                : [
                                    'terms',
                                    'intro',
                                    'instructions',
                                    'bankDetails',
                                    'thankYou',
                                    'footerNote',
                                  ].contains(f.key)
                                ? 'long'
                                : 'text',
                          ),
                      ],
                      save: (next) async {
                        final patch = {
                          for (final f in next.entries)
                            if (values[f.key] != f.value) f.key: f.value,
                        };
                        if (patch.isNotEmpty) await save(entry.key, patch);
                      },
                    );
                  },
                  child: CommercePanel(
                    child: Row(
                      children: [
                        Icon(switch (entry.key) {
                          'brand' => Icons.storefront_outlined,
                          'tax' => Icons.percent,
                          'email' => Icons.mail_outline,
                          'payment' => Icons.payments_outlined,
                          _ => Icons.description_outlined,
                        }),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Text(
                            entry.value,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
                ),
              ),
            MediaUploadButton(
              video: false,
              folder: 'document-logo',
              label: 'Upload document logo',
              onUploaded: (url) async {
                try {
                  await save('brand', {'logoUrl': url});
                } catch (e) {
                  if (context.mounted)
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text('$e')));
                }
              },
            ),
            const CommerceTitle('Preview your documents'),
            for (final type in ['quotation', 'receipt'])
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => WorkspacePdfScreen(
                        title: '${_label(type)} preview',
                        path: '/documents/preview',
                        body: {'type': type, 'settings': settings},
                      ),
                    ),
                  ),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: Text('Preview saved $type'),
                ),
              ),
          ],
        );
      },
    ),
  );
}

class PromotionCreateScreen extends ConsumerStatefulWidget {
  const PromotionCreateScreen({super.key});
  @override
  ConsumerState<PromotionCreateScreen> createState() =>
      _PromotionCreateScreenState();
}

class _PromotionCreateScreenState extends ConsumerState<PromotionCreateScreen> {
  final _title = TextEditingController(), _subtitle = TextEditingController();
  String? _url, _error;
  bool _busy = false;
  @override
  void dispose() {
    _title.dispose();
    _subtitle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const CommerceAppBar(title: 'New promotion'),
    body: ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(
          'Give your business\na moment to shine.',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 18),
        const Text(
          'Add a photo or video, then write a clear headline. Your promotion will be reviewed before it appears on Gabla.',
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _title,
          maxLength: 200,
          decoration: const InputDecoration(labelText: 'Headline'),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _subtitle,
          maxLength: 400,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Supporting text (optional)',
          ),
        ),
        MediaUploadButton(
          folder: 'provider-ads',
          onUploaded: (u) => setState(() => _url = u),
        ),
        if (_url != null)
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                const Icon(Icons.check_circle_outline),
                const SizedBox(width: 12),
                const Expanded(child: Text('Media ready for your promotion')),
              ],
            ),
          ),
        if (_error != null)
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _busy
              ? null
              : () async {
                  if (_title.text.trim().isEmpty || _url == null) {
                    setState(
                      () => _error = 'Add a headline and a photo or video.',
                    );
                    return;
                  }
                  setState(() {
                    _busy = true;
                    _error = null;
                  });
                  try {
                    final video = RegExp(
                      r'\.(mp4|webm|mov)(\?|$)',
                      caseSensitive: false,
                    ).hasMatch(_url!);
                    await ref
                        .read(apiClientProvider)
                        .post(
                          '/promotions/mine',
                          body: {
                            'title': _title.text.trim(),
                            'subtitle': _subtitle.text.trim().isEmpty
                                ? null
                                : _subtitle.text.trim(),
                            'imageUrl': video ? null : _url,
                            'videoUrl': video ? _url : null,
                          },
                        );
                    ref.invalidate(workspaceDataProvider('/promotions/mine'));
                    if (mounted) Navigator.pop(context);
                  } catch (e) {
                    if (mounted)
                      setState(() {
                        _busy = false;
                        _error = '$e';
                      });
                  }
                },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Text(_busy ? 'Submitting…' : 'Submit for review'),
          ),
        ),
      ],
    ),
  );
}
