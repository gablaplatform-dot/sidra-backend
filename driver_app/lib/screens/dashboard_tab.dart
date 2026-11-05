import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';
import '../format.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';
import '../services/polyline_codec.dart';

const _activeStatuses = {'matched', 'arrived', 'in_progress'};
const _terminalStatuses = {'completed', 'cancelled_by_rider', 'cancelled_by_driver'};

class DashboardTab extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic> driver;
  const DashboardTab({super.key, required this.api, required this.driver});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  final _location = LocationService();
  GoogleMapController? _map;
  bool _online = false;
  bool _togglingOnline = false;
  Position? _myPosition;
  StreamSubscription<Position>? _positionSub;
  Timer? _pollTimer;
  Map<String, dynamic>? _trip;
  bool _respondingToOffer = false;
  bool _updatingStatus = false;
  String? _banner;

  @override
  void initState() {
    super.initState();
    _online = widget.driver['isOnline'] == true;
    _init();
  }

  Future<void> _init() async {
    final pos = await _location.currentPosition();
    if (pos != null && mounted) {
      setState(() => _myPosition = pos);
      _map?.animateCamera(CameraUpdate.newLatLng(LatLng(pos.latitude, pos.longitude)));
    }
    if (_online) _startLiveTracking();
  }

  void _startLiveTracking() {
    _positionSub?.cancel();
    _positionSub = _location.positionStream().listen((pos) {
      if (!mounted) return;
      setState(() => _myPosition = pos);
      widget.api.request('/rides/drivers/me/location', method: 'POST', body: {'lat': pos.latitude, 'lng': pos.longitude}).catchError((_) {});
    });
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollForTrip());
    _pollForTrip();
  }

  void _stopLiveTracking() {
    _positionSub?.cancel();
    _positionSub = null;
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _pollForTrip() async {
    try {
      final result = await widget.api.request('/rides/drivers/me/trips?limit=1') as Map<String, dynamic>;
      final items = (result['items'] as List?) ?? [];
      final latest = items.isNotEmpty ? items.first as Map<String, dynamic> : null;
      if (!mounted) return;
      if (latest == null || _terminalStatuses.contains(latest['status'])) {
        if (_trip != null && latest != null && _terminalStatuses.contains(latest['status'])) {
          _showCompletionBanner(latest);
        }
        setState(() => _trip = null);
        return;
      }
      if (_activeStatuses.contains(latest['status'])) {
        // A "matched" trip the rider hasn't confirmed yet must stay invisible here - the backend
        // also rejects accept/decline on it (RIDE_NOT_CONFIRMED_BY_RIDER), so surfacing it as an
        // offer would just show a card that fails the moment it's tapped.
        final unconfirmed = latest['status'] == 'matched' && latest['riderConfirmedAt'] == null;
        setState(() => _trip = unconfirmed ? null : latest);
      }
    } catch (_) {
      // Transient - keep polling.
    }
  }

  void _showCompletionBanner(Map<String, dynamic> trip) {
    final status = trip['status'];
    if (status == 'completed') {
      _banner = 'Trip complete — you earned ${formatUgx(trip['driverEarning'])}';
    } else {
      _banner = 'The rider cancelled this trip.';
    }
    if (mounted) setState(() {});
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) setState(() => _banner = null);
    });
  }

  Future<void> _toggleOnline(bool value) async {
    setState(() => _togglingOnline = true);
    try {
      await widget.api.request('/rides/drivers/me/online', method: 'POST', body: {'isOnline': value});
      setState(() => _online = value);
      if (value) {
        _startLiveTracking();
      } else {
        _stopLiveTracking();
        setState(() => _trip = null);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _togglingOnline = false);
    }
  }

  Future<void> _respond(bool accept) async {
    if (_trip == null) return;
    setState(() => _respondingToOffer = true);
    try {
      final updated = await widget.api.request('/rides/trips/${_trip!['id']}/respond', method: 'POST', body: {'accept': accept}) as Map<String, dynamic>;
      setState(() => _trip = accept ? updated : null);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _respondingToOffer = false);
    }
  }

  Future<void> _advanceStatus() async {
    if (_trip == null) return;
    final next = {'matched': 'arrived', 'arrived': 'in_progress', 'in_progress': 'completed'}[_trip!['status']];
    if (next == null) return;
    setState(() => _updatingStatus = true);
    try {
      final updated = await widget.api.request('/rides/trips/${_trip!['id']}/status', method: 'PATCH', body: {'status': next}) as Map<String, dynamic>;
      if (next == 'completed') {
        _showCompletionBanner(updated);
        setState(() => _trip = null);
      } else {
        setState(() => _trip = updated);
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _updatingStatus = false);
    }
  }

  Future<void> _callRider() async {
    final phone = _trip?['riderPhone'] as String?;
    if (phone == null || phone.isEmpty) return;
    await launchUrl(Uri.parse('tel:$phone'));
  }

  @override
  void dispose() {
    _stopLiveTracking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final trip = _trip;
    final isOffer = trip != null && trip['status'] == 'matched' && trip['acceptedAt'] == null;

    return Stack(
      children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(
            target: _myPosition != null ? LatLng(_myPosition!.latitude, _myPosition!.longitude) : const LatLng(0.3476, 32.5825),
            zoom: 14,
          ),
          onMapCreated: (c) => _map = c,
          myLocationEnabled: true,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          markers: _buildMarkers(trip),
          polylines: _buildPolylines(trip),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: _OnlineToggleBar(online: _online, loading: _togglingOnline, onChanged: _toggleOnline),
          ),
        ),
        if (_banner != null)
          Positioned(
            top: 80,
            left: 16,
            right: 16,
            child: SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: GablaColors.navy, borderRadius: BorderRadius.circular(12)),
                child: Text(_banner!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700), textAlign: TextAlign.center),
              ),
            ),
          ),
        if (!_online && trip == null)
          const Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: _OfflineHint(),
          ),
        if (trip != null && isOffer)
          _TripOfferSheet(trip: trip, loading: _respondingToOffer, onAccept: () => _respond(true), onDecline: () => _respond(false)),
        if (trip != null && !isOffer)
          _ActiveTripSheet(trip: trip, loading: _updatingStatus, onAdvance: _advanceStatus, onCall: _callRider),
      ],
    );
  }

  Set<Marker> _buildMarkers(Map<String, dynamic>? trip) {
    final markers = <Marker>{};
    if (trip == null) return markers;
    final pickup = trip['pickup'] as Map<String, dynamic>?;
    final dropoff = trip['dropoff'] as Map<String, dynamic>?;
    if (pickup != null) {
      markers.add(Marker(
        markerId: const MarkerId('pickup'),
        position: LatLng((pickup['lat'] as num).toDouble(), (pickup['lng'] as num).toDouble()),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        infoWindow: InfoWindow(title: 'Pickup', snippet: pickup['address'] as String?),
      ));
    }
    if (dropoff != null) {
      markers.add(Marker(
        markerId: const MarkerId('dropoff'),
        position: LatLng((dropoff['lat'] as num).toDouble(), (dropoff['lng'] as num).toDouble()),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: InfoWindow(title: 'Drop-off', snippet: dropoff['address'] as String?),
      ));
    }
    return markers;
  }

  Set<Polyline> _buildPolylines(Map<String, dynamic>? trip) {
    final encoded = trip?['routePolyline'] as String?;
    if (encoded == null || encoded.isEmpty) return {};
    List<LatLng> points;
    try {
      points = decodePolyline(encoded);
    } catch (_) {
      return {};
    }
    if (points.length < 2) return {};
    return {
      Polyline(
        polylineId: const PolylineId('route'),
        points: points,
        color: GablaColors.navy,
        width: 4,
      ),
    };
  }
}

