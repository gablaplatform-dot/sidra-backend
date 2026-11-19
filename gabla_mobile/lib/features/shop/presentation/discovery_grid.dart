import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/artwork_hero.dart';
import '../../categories/domain/category.dart';
import '../../categories/presentation/widgets/category_cover.dart';
import '../domain/product.dart';
import '../domain/product_navigation.dart';

double discoveryRatio(String id) =>
    [0.82, 1.04, 0.72, 1.2, 0.9][id.codeUnits.fold(0, (a, b) => a + b) % 5];

class DiscoveryGrid extends StatelessWidget {
  const DiscoveryGrid({
    super.key,
    this.categories,
    this.products,
    this.onCategory,
    required this.radius,
  });
  final List<Category>? categories;
  final List<Product>? products;
  final ValueChanged<Category>? onCategory;
  final double radius;

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.fromLTRB(6, 8, 6, 12),
    sliver: SliverMasonryGrid.count(
      crossAxisCount: 2,
      mainAxisSpacing: 16,
      crossAxisSpacing: 8,
      childCount: categories?.length ?? products!.length,
      itemBuilder: (context, index) {
        final category = categories == null ? null : categories![index];
        final product = products == null ? null : products![index];
        final id = category?.id ?? product!.id;
        return _Pin(
          key: ValueKey(id),
          id: id,
          name: category?.name ?? product!.name,
          imageUrl: product?.imageUrl,
          category: category,
          product: product,
          onCategory: onCategory,
          radius: radius,
          index: index,
        );
      },
    ),
  );
}

class _Pin extends StatefulWidget {
  const _Pin({
    super.key,
    required this.id,
    required this.name,
    required this.radius,
    required this.index,
    this.imageUrl,
    this.category,
    this.product,
    this.onCategory,
  });
  final String id, name;
  final String? imageUrl;
  final Category? category;
  final Product? product;
  final ValueChanged<Category>? onCategory;
  final double radius;
  final int index;

  @override
  State<_Pin> createState() => _PinState();
}

class _PinState extends State<_Pin> {
  final _hero = Object();

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final c = Theme.of(context).colorScheme;
    final fallback = AspectRatio(
      aspectRatio: discoveryRatio(widget.id),
      child: ColoredBox(
        color: c.surfaceContainerHigh,
        child: Icon(Icons.image_outlined, color: c.outline),
      ),
    );
    final image = widget.category != null
        ? AspectRatio(
            aspectRatio: discoveryRatio(widget.id),
            child: CategoryCover(category: widget.category!),
          )
        : widget.imageUrl?.isNotEmpty == true
        ? Image.network(
            widget.imageUrl!,
            width: double.infinity,
            fit: BoxFit.fitWidth,
            cacheWidth: 640,
            frameBuilder: (context, child, frame, synchronous) =>
                frame == null ? DiscoveryShimmer(child: fallback) : child,
            errorBuilder: (_, _, _) => fallback,
          )
        : fallback;
    final pin = Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(widget.radius),
        onTap: () {
          if (widget.category case final category?) {
            widget.onCategory!(category);
          } else {
            final product = widget.product!;
            context.push(
              '/shop/product/${Uri.encodeComponent(product.id)}',
              extra: ProductNavigation(product: product, heroTag: _hero),
            );
          }
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(widget.radius),
              child: ArtworkHero(tag: _hero, child: image),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 4, 0),
              child: Text(
                widget.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontSize: 13,
                  height: 1.3,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (reduced) return pin;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 280 + math.min(widget.index, 8) * 25),
      curve: Curves.easeOutCubic,
      child: pin,
      builder: (context, progress, child) => Opacity(
        opacity: progress,
        child: Transform.translate(
          offset: Offset(
            (widget.index.isEven ? -18 : 18) * (1 - progress),
            20 * (1 - progress),
          ),
          child: Transform.rotate(angle: .025 * (1 - progress), child: child),
        ),
      ),
    );
  }
}

class DiscoverySkeleton extends StatelessWidget {
  const DiscoverySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    Widget card(int index) => Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: discoveryRatio('skeleton$index'),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: c.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          const SizedBox(height: 8),
          FractionallySizedBox(
            widthFactor: .7,
            child: Container(height: 11, color: c.surfaceContainerHigh),
          ),
        ],
      ),
    );
    return DiscoveryShimmer(
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Column(children: [card(0), card(2), card(4)])),
            const SizedBox(width: 8),
            Expanded(child: Column(children: [card(1), card(3), card(5)])),
          ],
        ),
      ),
    );
  }
}

class DiscoveryShimmer extends StatefulWidget {
  const DiscoveryShimmer({super.key, required this.child});
  final Widget child;
  @override
  State<DiscoveryShimmer> createState() => _DiscoveryShimmerState();
}

class _DiscoveryShimmerState extends State<DiscoveryShimmer>
    with SingleTickerProviderStateMixin {
  late final _clock = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) || !TickerMode.of(context)) {
      _clock.stop();
    } else {
      _clock.repeat();
    }
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _clock,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment(-3 + _clock.value * 6, -.3),
          end: Alignment(-1 + _clock.value * 6, .3),
          colors: const [
            Colors.transparent,
            Color(0x55FFFFFF),
            Colors.transparent,
          ],
          stops: const [.1, .5, .9],
        ).createShader(bounds),
        child: child,
      ),
    );
  }
}
