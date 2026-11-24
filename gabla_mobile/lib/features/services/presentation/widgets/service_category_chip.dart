import 'package:flutter/material.dart';
import '../../../categories/domain/category.dart';
import '../../../categories/presentation/widgets/category_cover.dart';

/// A round photo pill for a service category - a "board cover", not a
/// product-shelf tile. Used in the horizontally scrolling category rail on
/// both the services home screen and the browse screen.
class ServiceCategoryChip extends StatelessWidget {
  const ServiceCategoryChip({
    super.key,
    required this.category,
    required this.selected,
    required this.onTap,
    this.size = 64,
  });
  final Category category;
  final bool selected;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: SizedBox(
        width: size + 20,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: size,
              height: size,
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? c.primary : Colors.transparent,
                  width: 2.5,
                ),
              ),
              child: ClipOval(child: CategoryCover(category: category)),
            ),
            const SizedBox(height: 6),
            Text(
              category.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                height: 1.15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? c.primary : c.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
