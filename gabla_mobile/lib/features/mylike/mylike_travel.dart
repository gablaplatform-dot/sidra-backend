part of 'mylike_screen.dart';

const _pickup = maps.LatLng(.3215, 32.5794);
const _destination = maps.LatLng(.3405, 32.5861);
const _venue = maps.LatLng(6.4378, 3.4774);

class _PreviewMap extends ConsumerWidget {
  const _PreviewMap({this.event = false, this.route = false});
  final bool event, route;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final configured =
        ref.watch(googleMapsConfiguredProvider).valueOrNull == true;
    final point = event ? _venue : _pickup;
    if (!configured) {
      return CustomPaint(
        painter: _MapIllustration(dark: event, route: route),
        child: Center(
          child: Icon(
            Icons.location_on,
            size: 38,
            color: event ? Colors.redAccent : _blue,
          ),
        ),
      );
    }
    return maps.GoogleMap(
      initialCameraPosition: maps.CameraPosition(
        target: point,
        zoom: event ? 15 : 13.8,
      ),
      mapType: ref.watch(mapModeProvider),
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      mapToolbarEnabled: false,
      markers: {
        maps.Marker(
          markerId: const maps.MarkerId('sample-start'),
          position: point,
          infoWindow: maps.InfoWindow(
            title: event ? 'Venue area' : 'Sample pickup',
          ),
        ),
        if (route)
          const maps.Marker(
            markerId: maps.MarkerId('sample-end'),
            position: _destination,
            infoWindow: maps.InfoWindow(title: 'Sample destination'),
          ),
      },
      polylines: route
          ? {
              const maps.Polyline(
                polylineId: maps.PolylineId('sample-illustration'),
                points: [
                  _pickup,
                  maps.LatLng(.3255, 32.578),
                  maps.LatLng(.331, 32.583),
                  _destination,
                ],
                width: 5,
                color: _blue,
              ),
            }
          : {},
    );
  }
}

