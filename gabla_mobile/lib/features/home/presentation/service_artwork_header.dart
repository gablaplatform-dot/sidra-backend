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
      height: 155,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ArtworkHero(
              tag: 'service-artwork-$index',
              child: Image.asset(
                'assets/artwork/${['shop', 'services', 'bus', 'ride'][index]}.png',
                fit: BoxFit.cover,
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black54],
                ),
              ),
            ),
            Positioned(
              left: 20,
              bottom: 18,
              right: 20,
              child: Text(
                [
                  'Good finds, all together.',
                  'Find your next trusted pro.',
                  'Your next journey starts here.',
                  'Your city. Your next stop.',
                ][index],
                maxLines: 2,
                style: AppTypography.of(
                  context,
                ).display(size: 27, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
