import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../theme.dart';
import '../services/api_client.dart';
import '../services/upload_service.dart';

class DriverApplicationScreen extends StatefulWidget {
  final ApiClient api;
  final VoidCallback onSubmitted;
  final VoidCallback onLogout;
  const DriverApplicationScreen({super.key, required this.api, required this.onSubmitted, required this.onLogout});

  @override
  State<DriverApplicationScreen> createState() => _DriverApplicationScreenState();
}

class _DriverApplicationScreenState extends State<DriverApplicationScreen> {
  String _vehicleType = 'boda';
  final _modelCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  File? _photo;
  bool _submitting = false;
  String? _error;

  Future<void> _pickPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1600);
    if (picked != null) {
      setState(() => _photo = File(picked.path));
    }
  }

  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Take a photo'),
              onTap: () {
                Navigator.pop(ctx);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.pop(ctx);
                _pickPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_photo == null) {
      setState(() => _error = 'Add a photo of your permit or license.');
      return;
    }
    if (_plateCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Enter your vehicle\'s number plate.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final licensePhotoUrl = await UploadService(widget.api).uploadFile(_photo!);
      final result = await widget.api.request(
        '/rides/drivers/register',
        method: 'POST',
        body: {
          'vehicleType': _vehicleType,
          'vehicleModel': _modelCtrl.text.trim().isEmpty ? null : _modelCtrl.text.trim(),
          'licensePlate': _plateCtrl.text.trim(),
          'licensePhotoUrl': licensePhotoUrl,
          'contact': {
            if (_phoneCtrl.text.trim().isNotEmpty) 'phone': _phoneCtrl.text.trim(),
          },
        },
      ) as Map<String, dynamic>;
      // The account's role just flipped from "user" to "driver" server-side - swap in the fresh
      // token the backend hands back, or the very next request (checking driver status) would
      // get rejected by every driver-only endpoint for still carrying the old role.
      final newToken = result['accessToken'] as String?;
      if (newToken != null) {
        await widget.api.session.updateToken(newToken);
      }
      widget.onSubmitted();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Become a driver'),
        actions: [IconButton(onPressed: widget.onLogout, icon: const Icon(Icons.logout))],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text('Vehicle type', style: TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _VehicleTypeCard(
                  label: 'Boda', icon: Icons.two_wheeler_rounded,
                  selected: _vehicleType == 'boda', onTap: () => setState(() => _vehicleType = 'boda'),
                )),
                const SizedBox(width: 12),
                Expanded(child: _VehicleTypeCard(
                  label: 'Car', icon: Icons.directions_car_filled_rounded,
                  selected: _vehicleType == 'car', onTap: () => setState(() => _vehicleType = 'car'),
                )),
              ],
            ),
            const SizedBox(height: 22),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: GablaColors.dangerBg, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: GablaColors.danger, fontSize: 13)),
              ),
              const SizedBox(height: 16),
            ],
            TextField(controller: _modelCtrl, decoration: const InputDecoration(labelText: 'Vehicle model (optional)', hintText: 'e.g. Bajaj Boxer 150')),
            const SizedBox(height: 14),
            TextField(controller: _plateCtrl, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Number plate', hintText: 'e.g. UBG 214K')),
            const SizedBox(height: 14),
            TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Contact phone (optional)')),
            const SizedBox(height: 22),
            const Text('Permit / license photo', style: TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _showPhotoOptions,
              child: Container(
                height: 180,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: GablaColors.border),
                ),
                child: _photo == null
                    ? const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_a_photo_outlined, color: GablaColors.textMuted, size: 30),
                          SizedBox(height: 8),
                          Text('Tap to add a photo', style: TextStyle(color: GablaColors.textMuted)),
                        ],
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.file(_photo!, fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                      ),
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Text('Submit application'),
            ),
          ],
        ),
      ),
    );
  }
}

class _VehicleTypeCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _VehicleTypeCard({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: selected ? GablaColors.navy : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? GablaColors.navy : GablaColors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? GablaColors.gold : GablaColors.navy, size: 30),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: selected ? Colors.white : GablaColors.navy)),
          ],
        ),
      ),
    );
  }
}