class _MapIllustration extends CustomPainter {
  const _MapIllustration({required this.dark, required this.route});
  final bool dark, route;
  @override
  void paint(Canvas canvas, Size size) {
    final background = dark ? const Color(0xff141920) : const Color(0xffe7e8df);
    final street = dark ? const Color(0xff303841) : Colors.white;
    canvas.drawRect(Offset.zero & size, Paint()..color = background);
    final park = Paint()
      ..color = dark ? const Color(0xff212d2b) : const Color(0xffd1e1c4);
    canvas.drawOval(
      Rect.fromLTWH(
        size.width * .04,
        size.height * .2,
        size.width * .29,
        size.height * .24,
      ),
      park,
    );
    canvas.drawOval(
      Rect.fromLTWH(
        size.width * .67,
        size.height * .54,
        size.width * .38,
        size.height * .30,
      ),
      park,
    );
    final road = Paint()
      ..color = street
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke;
    for (var i = -3; i < 14; i++) {
      final x = size.width * i / 10;
      canvas.drawPath(
        Path()
          ..moveTo(x, 0)
          ..quadraticBezierTo(x - 30, size.height * .52, x + 115, size.height),
        road,
      );
    }
    for (var i = -2; i < 12; i++) {
      final y = size.height * i / 9;
      canvas.drawPath(
        Path()
          ..moveTo(0, y)
          ..quadraticBezierTo(size.width * .52, y + 45, size.width, y - 63),
        road,
      );
    }
    if (route) {
      canvas.drawPath(
        Path()
          ..moveTo(size.width * .36, size.height * .72)
          ..lineTo(size.width * .45, size.height * .52)
          ..lineTo(size.width * .57, size.height * .48)
          ..lineTo(size.width * .63, size.height * .28),
        Paint()
          ..color = _blue
          ..strokeWidth = 5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _MapIllustration oldDelegate) =>
      oldDelegate.dark != dark || oldDelegate.route != route;
}

class _Ride extends StatefulWidget {
  const _Ride({required this.screen});
  final String screen;
  @override
  State<_Ride> createState() => _RideState();
}

class _RideState extends State<_Ride> {
  int vehicle = 0;
  @override
  Widget build(BuildContext context) {
    final screen = widget.screen;
    final options = screen == 'ride-options';
    final start = screen == 'ride';
    final driver = screen == 'ride-driver';
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) => Stack(
          children: [
            Positioned.fill(child: _PreviewMap(route: !start)),
            Positioned(
              left: 15,
              right: 15,
              top: MediaQuery.paddingOf(context).top + 10,
              child: Row(
                children: [
                  _CircleButton(
                    Icons.chevron_left,
                    'Back',
                    () => _back(context),
                    tint: Colors.white,
                  ),
                  const Spacer(),
                  _CircleButton(
                    Icons.history,
                    'Ride history',
                    () => _open(context, 'ride-history'),
                    tint: Colors.white,
                  ),
                  const SizedBox(width: 7),
                  const MapModeButton(compact: true),
                ],
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: SafeArea(
                top: false,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: constraints.maxHeight * .62,
                  ),
                  child: Material(
                    color: Colors.white,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(26),
                    ),
                    elevation: 5,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(19, 10, 19, 16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Container(
                              height: 4,
                              width: 36,
                              decoration: BoxDecoration(
                                color: Colors.black26,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                          const SizedBox(height: 13),
                          _Heading(
                            start
                                ? 'Where to?'
                                : options
                                ? 'Choose a ride'
                                : driver
                                ? 'Review your driver'
                                : 'Trip in progress',
                            start
                                ? 'Set a pickup and destination.'
                                : 'Kampala Road → Acacia Mall',
                          ),
                          const SizedBox(height: 12),
                          if (start) ...[
                            const _RowLink(
                              Icons.trip_origin,
                              'Pickup',
                              'Kampala Road',
                              'ride-route',
                            ),
                            const _RowLink(
                              Icons.location_on_outlined,
                              'Destination',
                              'Choose where to go',
                              'ride-route',
                            ),
                          ] else if (options)
                            for (final entry in const [
                              (
                                Icons.directions_car_outlined,
                                'Economy',
                                'UGX 14,500',
                                'Everyday rides · 4 seats',
                              ),
                              (
                                Icons.local_taxi_outlined,
                                'Comfort',
                                'UGX 20,500',
                                'More space · 4 seats',
                              ),
                              (
                                Icons.two_wheeler_outlined,
                                'Boda',
                                'UGX 8,000',
                                'Motorcycle · 1 seat',
                              ),
                            ].indexed)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(10),
                                  onTap: () =>
                                      setState(() => vehicle = entry.$1),
                                  child: _Panel(
                                    color: vehicle == entry.$1
                                        ? const Color(0xffe4eff1)
                                        : Colors.white,
                                    radius: 10,
                                    child: Row(
                                      children: [
                                        Icon(entry.$2.$1, color: _blue),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                entry.$2.$2,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontVariations: [
                                                    FontVariation('wght', 800),
                                                  ],
                                                ),
                                              ),
                                              Text(
                                                entry.$2.$4,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          entry.$2.$3,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontVariations: [
                                              FontVariation('wght', 700),
                                            ],
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              )
                          else
                            const ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                child: Icon(Icons.person_outline),
                              ),
                              title: Text('Sample driver'),
                              subtitle: Text('Silver Toyota · UBA 308P'),
                              trailing: Icon(Icons.star_outline),
                            ),
                          const SizedBox(height: 10),
                          _Action(
                            start
                                ? 'Set destination'
                                : options
                                ? 'Preview driver'
                                : driver
                                ? 'Preview trip'
                                : 'Done',
                            () => _open(
                              context,
                              start
                                  ? 'ride-route'
                                  : options
                                  ? 'ride-driver'
                                  : driver
                                  ? 'ride-trip'
                                  : 'ride-history',
                            ),
                            color: _blue,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Nearby extends StatelessWidget {
  const _Nearby();
  @override
  Widget build(BuildContext context) => _Page(
    title: 'Nearby',
    trailing: const MapModeButton(compact: true),
    children: [
      const TextField(
        decoration: InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'Search this area',
        ),
      ),
      const SizedBox(height: 12),
      const SizedBox(
        height: 310,
        child: ClipRRect(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          child: _PreviewMap(),
        ),
      ),
      const _Section('Around Kampala'),
      const _RowLink(
        Icons.storefront_outlined,
        'Velora Store',
        'Products · Kampala',
        'shop',
      ),
      const _RowLink(
        Icons.camera_alt_outlined,
        'The Portrait Room',
        'Services · Kampala',
        'provider',
      ),
    ],
  );
}

const _busRed = Color(0xffd72522);

class _Bus extends StatefulWidget {
  const _Bus({required this.screen});
  final String screen;
  @override
  State<_Bus> createState() => _BusState();
}

class _BusState extends State<_Bus> {
  int selectedSeat = 12;
  @override
  Widget build(BuildContext context) {
    final screen = widget.screen;
    return _Page(
      title: _groups['Bus tickets']![screen]!,
      trailing: _CircleButton(
        Icons.confirmation_number_outlined,
        'My tickets',
        () => _open(context, 'bus-tickets'),
      ),
      children: switch (screen) {
        'bus' => [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Image.asset(
                    'assets/mylike/bus.jpg',
                    fit: BoxFit.cover,
                    excludeFromSemantics: true,
                  ),
                ),
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.black12, Colors.black87],
                      ),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 78, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Find a bus',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 25,
                          fontWeight: FontWeight.w800,
                          fontVariations: [FontVariation('wght', 800)],
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Compare departures and seats.',
                        style: TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _Panel(
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(
                  child: Text(
                    'One way',
                    style: TextStyle(
                      color: _busRed,
                      fontWeight: FontWeight.w800,
                      fontVariations: [FontVariation('wght', 800)],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Expanded(
                      child: TextField(
                        decoration: InputDecoration(
                          labelText: 'From',
                          hintText: 'Kampala',
                        ),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        decoration: InputDecoration(
                          labelText: 'To',
                          hintText: 'Mbarara',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Row(
                  children: [
                    Expanded(
                      child: TextField(
                        decoration: InputDecoration(
                          labelText: 'Departure date',
                          hintText: 'Saturday',
                        ),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        decoration: InputDecoration(
                          labelText: 'Passengers',
                          hintText: '1 adult',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _Action(
                  'Search buses',
                  () => _open(context, 'bus-results'),
                  color: _busRed,
                ),
              ],
            ),
          ),
          const _Section('Recent searches'),
          const _RowLink(
            Icons.history,
            'Kampala → Mbarara',
            'One way · 1 adult',
            'bus-results',
          ),
          const _RowLink(
            Icons.location_on_outlined,
            'Bus parks',
            'Find boarding locations',
            'bus-parks',
          ),
        ],
        'bus-results' => [
          const _Heading('Kampala → Mbarara', 'Saturday · 1 passenger'),
          const SizedBox(height: 16),
          for (final trip in const [
            ('07:30', '11:50', 'UGX 32,000'),
            ('12:00', '16:20', 'UGX 35,000'),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _Panel(
                color: Colors.white,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Western Express',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            trip.$1,
                            style: const TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              fontVariations: [FontVariation('wght', 800)],
                            ),
                          ),
                        ),
                        const Expanded(
                          child: Icon(Icons.trending_flat, size: 18),
                        ),
                        Expanded(
                          child: Text(
                            trip.$2,
                            textAlign: TextAlign.end,
                            style: const TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              fontVariations: [FontVariation('wght', 800)],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('${trip.$3} · 12 seats available'),
                    const SizedBox(height: 10),
                    _Action(
                      'View trip',
                      () => _open(context, 'bus-trip'),
                      color: _busRed,
                    ),
                  ],
                ),
              ),
            ),
        ],
        'bus-trip' => [
          const _Heading(
            'Western Express',
            'Kampala → Mbarara · 07:30 to 11:50 EAT',
          ),
          const _Section('Choose a seat'),
          Center(
            child: _Panel(
              color: Colors.white,
              child: SizedBox(
                width: 240,
                child: Column(
                  children: [
                    const Align(
                      alignment: Alignment.centerRight,
                      child: Icon(Icons.airline_seat_recline_normal),
                    ),
                    const SizedBox(height: 8),
                    for (var row = 0; row < 5; row++)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          for (var col = 0; col < 4; col++)
                            ChoiceChip(
                              showCheckmark: false,
                              label: Text('${row * 4 + col + 1}'),
                              selected: selectedSeat == row * 4 + col + 1,
                              selectedColor: const Color(0xfff5c1bc),
                              onSelected: (_) => setState(
                                () => selectedSeat = row * 4 + col + 1,
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
          _Section('Seat $selectedSeat · UGX 32,000'),
        ],
        'bus-ticket' => [
          _Panel(
            color: Colors.white,
            radius: 20,
            child: Column(
              children: [
                const Text(
                  'WESTERN EXPRESS',
                  style: TextStyle(
                    color: _busRed,
                    fontWeight: FontWeight.w800,
                    fontVariations: [FontVariation('wght', 800)],
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 16),
                const _Heading('Kampala → Mbarara', '07:30 EAT · Seat 12A'),
                const Divider(height: 32),
                const Icon(Icons.qr_code_2, size: 110),
                const SizedBox(height: 8),
                const Text('Sample ticket · Preview only'),
              ],
            ),
          ),
        ],
        'bus-tickets' => [
          const _RowLink(
            Icons.confirmation_number_outlined,
            'Kampala → Mbarara',
            'Saturday · 07:30 · Seat 12A',
            'bus-ticket',
          ),
        ],
        'bus-parks' => [
          const _RowLink(
            Icons.location_on_outlined,
            'Kisenyi Bus Terminal',
            'Kampala · Western routes',
            'bus-park',
          ),
        ],
        'bus-park' => [
          const _Heading('Kisenyi Bus Terminal', 'Kampala · Boarding location'),
          const SizedBox(height: 12),
          const SizedBox(
            height: 240,
            child: ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(18)),
              child: _PreviewMap(),
            ),
          ),
          const _RowLink(
            Icons.directions_bus,
            'Western Express',
            'Kampala → Mbarara',
            'bus-results',
          ),
        ],
        _ => [
          const _Heading(
            'Western Express',
            'Operator dashboard · Sample activity',
          ),
          const _RowLink(
            Icons.route_outlined,
            'Departures',
            'Review scheduled trips',
            'bus-results',
          ),
          const _RowLink(
            Icons.confirmation_number_outlined,
            'Tickets',
            'See example boarding tickets',
            'bus-tickets',
          ),
          const _RowLink(
            Icons.location_on_outlined,
            'Bus park',
            'Kisenyi Bus Terminal',
            'bus-park',
          ),
        ],
      },
      footer: screen == 'bus-trip'
          ? _Action(
              'Passenger details',
              () => _open(context, 'bus-passengers'),
              color: _busRed,
            )
          : null,
    );
  }
}
