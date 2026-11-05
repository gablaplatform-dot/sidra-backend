import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A device-local cart (`listingId -> quantity`), kept outside any account
/// until checkout - mirrors `public_app/src/lib/cart.js`. Quantity per item
/// is clamped to 1-99, same as the web app.
class CartController extends Notifier<Map<String, int>> {
  static const _prefsKey = 'gabla_cart';

  @override
  Map<String, int> build() {
    _restore();
    return const {};
  }

  Future<void> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    try {
      final decoded = (jsonDecode(raw) as Map).cast<String, dynamic>();
      state = decoded.map((key, value) => MapEntry(key, (value as num).toInt()));
    } catch (_) {
      // Corrupt/old cache - start from an empty cart rather than crash.
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(state));
  }

  void add(String listingId, {int quantity = 1}) {
    final next = Map<String, int>.from(state);
    final current = next[listingId] ?? 0;
    next[listingId] = (current + quantity).clamp(1, 99);
    state = next;
    _persist();
  }

  void setQuantity(String listingId, int quantity) {
    final next = Map<String, int>.from(state);
    next[listingId] = quantity.clamp(1, 99);
    state = next;
    _persist();
  }

  void remove(String listingId) {
    final next = Map<String, int>.from(state)..remove(listingId);
    state = next;
    _persist();
  }

  void clear() {
    state = const {};
    _persist();
  }
}

final cartControllerProvider =
    NotifierProvider<CartController, Map<String, int>>(CartController.new);

final cartCountProvider = Provider<int>((ref) {
  final cart = ref.watch(cartControllerProvider);
  return cart.values.fold<int>(0, (sum, qty) => sum + qty);
});
