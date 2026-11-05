import 'package:flutter/material.dart';

import '../theme.dart';
import '../format.dart';
import '../services/api_client.dart';

class WalletTab extends StatefulWidget {
  final ApiClient api;
  const WalletTab({super.key, required this.api});

  @override
  State<WalletTab> createState() => _WalletTabState();
}

class _WalletTabState extends State<WalletTab> {
  Map<String, dynamic>? _wallet;
  List<dynamic> _completedTrips = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.request('/rides/drivers/me/wallet'),
        widget.api.request('/rides/drivers/me/trips?limit=50'),
      ]);
      final trips = ((results[1] as Map<String, dynamic>)['items'] as List?) ?? [];
      setState(() {
        _wallet = results[0] as Map<String, dynamic>;
        _completedTrips = trips.where((t) => (t as Map<String, dynamic>)['status'] == 'completed').toList();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text(_error!, style: const TextStyle(color: GablaColors.danger))),
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [GablaColors.navy, GablaColors.navyLight], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Wallet balance', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Text(formatUgx(_wallet?['balance']), style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        const Text('Cash trips are collected in person and don\'t affect this balance.', style: TextStyle(color: Colors.white54, fontSize: 11)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text('Completed trips', style: TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
                  const SizedBox(height: 12),
                  if (_completedTrips.isEmpty)
                    const Padding(padding: EdgeInsets.only(top: 20), child: Center(child: Text('No completed trips yet.', style: TextStyle(color: GablaColors.textMuted))))
                  else
                    ..._completedTrips.map((t) {
                      final trip = t as Map<String, dynamic>;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: GablaColors.border)),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(trip['riderName'] ?? 'Rider', style: const TextStyle(fontWeight: FontWeight.w700)),
                                  Text(formatTime(trip['completedAt']), style: const TextStyle(color: GablaColors.textMuted, fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(
                              trip['paymentMethod'] == 'cash' ? '${formatUgx(trip['driverEarning'])} · cash' : formatUgx(trip['driverEarning']),
                              style: const TextStyle(fontWeight: FontWeight.w800, color: GablaColors.tealDark),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
      ),
    );
  }
}
