import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gabla_mobile/core/network/api_client.dart';
import 'package:gabla_mobile/core/network/network_providers.dart';
import 'package:gabla_mobile/features/auth/application/session_controller.dart';
import 'package:gabla_mobile/features/auth/domain/session.dart';
import 'package:gabla_mobile/features/payments/presentation/payment_sheet.dart';
import 'package:gabla_mobile/features/orders/domain/order_input.dart';

class _Session extends SessionController {
  @override
  Future<Session?> build() async => null;
}

void main() {
  test(
    'authenticated PDF reads return bytes and keep token renewal handling',
    () async {
      String? renewed;
      String? authorization;
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              authorization = o.headers['Authorization']?.toString();
              h.resolve(
                Response(
                  requestOptions: o,
                  data: '%PDF-test'.codeUnits,
                  headers: Headers.fromMap({
                    'x-renewed-token': ['renewed'],
                  }),
                ),
                true,
              );
            },
          ),
        );
      final responder = dio.interceptors.removeLast();
      final api = ApiClient(
        dio: dio,
        getToken: () => 'token',
        onTokenRenewed: (t) => renewed = t,
        onUnauthorized: () {},
      );
      dio.interceptors.add(responder);
      expect(
        String.fromCharCodes(await api.getPdf('/documents/doc/pdf')),
        '%PDF-test',
      );
      expect(authorization, 'Bearer token');
      expect(renewed, 'renewed');
    },
  );
  test('delivery coordinates are included only with a complete point', () {
    expect(
      const FulfillmentInput.delivery(
        address: 'Kampala',
        lat: .34,
        lng: 32.58,
        locationSource: 'gps',
      ).toJson(),
      {
        'method': 'delivery',
        'address': 'Kampala',
        'lat': .34,
        'lng': 32.58,
        'locationSource': 'gps',
      },
    );
    expect(const FulfillmentInput.pickup().toJson(), {'method': 'pickup'});
    expect(
      const FulfillmentInput.delivery(
        address: 'Typed address',
        lat: .34,
      ).toJson().containsKey('lat'),
      false,
    );
  });
  testWidgets(
    'payment starts once, polls confirmation, and stops when closed',
    (tester) async {
      final api = _PaymentApi();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sessionControllerProvider.overrideWith(_Session.new),
            apiClientProvider.overrideWithValue(api),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: PaymentSheet(
                endpoint: '/payments/orders/order/pay',
                amount: 20000,
                title: 'Pay for order',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '0700000000');
      await tester.tap(find.text('Pay with mobile money'));
      await tester.pump();
      await tester.pump();
      expect(api.posts, 1);
      expect(find.text('Check your phone'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(api.polls, 1);
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(find.text('Payment confirmed'), findsOneWidget);
      expect(api.posts, 1);
      expect(api.polls, 2);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 9));
      expect(api.polls, 2);
      expect(tester.takeException(), isNull);
    },
  );
}

class _PaymentApi extends ApiClient {
  _PaymentApi()
    : super(
        getToken: () => null,
        onTokenRenewed: (_) {},
        onUnauthorized: () {},
      );
  int posts = 0, polls = 0;
  @override
  Future<T> post<T>(String path, {Object? body}) async {
    posts++;
    expect(path, '/payments/orders/order/pay');
    expect(body, {'phone': '0700000000'});
    return {'transactionId': 'tx'} as T;
  }

  @override
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    polls++;
    return {'status': polls < 2 ? 'pending' : 'succeeded'} as T;
  }
}
