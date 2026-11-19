import 'dart:async';
import 'package:flutter/material.dart';

/// Refreshes visible order screens while the app is active.
class OrderUpdates extends StatefulWidget {
  const OrderUpdates({
    super.key,
    required this.refresh,
    required this.child,
    this.enabled = true,
  });

  final Future<void> Function() refresh;
  final Widget child;
  final bool enabled;

  @override
  State<OrderUpdates> createState() => _OrderUpdatesState();
}

class _OrderUpdatesState extends State<OrderUpdates>
    with WidgetsBindingObserver {
  Timer? _timer;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted ||
        !widget.enabled ||
        _busy ||
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed ||
        ModalRoute.of(context)?.isCurrent == false)
      return;
    _busy = true;
    try {
      await widget.refresh();
    } catch (_) {
      // The existing order provider owns the error and retry UI.
    } finally {
      _busy = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
