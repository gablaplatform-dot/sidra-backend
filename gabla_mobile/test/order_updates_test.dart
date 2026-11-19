import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/core/widgets/order_updates.dart';

void main() {
  testWidgets(
    'visible orders refresh, pause under another route, and resume with the app',
    (tester) async {
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      final navigator = GlobalKey<NavigatorState>();
      var calls = 0;
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          home: OrderUpdates(
            refresh: () async {
              calls++;
            },
            child: const Scaffold(body: Text('Orders')),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 15));
      expect(calls, 1);
      navigator.currentState!.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Other page')),
        ),
      );
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 15));
      expect(calls, 1);
      navigator.currentState!.pop();
      await tester.pumpAndSettle();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 15));
      expect(calls, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(calls, 2);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 15));
      expect(calls, 2);
    },
  );
}
