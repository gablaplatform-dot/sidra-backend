import 'package:flutter/material.dart';

import '../theme.dart';
import '../services/api_client.dart';
import 'dashboard_tab.dart';
import 'trips_history_tab.dart';
import 'wallet_tab.dart';
import 'profile_tab.dart';

class HomeShell extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic> driver;
  final String? userName;
  final VoidCallback onLogout;
  const HomeShell({super.key, required this.api, required this.driver, required this.userName, required this.onLogout});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      DashboardTab(api: widget.api, driver: widget.driver),
      TripsHistoryTab(api: widget.api),
      WalletTab(api: widget.api),
      ProfileTab(api: widget.api, driver: widget.driver, userName: widget.userName, onLogout: widget.onLogout),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: Colors.white,
        indicatorColor: GablaColors.gold.withValues(alpha: 0.25),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded), label: 'Drive'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long_rounded), label: 'Trips'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet_rounded), label: 'Wallet'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
