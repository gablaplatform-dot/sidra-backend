import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../../auth/application/session_controller.dart';

/// Mirrors `public_app/src/pages/DeleteAccount.jsx` (`DELETE /auth/me/delete`).
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _confirmDelete() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).delete('/auth/me/delete');
      await ref.read(sessionControllerProvider.notifier).clear();
    } catch (e) {
      setState(() => _error = 'Could not delete the account. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final errorColor = Theme.of(context).colorScheme.error;
    return Scaffold(
      appBar: AppBar(title: const Text('Delete account')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This permanently deletes your Gabla account, listings and order history. This cannot be undone.',
            ),
            const SizedBox(height: 16),
            if (_error != null) Text(_error!, style: TextStyle(color: errorColor)),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: errorColor),
                onPressed: _loading ? null : _confirmDelete,
                child: _loading
                    ? const SizedBox(
                        height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Delete my account'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
