import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/features/categories/domain/category.dart';
import 'package:gabla_mobile/features/categories/domain/category_artwork.dart';
import 'package:gabla_mobile/features/categories/presentation/widgets/category_cover.dart';

void main() {
  test('only the first seven provider directory IDs receive artwork', () {
    expect(providerCategoryArtwork.keys.toSet(), {
      'cmq7q7svm000fubkdhwf98m4g',
      'cmq7qkfw4000tubkddp732of8',
      'cmq9v0adb001dubkd4lfm00at',
      'cmqch43oh002dubkdedlno08a',
      'cmqcreszc0031ubkd5xzpq46r',
      'cmqcth3fs0041ubkdsvz86yv6',
      'cmqctv568004lubkdxhstzuui',
    });
    expect(
      providerCategoryArtwork.containsKey('cmqdsf84g005vubkd2lildzss'),
      isFalse,
    ); // Health care, eighth.
    for (final asset in providerCategoryArtwork.values) {
      final bytes = File(asset).readAsBytesSync();
      expect(bytes.take(3), [0xff, 0xd8, 0xff]);
    }
  });

  test('admin image URLs and category names remain unchanged', () {
    final c = Category.fromJson({
      'id': 'cmq7q7svm000fubkdhwf98m4g',
      'name': 'Rental',
      'settings': {'imageUrl': 'https://example.com/admin.png'},
    });
    expect(c.imageUrl, 'https://example.com/admin.png');
    expect(c.name, 'Rental');
  });

  test('missing covers use a category photo or inherit the parent cover', () {
    final category = Category.fromJson({
      'id': 'kids',
      'name': 'Babies & Kids',
      'children': [
        {'id': 'strollers', 'name': 'Strollers'},
        {'id': 'phones', 'name': 'Phones'},
      ],
    });
    expect(category.fallbackArtwork, 'assets/categories/kids.jpg');
    expect(category.children.first.fallbackArtwork, category.fallbackArtwork);
    expect(
      category.children.last.fallbackArtwork,
      'assets/categories/phones.jpg',
    );
    for (final entry in [category, ...category.children]) {
      expect(File(entry.fallbackArtwork).existsSync(), isTrue);
    }
  });

  testWidgets('new category with no image renders a graceful fallback', (
    tester,
  ) async {
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
    expect(tester.takeException(), isNull);
  });
}
