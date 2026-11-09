import '../../../core/motion/artwork_hero.dart';
import '../../../core/theme/font_group.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/motion/design_transitions.dart';

const destinations = [
  (
    'Shop',
    'Every seller. One storefront.',
    Icons.shopping_bag_outlined,
    '/shop',
  ),
  (
    'Services',
    'Good people. Great work.',
    Icons.handyman_outlined,
    '/services',
  ),
  (
    'Bus tickets',
    'A window seat to somewhere new.',
    Icons.directions_bus_outlined,
    '/bus',
  ),
  (
    'Get a ride',
    'Your city. Your next stop.',
    Icons.two_wheeler_outlined,
    '/ride',
  ),
  ('Jobs', 'Your next opportunity starts here.', Icons.work_outline, '/jobs'),
  (
    'Events',
    'Good nights. Great company.',
    Icons.local_activity_outlined,
    '/events',
  ),
];
const serviceArtwork = ['shop', 'services', 'bus', 'ride', 'jobs', 'events'];

/// Five compositions share real destinations; artwork is bundled, not fetched.
class DesignLauncher extends StatelessWidget {
  const DesignLauncher({super.key, required this.style});
  final AppThemeStyle style;

  @override
  Widget build(BuildContext context) => switch (style) {
    AppThemeStyle.gabla => _classic(context),
    AppThemeStyle.editorial => _editorial(context),
    AppThemeStyle.discover => _deck(context),
    AppThemeStyle.cinematic => _cinema(context),
    AppThemeStyle.orbit => _orbit(context),
  };

  Widget _heading(
    BuildContext context,
    String eyebrow,
    String first,
    String second, {
    bool serif = false,
    double size = 43,
  }) {
    final colors = Theme.of(context).colorScheme;
    return DesignEntrance(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(2, 28, 2, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: colors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    eyebrow,
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 1.8,
                      fontWeight: FontWeight.w700,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              first,
              style: TextStyle(
                fontSize: size,
                fontFamily: AppTypography.of(context).heading,
                fontVariations:
                    AppTypography.of(context).heading == 'DM Serif Display'
                    ? null
                    : const [FontVariation('wght', 760)],
                height: 1.02,
                letterSpacing: -1.8,
                fontWeight: serif ? FontWeight.w400 : FontWeight.w800,
              ),
            ),
            Text(
              second,
              style: TextStyle(
                fontSize: size,
                fontFamily: AppTypography.of(context).heading,
                fontVariations:
                    AppTypography.of(context).heading == 'DM Serif Display'
                    ? null
                    : const [FontVariation('wght', 760)],
                fontStyle: serif ? FontStyle.italic : null,
                height: 1.08,
                letterSpacing: -1.8,
                color: colors.primary,
                fontWeight: serif ? FontWeight.w400 : FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _classic(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(
        context,
        'YOUR EVERYDAY, A LITTLE EASIER',
        'Find your thing.',
        'Right here.',
      ),
      _ArtCard(index: 0, height: 240, tag: 'THE GABLA STOREFRONT'),
      const SizedBox(height: 14),
      Row(
        children: [
          Expanded(child: _ArtCard(index: 3, height: 204, compact: true)),
          const SizedBox(width: 14),
          Expanded(child: _ArtCard(index: 2, height: 204, compact: true)),
        ],
      ),
      const SizedBox(height: 14),
      _ServiceStrip(),
      const SizedBox(height: 14),
      _communityPair(),
    ],
  );

  Widget _editorial(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(
        context,
        'A CURATED WAY TO DO EVERYDAY',
        'Life, locally.',
        'Beautifully.',
        serif: true,
        size: 48,
      ),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              children: [
                const _ArtCard(
                  index: 0,
                  height: 292,
                  editorial: true,
                  tag: 'THE GOOD FINDS',
                ),
                const SizedBox(height: 18),
                const _ArtCard(index: 2, height: 220, editorial: true),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Column(
                children: [
                  const _ArtCard(index: 1, height: 220, editorial: true),
                  const SizedBox(height: 18),
                  const _ArtCard(index: 3, height: 292, editorial: true),
                ],
              ),
            ),
          ),
        ],
      ),
      const SizedBox(height: 20),
      _communityPair(editorial: true),
      const SizedBox(height: 20),
      Text(
        'Find. Connect. Make it happen.',
        style: Theme.of(context).textTheme.bodySmall,
      ),
    ],
  );

  Widget _deck(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(
        context,
        'FOLLOW YOUR CURIOSITY',
        'What’s next?',
        'Make it yours.',
      ),
      const _DiscoveryDeck(),
    ],
  );

  Widget _cinema(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(
        context,
        'GABLA — A WORLD WITHIN REACH',
        'Ordinary days.',
        'Extraordinary finds.',
        size: 38,
      ),
      for (final i in [3, 0, 2, 1, 4, 5]) ...[
        _ArtCard(
          index: i,
          height: i == 3 ? 380 : 270,
          cinematic: true,
          tag: i == 3 ? 'GO SOMEWHERE GOOD' : null,
        ),
        const SizedBox(height: 18),
      ],
    ],
  );

  Widget _communityPair({bool editorial = false}) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: _ArtCard(
          index: 4,
          height: 230,
          compact: true,
          editorial: editorial,
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: _ArtCard(
          index: 5,
          height: 230,
          compact: true,
          editorial: editorial,
        ),
      ),
    ],
  );

  Widget _orbit(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _heading(
        context,
        'A LITTLE BIT OF EVERYTHING',
        'Your world,',
        'all together.',
        size: 44,
      ),
      const _OrbitCollage(),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(child: _ArtCard(index: 2, height: 202, compact: true)),
          const SizedBox(width: 12),
          Expanded(child: _ArtCard(index: 1, height: 202, compact: true)),
        ],
      ),
      const SizedBox(height: 14),
      _communityPair(),
    ],
  );
}

