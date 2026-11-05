import 'package:flutter/material.dart';

import '../theme.dart';
import '../services/api_client.dart';

class ProfileTab extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic> driver;
  final String? userName;
  final VoidCallback onLogout;
  const ProfileTab({super.key, required this.api, required this.driver, required this.userName, required this.onLogout});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late final _modelCtrl = TextEditingController(text: widget.driver['vehicleModel'] as String? ?? '');
  late final _plateCtrl = TextEditingController(text: widget.driver['licensePlate'] as String? ?? '');
  bool _saving = false;
  String? _message;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await widget.api.request('/rides/drivers/me', method: 'PATCH', body: {
        'vehicleModel': _modelCtrl.text.trim(),
        'licensePlate': _plateCtrl.text.trim(),
      });
      setState(() => _message = 'Saved.');
    } on ApiException catch (e) {
      setState(() => _message = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final driver = widget.driver;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: GablaColors.navy,
                  child: Text(
                    (widget.userName ?? 'D').substring(0, 1).toUpperCase(),
                    style: const TextStyle(color: GablaColors.gold, fontSize: 26, fontWeight: FontWeight.w900),
                  ),
                ),
                const SizedBox(height: 12),
                Text(widget.userName ?? 'Driver', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: GablaColors.navy)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(999)),
                  child: const Text('Approved driver', style: TextStyle(color: Color(0xFF166534), fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          const Text('Vehicle details', style: TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
          const SizedBox(height: 12),
          Row(
            children: [
              _VehicleChip(label: driver['vehicleType'] == 'car' ? 'Car' : 'Boda', icon: driver['vehicleType'] == 'car' ? Icons.directions_car_filled_rounded : Icons.two_wheeler_rounded),
              const SizedBox(width: 10),
              _VehicleChip(label: '★ ${(driver['ratingAvg'] as num? ?? 0).toStringAsFixed(1)} (${driver['ratingCount'] ?? 0})', icon: Icons.star_rounded),
            ],
          ),
          const SizedBox(height: 16),
          TextField(controller: _modelCtrl, decoration: const InputDecoration(labelText: 'Vehicle model')),
          const SizedBox(height: 14),
          TextField(controller: _plateCtrl, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Number plate')),
          const SizedBox(height: 16),
          if (_message != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_message!, style: const TextStyle(color: GablaColors.tealDark))),
          OutlinedButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2)) : const Text('Save changes'),
          ),
          const SizedBox(height: 28),
          ElevatedButton.icon(
            onPressed: widget.onLogout,
            style: ElevatedButton.styleFrom(backgroundColor: GablaColors.dangerBg, foregroundColor: GablaColors.danger),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _VehicleChip extends StatelessWidget {
  final String label;
  final IconData icon;
  const _VehicleChip({required this.label, required this.icon});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: GablaColors.border)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: GablaColors.navy),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: GablaColors.navy)),
        ],
      ),
    );
  }
}
