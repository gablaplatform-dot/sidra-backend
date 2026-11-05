import 'package:flutter_test/flutter_test.dart';

import 'package:gabla_driver/main.dart';

void main() {
  testWidgets('App boots to the loading gate without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(const GablaDriverApp());
    expect(find.byType(GablaDriverApp), findsOneWidget);
  });
}
