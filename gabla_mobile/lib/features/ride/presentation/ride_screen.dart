import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/font_group.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/location/google_place_picker.dart';
import '../../../core/location/journey_map.dart';
import '../../../core/location/map_mode.dart';
import '../../../core/mobility/mobility_layout.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/utils/money.dart';
import '../../auth/application/session_controller.dart';
import '../../settings/application/theme_controller.dart';
import '../application/ride_flow_controller.dart';
import '../application/ride_providers.dart';
import '../domain/ride_location.dart';

class RideScreen extends ConsumerStatefulWidget {
  const RideScreen({super.key});
  @override
  ConsumerState<RideScreen> createState() => _RideScreenState();
}

class _RideScreenState extends ConsumerState<RideScreen> {
  final _phone = TextEditingController();
  String _payment = 'cash';
  bool _locating = false;
  double _sheetExtent = .48;
  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  RideFlowController get flow => ref.read(rideFlowControllerProvider.notifier);
  Future<void> _place(bool pickup) async {
    final state = ref.read(rideFlowControllerProvider);
    final point = await pickGoogleLocation(
      context,
      title: pickup ? 'Choose your pickup' : 'Where are you going?',
      initial: pickup ? state.pickup : state.dropoff,
    );
    if (!mounted || point == null) return;
    if (pickup) {
      flow.setPickup(point);
    } else {
      flow.setDropoff(point);
    }
  }