class _ArtCard extends StatelessWidget {
  const _ArtCard({
    required this.index,
    required this.height,
    this.compact = false,
    this.editorial = false,
    this.cinematic = false,
    this.tag,
  });
  final int index;
  final double height;
  final bool compact, editorial, cinematic;
  final String? tag;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final d = destinations[index];
    final radius = editorial
        ? 6.0
        : cinematic
        ? 20.0
        : 28.0;
    return DesignEntrance(
      index: index,
      child: _PressTile(
        onTap: () => context.push(d.$4),
        label: d.$1,
        child: SizedBox(
          height: height + (MediaQuery.textScalerOf(context).scale(1) - 1) * 80,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(radius),
            child: Stack(
              fit: StackFit.expand,
              children: [
                _Artwork(index: index),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      stops: const [0, .38, 1],
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: .03),
                        Colors.black.withValues(alpha: cinematic ? .86 : .7),
                      ],
                    ),
                  ),
                ),
                if (tag != null)
                  Positioned(
                    top: 16,
                    left: 16,
                    right: 16,
                    child: Align(
                      alignment: Alignment.topLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .88),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          tag!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF242A30),
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: 16,
                  right: 14,
                  bottom: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (cinematic)
                        Text(
                          'GABLA / ${serviceArtwork[index].toUpperCase()}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: .7),
                            fontSize: 9,
                            letterSpacing: 2,
                          ),
                        ),
                      const SizedBox(height: 6),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Text(
                              d.$1,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: cinematic
                                    ? 34
                                    : compact || editorial
                                    ? 22
                                    : 30,
                                fontWeight: editorial || cinematic
                                    ? FontWeight.w400
                                    : FontWeight.w700,
                                letterSpacing: -.8,
                                height: 1.05,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            width: compact || editorial ? 28 : 36,
                            height: compact || editorial ? 28 : 36,
                            decoration: BoxDecoration(
                              color: colors.primary,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.north_east,
                              size: 17,
                              color: colors.onPrimary,
                            ),
                          ),
                        ],
                      ),
                      if (!compact && !editorial) ...[
                        const SizedBox(height: 8),
                        Text(
                          d.$2,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: .86),
                            fontSize: 11,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.index});
  final int index;
  @override
  Widget build(BuildContext context) => ArtworkHero(
    tag: 'service-artwork-$index',
    child: Image.asset(
      'assets/artwork/${serviceArtwork[index]}.jpg',
      fit: BoxFit.cover,
      excludeFromSemantics: true,
      cacheWidth: 900,
    ),
  );
}

