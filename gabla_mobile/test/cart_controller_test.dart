import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gabla_mobile/features/cart/application/cart_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('add/setQuantity/remove update the cart state', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(cartControllerProvider), isEmpty);

    container.read(cartControllerProvider.notifier).add('listing-1');
    expect(container.read(cartControllerProvider), {'listing-1': 1});
    expect(container.read(cartCountProvider), 1);

    container.read(cartControllerProvider.notifier).add('listing-1');
    expect(container.read(cartControllerProvider), {'listing-1': 2});

    container.read(cartControllerProvider.notifier).setQuantity('listing-1', 5);
    expect(container.read(cartControllerProvider), {'listing-1': 5});

    container.read(cartControllerProvider.notifier).remove('listing-1');
    expect(container.read(cartControllerProvider), isEmpty);
  });
}
