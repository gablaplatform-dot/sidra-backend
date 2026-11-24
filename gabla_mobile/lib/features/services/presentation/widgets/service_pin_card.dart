import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/motion/artwork_hero.dart';
import '../../../../core/motion/design_transitions.dart';
import '../../../../core/utils/money.dart';
import '../../../shop/domain/product.dart';
import '../../../shop/domain/product_navigation.dart';
import '../../../shop/presentation/commerce_widgets.dart';
import '../../domain/booking_config.dart';

/// A varied aspect ratio per listing - the irregular rhythm is what reads as
/// a mood board instead of a product shelf. Stable per id so a card doesn't
/// reshuffle height across rebuilds.
double servicePinRatio(String id) =>
    [0.72, 1.0, 1.3, 0.9, 1.15, 0.8][id.codeUnits.fold(0, (a, b) => a + b) % 6];

({IconData icon, String label})? serviceBookingBadge(Product product) {
  if (!product.bookable) return null;
  final cadence = switch (product.booking?.unit) {
    BookingUnit.appointment => 'appointment',
    BookingUnit.hour => 'by the hour',
    BookingUnit.day => 'by the day',
    BookingUnit.night => 'by the night',
    null => null,
  };
  if (product.bookingMode == 'instant') {
    return (
      icon: Icons.bolt_rounded,
      label: cadence == null ? 'Instant book' : 'Instant · $cadence',
    );
  }
  return (
    icon: Icons.calendar_month_rounded,
    label: cadence == null ? 'Request to book' : 'Book $cadence',
  );
}

/// The Pinterest-style browsing feed for services: a staggered masonry of
/// [ServicePinCard]s, deliberately not sharing a layout with the product
/// grid so services reads as its own place, not a shelf of goods.
class ServicePinGrid extends StatelessWidget {
  const ServicePinGrid({super.key, required this.items});
  final List<Product> items;
  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.fromLTRB(2, 2, 2, 16),
    sliver: SliverMasonryGrid.count(
      crossAxisCount: MediaQuery.sizeOf(context).width > 650 ? 3 : 2,
      mainAxisSpacing: 16,
      crossAxisSpacing: 10,
      childCount: items.length,
      itemBuilder: (context, i) =>
          ServicePinCard(key: ValueKey(items[i].id), product: items[i], index: i),
    ),
  );
}

/// Same masonry, as a plain box widget - for embedding inside a [ListView]
/// (the services home feed) rather than a [CustomScrollView] (the browse
/// screen's results).
class ServicePinBoxGrid extends StatelessWidget {
  const ServicePinBoxGrid({super.key, required this.items});
  final List<Product> items;
  @override
  Widget build(BuildContext context) => MasonryGridView.count(
    padding: const EdgeInsets.fromLTRB(2, 2, 2, 4),
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: MediaQuery.sizeOf(context).width > 650 ? 3 : 2,
    mainAxisSpacing: 16,
    crossAxisSpacing: 10,
    itemCount: items.length,
    itemBuilder: (context, i) =>
        ServicePinCard(key: ValueKey(items[i].id), product: items[i], index: i),
  );
}

class ServicePinCard extends StatefulWidget {
  const ServicePinCard({super.key, required this.product, this.index = 0});
  final Product product;
  final int index;
  @override
  State<ServicePinCard> createState() => _ServicePinCardState();
}

class _ServicePinCardState extends State<ServicePinCard> {
  final _hero = Object();

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final c = Theme.of(context).colorScheme;
    final badge = serviceBookingBadge(p);
    final initial = p.providerName?.trim().isNotEmpty == true
        ? p.providerName!.trim()[0].toUpperCase()
        : 'G';
    return DesignEntrance(
      index: widget.index,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => context.push(
            '/shop/product/${p.id}',
            extra: ProductNavigation(product: p, heroTag: _hero),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: ArtworkHero(
                  tag: _hero,
                  child: AspectRatio(
                    aspectRatio: servicePinRatio(p.id),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CommerceImage(p.imageUrl),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.transparent,
                                Colors.black87,
                              ],
                              stops: [0, .5, 1],
                            ),
                          ),
                        ),
                        if (badge != null)
                          Positioned(
                            left: 10,
                            top: 10,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: .55),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(badge.icon, size: 13, color: Colors.white),
                                    const SizedBox(width: 5),
                                    Text(
                                      badge.label,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        Positioned(
                          left: 12,
                          right: 12,
                          bottom: 12,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                p.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 9,
                                    backgroundColor: Colors.white24,
                                    child: Text(
                                      initial,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      p.providerName ?? 'Gabla provider',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 8, 6, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        p.price > 0 ? formatUgx(p.price) : 'Ask for a quote',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: c.primary,
                        ),
                      ),
                    ),
                    if (p.district != null)
                      Text(
                        p.district!,
                        style: TextStyle(fontSize: 10, color: c.onSurfaceVariant),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
