import 'package:flutter/material.dart';

import 'theme.dart';
import 'services/api_client.dart';
import 'services/session_store.dart';
import 'screens/auth_screen.dart';
import 'screens/driver_application_screen.dart';
import 'screens/pending_screen.dart';
import 'screens/home_shell.dart';

void main() {
  runApp(const GablaDriverApp());
}

class GablaDriverApp extends StatelessWidget {
  const GablaDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gabla Driver',
      debugShowCheckedModeBanner: false,
      theme: buildGablaTheme(),
      home: const AppGate(),
    );
  }
}

enum GateState { loading, needsAuth, needsApplication, pending, rejected, approved, error }

/// Decides which top-level screen to show: sign in, driver application, a pending/rejected
/// status screen, or the approved driver home shell. Every screen below gets a [refresh]
/// callback so completing a step (login, submitting the application, etc.) re-evaluates this.
class AppGate extends StatefulWidget {
  const AppGate({super.key});
  @override
  State<AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<AppGate> {
  final session = SessionStore();
  late final ApiClient api = ApiClient(session);
  GateState _state = GateState.loading;
  Map<String, dynamic>? _driver;
  String? _userName;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _evaluate();
  }

  Future<void> _evaluate() async {
    setState(() => _state = GateState.loading);
    final token = await session.getToken();
    if (token == null) {
      setState(() => _state = GateState.needsAuth);
      return;
    }
    _userName = await session.getUserName();

    try {
      final driver = await api.request('/rides/drivers/me') as Map<String, dynamic>;
      _driver = driver;
      final status = driver['moderationStatus'] as String?;
      setState(() {
        if (status == 'approved') {
          _state = GateState.approved;
        } else if (status == 'rejected') {
          _state = GateState.rejected;
        } else {
          _state = GateState.pending;
        }
      });
    } on ApiException catch (e) {
      if (e.code == 'DRIVER_NOT_FOUND') {
        setState(() => _state = GateState.needsApplication);
      } else if (e.status == 401) {
        setState(() => _state = GateState.needsAuth);
      } else {
        // Anything else (a real 403/5xx from the API) is NOT the same as "no driver profile
        // yet" - showing the registration form here would let an already-registered driver
        // stumble into re-submitting. Surface a retry screen instead.
        setState(() {
          _state = GateState.error;
          _errorMessage = e.message;
        });
      }
    } catch (e) {
      // A raw connectivity failure (DNS, TLS handshake, timeout) never even reaches the
      // ApiException mapping in api_client.dart - without this catch-all the gate stayed on
      // GateState.loading forever (an infinite spinner) instead of offering a retry.
      setState(() {
        _state = GateState.error;
        _errorMessage = 'Unable to reach Gabla. Check your connection and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_state) {
      case GateState.loading:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case GateState.needsAuth:
        return AuthScreen(api: api, session: session, onDone: _evaluate);
      case GateState.needsApplication:
        return DriverApplicationScreen(api: api, onSubmitted: _evaluate, onLogout: () async {
          await session.clear();
          _evaluate();
        });
      case GateState.pending:
      case GateState.rejected:
        return PendingScreen(
          api: api,
          driver: _driver!,
          isRejected: _state == GateState.rejected,
          onRefresh: _evaluate,
          onLogout: () async {
            await session.clear();
            _evaluate();
          },
        );
      case GateState.approved:
        return HomeShell(api: api, driver: _driver!, userName: _userName, onLogout: () async {
          await session.clear();
          _evaluate();
        });
      case GateState.error:
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off_rounded, size: 40, color: GablaColors.textMuted),
                    const SizedBox(height: 16),
                    Text(
                      _errorMessage ?? 'Something went wrong.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: GablaColors.textMuted),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(onPressed: _evaluate, child: const Text('Try again')),
                  ],
                ),
              ),
            ),
          ),
        );
    }
  }
}
