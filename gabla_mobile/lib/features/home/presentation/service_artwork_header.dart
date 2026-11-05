import '../../../core/widgets/feature_visual.dart';
import 'package:flutter/material.dart';
import '../../../core/motion/artwork_hero.dart';
import '../../../core/theme/font_group.dart';

class ServiceArtworkHeader extends StatelessWidget {
  const ServiceArtworkHeader({super.key, required this.index});
  final int index;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: SizedBox(
      height: 140,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ArtworkHero(
              tag: 'service-artwork-$index',
              child: FeatureVisual(
                kind: ['shop', 'services', 'bus', 'ride'][index],
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.transparent],
                ),
              ),
            ),
            Positioned(
              left: 20,
              bottom: 18,
              right: 20,
              child: Text(
                [
                  'Shop products',
                  'Browse services',
                  'Find bus tickets',
                  'Book a ride',
                ][index],
                maxLines: 2,
                style: AppTypography.of(context).display(
                  size: 27,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
