import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/workspace_form.dart';
import '../application/provider_providers.dart';

class ProviderEngagementPanel extends ConsumerWidget {
  const ProviderEngagementPanel({super.key, required this.providerId});
  final String providerId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = '/engagement/providers/$providerId/reviews?limit=50';
    final signedIn = ref.watch(isSignedInProvider);
    final saved = signedIn
        ? ref.watch(workspaceDataProvider('/engagement/favorites')).valueOrNull
        : null;
    final favorite = workspaceItems(
      saved,
    ).any((p) => p['providerId'] == providerId);
    final reviews = ref.watch(workspaceDataProvider(path));
    Future<void> gate(Future<void> Function() action) async {
      if (!signedIn) {
        context.push(
          '/login?next=${Uri.encodeComponent('/provider/$providerId')}',
        );
        return;
      }
      try {
        await action();
      } catch (e) {
        if (context.mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const CommerceTitle('Keep the connection'),
        OutlinedButton.icon(
          onPressed: () => gate(() async {
            final api = ref.read(apiClientProvider);
            if (favorite) {
              await api.delete('/engagement/favorites/$providerId');
            } else {
              await api.post('/engagement/favorites/$providerId');
            }
            ref.invalidate(workspaceDataProvider('/engagement/favorites'));
          }),
          icon: Icon(favorite ? Icons.favorite : Icons.favorite_border),
          label: Text(
            favorite ? 'Saved to your businesses' : 'Save this business',
          ),
        ),
        OutlinedButton.icon(
          onPressed: () => showWorkspaceForm(
            context,
            title: 'Ask this business a question',
            action: 'Send inquiry',
            fields: const [
              WorkspaceField('name', 'Your name', required: true),
              WorkspaceField('phone', 'Phone'),
              WorkspaceField('email', 'Email (optional)', type: 'email'),
              WorkspaceField(
                'message',
                'How can they help?',
                type: 'long',
                required: true,
              ),
            ],
            save: (values) async {
              await ref
                  .read(apiClientProvider)
                  .post(
                    '/engagement/inquiries',
                    body: {
                      'providerId': providerId,
                      'type': 'general',
                      ...{
                        for (final e in values.entries)
                          if ('${e.value ?? ''}'.isNotEmpty) e.key: e.value,
                      },
                    },
                  );
            },
          ),
          icon: const Icon(Icons.chat_bubble_outline),
          label: const Text('Send an inquiry'),
        ),
        CommerceTitle(
          'Customer reviews',
          action: () => gate(() async {
            await showWorkspaceForm(
              context,
              title: 'Share your experience',
              action: 'Post review',
              fields: const [
                WorkspaceField(
                  'rating',
                  'Rating',
                  required: true,
                  options: ['1', '2', '3', '4', '5'],
                  value: '5',
                ),
                WorkspaceField('comment', 'Your review', type: 'long'),
              ],
              save: (v) async {
                await ref
                    .read(apiClientProvider)
                    .post(
                      '/engagement/providers/$providerId/reviews',
                      body: {
                        'rating': int.parse('${v['rating']}'),
                        'comment': v['comment'],
                      },
                    );
                ref.invalidate(workspaceDataProvider(path));
                ref.invalidate(providerDetailProvider(providerId));
              },
            );
          }),
          label: 'Write review',
        ),
        reviews.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => TextButton(
            onPressed: () => ref.invalidate(workspaceDataProvider(path)),
            child: const Text('Reload reviews'),
          ),
          data: (data) => workspaceItems(data).isEmpty
              ? const CommercePanel(
                  child: Text(
                    'Be the first to share your experience with this business.',
                  ),
                )
              : Column(
                  children: [
                    for (final review in workspaceItems(data))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: CommercePanel(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '★ ${review['rating']} · ${(review['user'] as Map?)?['name'] ?? review['userName'] ?? 'Customer'}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text('${review['comment'] ?? ''}'),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