  Future<void> _gps() async {
    setState(() => _locating = true);
    try {
      final point = await ref
          .read(deviceLocationServiceProvider)
          .currentLocation();
      if (mounted) flow.setPickup(point);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _cancel() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this ride?'),
        content: const Text('Your current ride request will be cancelled.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep ride'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel ride'),
          ),
        ],
      ),
    );
    if (yes == true && mounted) await flow.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(rideFlowControllerProvider);
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    final driver = s.trip?.driver;
    final titles = switch (s.stage) {
      RideStage.setup => (
        'Where to\nnext?',
        'A boda for the quick trips. A car for everything else.',
      ),
      RideStage.choosing => (
        'Your route.\nYour ride.',
        'Compare real fares, then choose how you move.',
      ),
      RideStage.confirming => (
        'Meet your\ndriver.',
        'Review the match before confirming your journey.',
      ),
      RideStage.live => (
        rideStatusLabel(s.trip?.status ?? 'searching'),
        'Your journey, with every update in one place.',
      ),
    };
    final c = Theme.of(context).colorScheme;
    return Scaffold(
      extendBodyBehindAppBar: true,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.all(6),
          child: Material(
            color: c.surface,
            shape: const CircleBorder(),
            child: BackButton(
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/home');
                }
              },
            ),
          ),
        ),
        title: Material(
          color: c.surface,
          borderRadius: BorderRadius.circular(24),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text('Get Ride', style: TextStyle(fontSize: 16)),
          ),
        ),
        actions: [
          const MapModeButton(compact: true),
          const SizedBox(width: 8),
          CircleAvatar(
            backgroundColor: c.surface,
            child: IconButton(
              tooltip: 'Design Studio',
              onPressed: () => context.push('/settings/appearance'),
              icon: const Icon(Icons.tune),
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) => Stack(
          children: [
            Positioned.fill(
              child: JourneyMap(
                pickup: s.pickup,
                dropoff: s.dropoff,
                bottomPadding: constraints.maxHeight * _sheetExtent,
                polyline: s.trip?.routePolyline,
                driver: driver?.lat != null && driver?.lng != null
                    ? RideLocation(
                        lat: driver!.lat!,
                        lng: driver.lng!,
                        address: driver.name ?? 'Your driver',
                      )
                    : null,
                onTap: s.stage == RideStage.setup
                    ? (point) async {
                        final location = await pickGoogleLocation(
                          context,
                          title: s.pickup == null
                              ? 'Confirm pickup'
                              : 'Confirm destination',
                          initial: RideLocation(
                            lat: point.latitude,
                            lng: point.longitude,
                            address: 'Selected map point',
                          ),
                        );
                        if (location != null && mounted) {
                          if (ref.read(rideFlowControllerProvider).pickup ==
                              null) {
                            flow.setPickup(location);
                          } else {
                            flow.setDropoff(location);
                          }
                        }
                      }
                    : null,
              ),
            ),
            Positioned(
              right: 16,
              bottom: constraints.maxHeight * _sheetExtent + 16,
              child: FloatingActionButton.small(
                heroTag: 'ride-gps',
                tooltip: 'Use my location',
                onPressed: _locating ? null : _gps,
                backgroundColor: c.surface,
                foregroundColor: c.onSurface,
                child: _locating
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Icon(Icons.my_location),
              ),
            ),
            NotificationListener<DraggableScrollableNotification>(
              onNotification: (notification) {
                if ((_sheetExtent - notification.extent).abs() > .01)
                  setState(() => _sheetExtent = notification.extent);
                return false;
              },
              child: DraggableScrollableSheet(
                initialChildSize: .48,
                minChildSize: .24,
                maxChildSize: .9,
                snap: true,
                snapSizes: const [.24, .48, .9],
                builder: (context, controller) => Material(
                  color: c.surface,
                  elevation: 18,
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(switch (style) {
                      AppThemeStyle.editorial => 8,
                      AppThemeStyle.cinematic => 18,
                      AppThemeStyle.orbit => 40,
                      _ => 30,
                    }),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ListView(
                    controller: controller,
                    padding: EdgeInsets.fromLTRB(
                      22,
                      10,
                      22,
                      MediaQuery.paddingOf(context).bottom + 24,
                    ),
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 18),
                          decoration: BoxDecoration(
                            color: c.outlineVariant,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                      Text(
                        titles.$1.replaceAll('\n', ' '),
                        style: AppTypography.of(context).display(
                          size: style == AppThemeStyle.editorial ? 30 : 26,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        titles.$2,
                        style: TextStyle(
                          fontSize: 12,
                          color: c.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _progress(s.stage),
                      const SizedBox(height: 20),
                      MobilityStageSwitcher(
                        style: style,
                        stageKey: s.stage.name,
                        child: switch (s.stage) {
                          RideStage.setup => _setup(s),
                          RideStage.choosing => _choosing(s, style),
                          RideStage.confirming => _confirm(s),
                          RideStage.live => _live(s),
                        },
                      ),
                      if (s.error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            s.error!,
                            style: TextStyle(color: c.error),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _progress(RideStage stage) => Row(
    children: [
      for (var i = 0; i < 4; i++)
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 5),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 3,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: i <= stage.index
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.outlineVariant,
              ),
            ),
          ),
        ),
    ],
  );
  Widget _setup(RideFlowState s) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      JourneyField(
        label: 'Pickup',
        value: s.pickup?.address ?? 'Choose your starting point',
        icon: Icons.trip_origin,
        onTap: () => _place(true),
        trailing: IconButton(
          tooltip: 'Use current location',
          onPressed: _locating ? null : _gps,
          icon: _locating
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.my_location, size: 20),
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(left: 24),
        child: Container(
          height: 18,
          width: 1,
          alignment: Alignment.centerLeft,
          child: const Icon(Icons.more_vert, size: 16),
        ),
      ),
      JourneyField(
        label: 'Destination',
        value: s.dropoff?.address ?? 'Where are you going?',
        icon: Icons.location_on_outlined,
        onTap: () => _place(false),
      ),
      const SizedBox(height: 20),
      _button(
        'See fares',
        s.loading || s.pickup == null || s.dropoff == null
            ? null
            : flow.fetchEstimates,
        loading: s.loading,
      ),
      const SizedBox(height: 12),
      const Text(
        'Choose exact locations with search or a satellite map pin.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 11, height: 1.5),
      ),
    ],
  );
  Widget _choosing(RideFlowState s, AppThemeStyle style) {
    final options = [
      for (final t in rideVehicleTypes)
        if (s.estimates[t] != null) _vehicle(s, t, style),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Choose your ride',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            TextButton(
              onPressed: s.loading ? null : flow.editRoute,
              child: const Text('Edit route'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (style == AppThemeStyle.discover || style == AppThemeStyle.orbit)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final option in options)
                  Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: SizedBox(width: 190, child: option),
                  ),
              ],
            ),
          )
        else
          ...options,
        const SizedBox(height: 20),
        Text('Pay your way', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          children: [
            for (final p in ['cash', 'mobile_money'])
              ChoiceChip(
                avatar: Icon(
                  p == 'cash' ? Icons.payments_outlined : Icons.phone_android,
                  size: 16,
                ),
                label: Text(p == 'cash' ? 'Cash' : 'Mobile money'),
                selected: _payment == p,
                onSelected: (_) {
                  HapticFeedback.selectionClick();
                  setState(() => _payment = p);
                },
              ),
          ],
        ),
        if (_payment == 'mobile_money')
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Mobile money number',
                hintText: '07XXXXXXXX',
              ),
            ),
          ),
        const SizedBox(height: 20),
        _button(
          'Request ${s.vehicleType == 'boda' ? 'boda boda' : 'car'}',
          s.loading
              ? null
              : () {
                  if (!ref.read(isSignedInProvider)) {
                    context.push('/login?next=%2Fride');
                    return;
                  }
                  if (_payment == 'mobile_money' &&
                      _phone.text.replaceAll(RegExp(r'\D'), '').length < 9) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Enter a valid mobile money number.'),
                      ),
                    );
                    return;
                  }
                  flow.requestRide(
                    paymentMethod: _payment,
                    phone: _payment == 'mobile_money'
                        ? _phone.text.trim()
                        : null,
                  );
                },
          loading: s.loading,
        ),
      ],
    );
  }

  Widget _vehicle(RideFlowState s, String t, AppThemeStyle style) {
    final selected = s.vehicleType == t,
        e = s.estimates[t]!,
        c = Theme.of(context).colorScheme;
    final tile = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.primary.withValues(alpha: .09),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(
                t == 'boda' ? Icons.two_wheeler : Icons.directions_car_filled,
                size: 34,
                color: c.primary,
              ),
            ),
            const Spacer(),
            Icon(
              selected ? Icons.check_circle : Icons.circle_outlined,
              color: selected ? c.primary : c.outline,
              size: 20,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          t == 'boda' ? 'Boda boda' : 'Gabla Car',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          [
            if (e.distanceKm != null) '${e.distanceKm!.toStringAsFixed(1)} km',
            if (e.durationMin != null) '${e.durationMin} min journey',
          ].join(' · '),
          style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
        ),
        const SizedBox(height: 9),
        Text(
          formatUgx(e.fare),
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AnimatedContainer(
        duration: Duration(
          milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 240,
        ),
        decoration: BoxDecoration(
          color: selected ? c.primary.withValues(alpha: .08) : c.surface,
          borderRadius: BorderRadius.circular(
            style == AppThemeStyle.editorial
                ? 4
                : style == AppThemeStyle.orbit
                ? 28
                : 18,
          ),
          border: Border.all(
            color: selected ? c.primary : c.outlineVariant,
            width: selected ? 2 : 1,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            HapticFeedback.selectionClick();
            flow.selectVehicle(t);
          },
          child: Padding(padding: const EdgeInsets.all(16), child: tile),
        ),
      ),
    );
  }

  Widget _confirm(RideFlowState s) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _driver(s),
      const SizedBox(height: 18),
      Text('Estimated fare', style: Theme.of(context).textTheme.labelLarge),
      const SizedBox(height: 4),
      Text(
        formatUgx(s.trip?.estimatedFare),
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 24),
      _button(
        'Confirm ride',
        s.loading ? null : flow.confirm,
        loading: s.loading,
      ),
      const SizedBox(height: 8),
      TextButton(
        onPressed: s.loading ? null : _cancel,
        child: const Text('Cancel request'),
      ),
    ],
  );
  Widget _driver(RideFlowState s) {
    final d = s.trip?.driver;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 27,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: const Icon(Icons.person_outline, size: 30),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    d?.name ?? 'Your driver',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                  if (d?.ratingAvg != null)
                    Text(
                      '★ ${d!.ratingAvg!.toStringAsFixed(1)}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  if (d?.vehicleModel != null)
                    Text(
                      d!.vehicleModel!,
                      style: const TextStyle(fontSize: 12),
                    ),
                ],
              ),
            ),
            if (d?.phone != null)
              IconButton.filledTonal(
                tooltip: 'Call driver',
                icon: const Icon(Icons.phone_outlined),
                onPressed: () => launchUrl(Uri(scheme: 'tel', path: d!.phone)),
              ),
          ],
        ),
        if (d?.licensePlate != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
              ),
              child: Row(
                children: [
                  const Icon(Icons.directions_car_outlined, size: 19),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      d!.licensePlate!,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _live(RideFlowState s) {
    final trip = s.trip;
    if (trip == null) return const Center(child: CircularProgressIndicator());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MobilityActivityIcon(
          active: trip.status == 'searching',
          icon: trip.status == 'completed'
              ? Icons.check_circle_outline
              : trip.status == 'no_drivers_found'
              ? Icons.search_off
              : Icons.route,
        ),
        const SizedBox(height: 12),
        Text(
          rideStatusLabel(trip.status),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 20),
        if (trip.driver != null) _driver(s),
        const SizedBox(height: 16),
        Text(
          trip.status == 'completed' ? 'Final fare' : 'Estimated fare',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          formatUgx(
            trip.status == 'completed'
                ? trip.finalFare ?? trip.estimatedFare
                : trip.estimatedFare,
          ),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        if (trip.isCancellable)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: OutlinedButton(
              onPressed: s.loading ? null : _cancel,
              child: const Text('Cancel ride'),
            ),
          ),
        if (trip.isTerminal)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: _button('Book another ride', flow.reset),
          ),
      ],
    );
  }

  Widget _button(String text, VoidCallback? tap, {bool loading = false}) =>
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: tap,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 17),
          ),
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(child: Text(text)),
                    const SizedBox(width: 12),
                    const Icon(Icons.arrow_forward, size: 18),
                  ],
                ),
        ),
      );
}

String rideStatusLabel(String status) => switch (status) {
  'searching' => 'Finding your ride',
  'matched' => 'Your driver is on the way',
  'arrived' => 'Your driver has arrived',
  'in_progress' => 'On your way',
  'completed' => 'You have arrived',
  'no_drivers_found' => 'No drivers available',
  'cancelled_by_rider' || 'cancelled_by_driver' => 'Ride cancelled',
  _ => status.replaceAll('_', ' '),
};
