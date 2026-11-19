import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class BusPickupButton extends StatelessWidget {
  const BusPickupButton({
    super.key,
    required this.name,
    this.latitude,
    this.longitude,
  });
  final String name;
  final double? latitude, longitude;
  @override
  Widget build(BuildContext context) => TextButton.icon(
    icon: const Icon(Icons.directions_outlined, size: 18),
    label: const Text('Directions to pickup'),
    onPressed: () async {
      final hasPin =
          latitude != null &&
          longitude != null &&
          latitude!.isFinite &&
          longitude!.isFinite &&
          latitude!.abs() <= 90 &&
          longitude!.abs() <= 180;
      final target = hasPin ? '$latitude,$longitude' : '$name, Uganda';
      try {
        final opened = await launchUrl(
          Uri.https('www.google.com', '/maps/dir/', {
            'api': '1',
            'destination': target,
          }),
          mode: LaunchMode.externalApplication,
        );
        if (!opened && context.mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Pickup: $name')));
      } catch (_) {
        if (context.mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Pickup: $name')));
      }
    },
  );
}
