import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../theme.dart';
import '../services/api_client.dart';
import '../services/upload_service.dart';

class PendingScreen extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic> driver;
  final bool isRejected;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  const PendingScreen({
    super.key,
    required this.api,
    required this.driver,
    required this.isRejected,
    required this.onRefresh,
    required this.onLogout,
  });

  @override
  State<PendingScreen> createState() => _PendingScreenState();
}

class _PendingScreenState extends State<PendingScreen> {
  bool _resubmitting = false;
  String? _error;

  Future<void> _resubmitPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 80, maxWidth: 1600);
    if (picked == null) return;
    setState(() {
      _resubmitting = true;
      _error = null;
    });
    try {
      final url = await UploadService(widget.api).uploadFile(File(picked.path));
      await widget.api.request('/rides/drivers/me', method: 'PATCH', body: {'licensePhotoUrl': url});
      widget.onRefresh();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _resubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reason = widget.driver['rejectionReason'] as String?;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gabla Driver'),
        actions: [IconButton(onPressed: widget.onLogout, icon: const Icon(Icons.logout))],
      ),
      body: RefreshIndicator(
        onRefresh: () async => widget.onRefresh(),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(28),
            children: [
              const SizedBox(height: 32),
              Center(
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: widget.isRejected ? GablaColors.dangerBg : const Color(0xFFFEF3C7),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    widget.isRejected ? Icons.error_outline_rounded : Icons.hourglass_top_rounded,
                    color: widget.isRejected ? GablaColors.danger : const Color(0xFFB45309),
                    size: 40,
                  ),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                widget.isRejected ? 'Application rejected' : 'Application under review',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: GablaColors.navy),
              ),
              const SizedBox(height: 10),
              Text(
                widget.isRejected
                    ? 'The Gabla team couldn\'t approve your application.'
                    : 'We\'re reviewing your permit photo and vehicle details. This usually takes a short while.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: GablaColors.textMuted, fontSize: 14, height: 1.5),
              ),
              if (widget.isRejected && reason != null && reason.isNotEmpty) ...[
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: GablaColors.dangerBg, borderRadius: BorderRadius.circular(12)),
                  child: Text(reason, style: const TextStyle(color: GablaColors.danger, fontSize: 13, height: 1.4)),
                ),
              ],
              const SizedBox(height: 28),
              if (_error != null) ...[
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: GablaColors.danger, fontSize: 13)),
                const SizedBox(height: 12),
              ],
              if (widget.isRejected)
                ElevatedButton.icon(
                  onPressed: _resubmitting ? null : _resubmitPhoto,
                  icon: _resubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                      : const Icon(Icons.camera_alt_outlined),
                  label: Text(_resubmitting ? 'Uploading…' : 'Retake permit photo'),
                ),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: widget.onRefresh, child: const Text('Check again')),
            ],
          ),
        ),
      ),
    );
  }
}
