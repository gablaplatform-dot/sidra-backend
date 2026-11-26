import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gabla_mobile/features/provider/presentation/listing_form_screen.dart';

void main() {
  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          listingFormDataProvider.overrideWith(
            (ref, id) async => {
              'products': <dynamic>[],
              'services': <dynamic>[],
              'provider': <String, dynamic>{},
              'collections': <dynamic>[],
              'listing': null,
            },
          ),
        ],
        child: const MaterialApp(
          home: ListingFormScreen(initialType: 'service'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Accept online bookings'),
      300,
      scrollable: scrollable,
    );
    // `scrollUntilVisible` stops as soon as it's merely intersecting the
    // viewport, which can leave it clipped at the very edge - nudge further.
    for (var i = 0; i < 5; i++) {
      final rect = tester.getRect(find.text('Accept online bookings'));
      if (rect.top >= 0 && rect.bottom <= 600) break;
      await tester.drag(scrollable, const Offset(0, -150));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.text('Accept online bookings'));
    await tester.pumpAndSettle();
  }

  testWidgets('hour unit shows the rooms/guests counters', (tester) async {
    await pump(tester);

    expect(find.text('Rooms / spaces'), findsOneWidget);
    expect(find.text('Guests per room / space'), findsOneWidget);
    expect(find.text('Minimum duration'), findsOneWidget);
    expect(find.text('Maximum duration'), findsOneWidget);
  });

  testWidgets(
    'appointment unit hides the rooms/guests/duration counters',
    (tester) async {
      await pump(tester);

      // 'hour' is the default Price unit - switch it to 'appointment'.
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'hour'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('appointment').last);
      await tester.pumpAndSettle();

      expect(find.text('Rooms / spaces'), findsNothing);
      expect(find.text('Guests per room / space'), findsNothing);
      expect(find.text('Minimum duration'), findsNothing);
      expect(find.text('Maximum duration'), findsNothing);
      // Still relevant for a single-slot appointment.
      expect(find.text('Days ahead bookable'), findsOneWidget);
      expect(find.text('Advance notice (hours)'), findsOneWidget);
      expect(
        find.textContaining('customers pick a date and start time'),
        findsOneWidget,
      );
    },
  );
}