class _OnlineToggleBar extends StatelessWidget {
  final bool online;
  final bool loading;
  final ValueChanged<bool> onChanged;
  const _OnlineToggleBar({required this.online, required this.loading, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Row(
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: online ? const Color(0xFF10B981) : GablaColors.textMuted)),
          const SizedBox(width: 10),
          Text(online ? 'You\'re online' : 'You\'re offline', style: const TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
          const Spacer(),
          if (loading)
            const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
          else
            Switch(value: online, activeTrackColor: GablaColors.navy, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _OfflineHint extends StatelessWidget {
  const _OfflineHint();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
      child: const Row(
        children: [
          Icon(Icons.info_outline_rounded, color: GablaColors.navy),
          SizedBox(width: 12),
          Expanded(child: Text('Go online to start receiving ride requests near you.', style: TextStyle(color: GablaColors.textMuted, fontSize: 13))),
        ],
      ),
    );
  }
}

class _TripOfferSheet extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool loading;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  const _TripOfferSheet({required this.trip, required this.loading, required this.onAccept, required this.onDecline});

  @override
  Widget build(BuildContext context) {
    final pickup = trip['pickup'] as Map<String, dynamic>?;
    final dropoff = trip['dropoff'] as Map<String, dynamic>?;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 30, offset: const Offset(0, 10))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Icon(Icons.bolt_rounded, color: GablaColors.gold, size: 22),
                const SizedBox(width: 8),
                const Text('New ride request', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: GablaColors.navy)),
                const Spacer(),
                Text(formatUgx(trip['estimatedFare']), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: GablaColors.navy)),
              ],
            ),
            const SizedBox(height: 4),
            Text(trip['riderName'] ?? 'Rider', style: const TextStyle(color: GablaColors.textMuted, fontSize: 13)),
            const SizedBox(height: 14),
            _RouteRow(icon: Icons.circle, color: GablaColors.navy, label: pickup?['address'] as String? ?? 'Pickup'),
            const SizedBox(height: 6),
            _RouteRow(icon: Icons.location_on, color: Colors.redAccent, label: dropoff?['address'] as String? ?? 'Drop-off'),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading ? null : onDecline,
                    style: OutlinedButton.styleFrom(foregroundColor: GablaColors.danger, side: const BorderSide(color: Color(0xFFFECDD3))),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: loading ? null : onAccept,
                    child: loading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                        : const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveTripSheet extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool loading;
  final VoidCallback onAdvance;
  final VoidCallback onCall;
  const _ActiveTripSheet({required this.trip, required this.loading, required this.onAdvance, required this.onCall});

  @override
  Widget build(BuildContext context) {
    final status = trip['status'] as String;
    final pickup = trip['pickup'] as Map<String, dynamic>?;
    final dropoff = trip['dropoff'] as Map<String, dynamic>?;
    final copy = {
      'matched': ('Head to pickup', 'Arrived at pickup'),
      'arrived': ('Waiting for rider', 'Start trip'),
      'in_progress': ('Trip in progress', 'Complete trip'),
    }[status]!;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 30, offset: const Offset(0, 10))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: GablaColors.navy,
                  child: Text((trip['riderName'] as String? ?? 'R').substring(0, 1).toUpperCase(), style: const TextStyle(color: GablaColors.gold, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(trip['riderName'] ?? 'Rider', style: const TextStyle(fontWeight: FontWeight.w800, color: GablaColors.navy)),
                      Text(copy.$1, style: const TextStyle(color: GablaColors.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(onPressed: onCall, icon: const Icon(Icons.call_rounded, color: GablaColors.tealDark)),
              ],
            ),
            const SizedBox(height: 14),
            _RouteRow(icon: Icons.circle, color: GablaColors.navy, label: pickup?['address'] as String? ?? 'Pickup'),
            const SizedBox(height: 6),
            _RouteRow(icon: Icons.location_on, color: Colors.redAccent, label: dropoff?['address'] as String? ?? 'Drop-off'),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: loading ? null : onAdvance,
              child: loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                  : Text(copy.$2),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  const _RouteRow({required this.icon, required this.color, required this.label});
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.only(top: 3), child: Icon(icon, size: 12, color: color)),
        const SizedBox(width: 10),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: GablaColors.navy), maxLines: 2, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}