class _ServiceStrip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return DesignEntrance(
      child: _PressTile(
        onTap: () => context.push('/services'),
        label: 'Services',
        child: Container(
          height: 114,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: colors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(26),
          ),
          child: Row(
            children: [
              const SizedBox(
                width: 108,
                height: 114,
                child: _Artwork(index: 1),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Services',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: colors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Find your next trusted pro',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Icon(
                  Icons.arrow_outward,
                  size: 20,
                  color: colors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscoveryDeck extends StatefulWidget {
  const _DiscoveryDeck();
  @override
  State<_DiscoveryDeck> createState() => _DiscoveryDeckState();
}

class _DiscoveryDeckState extends State<_DiscoveryDeck> {
  final _page = PageController(viewportFraction: .87);
  int _selected = 0;
  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final colors = Theme.of(context).colorScheme;
    return Column(
      children: [
        SizedBox(
          height: 390 + (MediaQuery.textScalerOf(context).scale(1) - 1) * 80,
          child: PageView.builder(
            controller: _page,
            itemCount: destinations.length,
            onPageChanged: (i) => setState(() => _selected = i),
            itemBuilder: (context, i) => AnimatedBuilder(
              animation: _page,
              builder: (context, child) {
                final page = _page.hasClients && _page.position.haveDimensions
                    ? _page.page ?? 0
                    : 0.0;
                final delta = (page - i).clamp(-1.0, 1.0);
                return Transform.translate(
                  offset: Offset(0, reduced ? 0 : delta.abs() * 24),
                  child: Transform.rotate(
                    angle: reduced ? 0 : delta * .045,
                    child: Transform.scale(
                      scale: reduced ? 1 : 1 - delta.abs() * .06,
                      child: child,
                    ),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 4, 14, 18),
                child: _ArtCard(
                  index: i,
                  height: 370,
                  tag: [
                    'FIND YOUR NEXT FAVORITE',
                    'PEOPLE YOU CAN COUNT ON',
                    'THE JOURNEY STARTS HERE',
                    'TAKE THE SCENIC ROUTE',
                    'MAKE YOUR NEXT MOVE',
                    'FIND YOUR PEOPLE',
                  ][i],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < destinations.length; i++)
              AnimatedContainer(
                duration: Duration(milliseconds: reduced ? 0 : 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _selected ? 26 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == _selected
                      ? colors.primary
                      : colors.outlineVariant,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Swipe to find your next thing',
          style: TextStyle(fontSize: 11),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _OrbitCollage extends StatefulWidget {
  const _OrbitCollage();
  @override
  State<_OrbitCollage> createState() => _OrbitCollageState();
}

class _OrbitCollageState extends State<_OrbitCollage>
    with SingleTickerProviderStateMixin {
  late final _motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 7),
  );
  @override
  void initState() {
    super.initState();
    _motion.value = 0;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) || !TickerMode.of(context)) {
      _motion.stop();
    } else if (!_motion.isAnimating) {
      _motion.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return VisibilityDetector(
      key: ObjectKey(this),
      onVisibilityChanged: (info) {
        if (!mounted) return;
        if (info.visibleFraction == 0 ||
            MediaQuery.disableAnimationsOf(context) ||
            !TickerMode.of(context)) {
          _motion.stop();
        } else if (!_motion.isAnimating) {
          _motion.repeat(reverse: true);
        }
      },
      child: SizedBox(
        height: 345,
        child: LayoutBuilder(
          builder: (context, constraints) => AnimatedBuilder(
            animation: _motion,
            builder: (context, _) {
              final drift = math.sin(_motion.value * math.pi * 2) * 6;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    top: 30,
                    left: 28,
                    right: 28,
                    bottom: 35,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: colors.primary.withValues(alpha: .12),
                          width: 30,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 22 + drift,
                    left: 5,
                    width: constraints.maxWidth * .57,
                    height: 265,
                    child: Transform.rotate(
                      angle: -.1,
                      child: const _ArtCard(
                        index: 0,
                        height: 265,
                        compact: true,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 68 - drift,
                    right: 2,
                    width: constraints.maxWidth * .53,
                    height: 255,
                    child: Transform.rotate(
                      angle: .1,
                      child: const _ArtCard(
                        index: 3,
                        height: 255,
                        compact: true,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 0,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 9,
                      ),
                      decoration: BoxDecoration(
                        color: colors.secondary,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        'A world of possibilities',
                        style: TextStyle(
                          color: colors.onSecondary,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _PressTile extends StatefulWidget {
  const _PressTile({
    required this.child,
    required this.onTap,
    required this.label,
  });
  final Widget child;
  final VoidCallback onTap;
  final String label;
  @override
  State<_PressTile> createState() => _PressTileState();
}

class _PressTileState extends State<_PressTile> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: widget.label,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onHighlightChanged: (value) => setState(() => pressed = value),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        child: AnimatedScale(
          scale: pressed ? .965 : 1,
          duration: Duration(
            milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 180,
          ),
          curve: Curves.easeOutCubic,
          child: widget.child,
        ),
      ),
    ),
  );
}
