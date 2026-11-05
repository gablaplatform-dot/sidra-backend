import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gabla_mobile/app.dart';

void main() {
  testWidgets('App shows a splash while the session loads', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: GablaApp()));
    expect(find.text('Gabla'), findsOneWidget);
  });
}
