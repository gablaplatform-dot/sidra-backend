import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/network/network_providers.dart';

class MediaUploadButton extends ConsumerStatefulWidget {
  const MediaUploadButton({
    super.key,
    required this.onUploaded,
    this.folder = 'listing-media',
    this.label = 'Add photo or video',
    this.video = true,
    this.registerAsset = true,
  });
  final ValueChanged<String> onUploaded;
  final String folder, label;
  final bool video, registerAsset;
  @override
  ConsumerState<MediaUploadButton> createState() => _MediaUploadButtonState();
}

class _MediaUploadButtonState extends ConsumerState<MediaUploadButton> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: _busy
        ? null
        : () async {
            try {
              final picker = ImagePicker();
              final file = widget.video
                  ? await picker.pickMedia()
                  : await picker.pickImage(
                      source: ImageSource.gallery,
                      imageQuality: 90,
                    );
              if (file == null || !mounted) return;
              setState(() => _busy = true);
              final bytes = await file.readAsBytes();
              if (bytes.length > 25 * 1024 * 1024)
                throw StateError('Choose a file smaller than 25 MB.');
              final ext = file.name.split('.').last.toLowerCase();
              final type = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
                'gif': 'image/gif',
                'mp4': 'video/mp4',
              }[ext];
              if (type == null)
                throw StateError('Choose a JPG, PNG, WebP, GIF or MP4 file.');
              if (type.startsWith('image') && bytes.length > 12 * 1024 * 1024)
                throw StateError('Choose an image smaller than 12 MB.');
              final api = ref.read(apiClientProvider);
              final uploaded = await api.uploadMedia(
                bytes,
                filename: file.name,
                contentType: type,
                folder: widget.folder,
              );
              final url = uploaded['publicUrl'] as String?;
              if (url == null)
                throw StateError('Upload did not return a public media URL.');
              if (widget.registerAsset)
                await api.post(
                  '/storage/assets',
                  body: {
                    'key': uploaded['key'],
                    'url': url,
                    'mimeType': type,
                    'size': bytes.length,
                    'kind': type.startsWith('video') ? 'video' : 'image',
                    'metadata': {'scope': widget.folder},
                  },
                );
              if (mounted) widget.onUploaded(url);
            } catch (e) {
              if (mounted)
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text('$e')));
            } finally {
              if (mounted) setState(() => _busy = false);
            }
          },
    icon: Icon(
      _busy ? Icons.hourglass_top : Icons.add_photo_alternate_outlined,
    ),
    label: Text(_busy ? 'Uploading…' : widget.label),
  );
}
