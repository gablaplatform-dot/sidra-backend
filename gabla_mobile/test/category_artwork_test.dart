import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/categories/domain/category_artwork.dart';
import 'package:gabla_mobile/features/categories/presentation/widgets/category_cover.dart';

void main() {
  test('fallback symbols describe the category', () {
    expect(providerCategoryIcon('Jobs'), Icons.work_outline);
    expect(providerCategoryIcon('Properties'), Icons.home_work_outlined);
    expect(providerCategoryIcon('Entertainment'), Icons.headphones_outlined);
    expect(
      providerCategoryIcon('Health care'),
      Icons.health_and_safety_outlined,
    );
    expect(providerCategoryIcon('Unclassified'), Icons.category_outlined);
  });
  testWidgets('first seven categories retain original admin photos', (
    tester,
  ) async {
    const category = Category(
      id: 'cmq7q7svm000fubkdhwf98m4g',
      name: 'Rental',
      imageUrl: 'https://example.test/admin-photo.jpg',
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: SizedBox(
          width: 136,
          height: 184,
          child: CategoryCover(category: category),
        ),
      ),
    );
    final image = tester.widget<Image>(find.byType(Image));
    final provider = image.image as ResizeImage;
    expect((provider.imageProvider as NetworkImage).url, category.imageUrl);
  });
  testWidgets(
    'missing category photo renders an icon without generated artwork',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: SizedBox(
            width: 136,
            height: 184,
            child: CategoryCover(
              category: Category(id: 'new', name: 'New category'),
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.category_outlined), findsOneWidget);
      expect(find.byType(Image), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
