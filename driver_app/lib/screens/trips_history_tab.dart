import 'package:flutter/material.dart';

import '../theme.dart';
import '../format.dart';
import '../services/api_client.dart';

const _statusLabels = {
  'searching': 'Searching',
  'matched': 'Matched',
  'arrived': 'Arrived',
  'in_progress': 'In progress',
  'completed': 'Completed',
  'cancelled_by_rider': 'Cancelled by rider',
  'cancelled_by_driver': 'Cancelled by you',
  'no_drivers_found': 'No drivers found',
};

class TripsHistoryTab extends StatefulWidget {
  final ApiClient api;
  const TripsHistoryTab({super.key, required this.api});

  @override
  State<TripsHistoryTab> createState() => _TripsHistoryTabState();
}

class _TripsHistoryTabState extends State<TripsHistoryTab> {
  List<dynamic> _trips = [];
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
      final result = await widget.api.request('/rides/drivers/me/trips?limit=50') as Map<String, dynamic>;
      setState(() => _trips = (result['items'] as List?) ?? []);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your trips')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center))])
                : _trips.isEmpty
                    ? ListView(
                        children: const [
                          Padding(
                            padding: EdgeInsets.only(top: 100),
                            child: Center(child: Text('No trips yet.', style: TextStyle(color: GablaColors.textMuted))),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _trips.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final t = _trips[i] as Map<String, dynamic>;
                          final completed = t['status'] == 'completed';
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: GablaColors.border)),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(t['riderName'] ?? 'Rider', style: const TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
                                      const SizedBox(height: 4),
                                      Text(formatTime(t['requestedAt']), style: const TextStyle(color: GablaColors.textMuted, fontSize: 12)),
                                      const SizedBox(height: 6),
                                      Text(_statusLabels[t['status']] ?? t['status'], style: const TextStyle(fontSize: 12, color: GablaColors.textMuted, fontWeight: FontWeight.w600)),
                                    ],
                                  ),
                                ),
                                Text(
                                  formatUgx(completed ? t['driverEarning'] : t['estimatedFare']),
                                  style: TextStyle(fontWeight: FontWeight.w900, color: completed ? GablaColors.tealDark : GablaColors.navy),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
