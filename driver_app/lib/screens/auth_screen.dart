import 'package:flutter/material.dart';

import '../theme.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';

class AuthScreen extends StatefulWidget {
  final ApiClient api;
  final SessionStore session;
  final VoidCallback onDone;
  const AuthScreen({super.key, required this.api, required this.session, required this.onDone});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isRegister = false;
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  Future<void> _submit() async {
    final phone = _phoneCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (phone.isEmpty || password.isEmpty || (_isRegister && _nameCtrl.text.trim().isEmpty)) {
      setState(() => _error = 'Fill in all fields.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.api.request(
        _isRegister ? '/auth/register/user' : '/auth/login',
        method: 'POST',
        auth: false,
        body: {
          'phone': phone,
          'password': password,
          if (_isRegister) 'name': _nameCtrl.text.trim(),
        },
      ) as Map<String, dynamic>;
      final user = result['user'] as Map<String, dynamic>;
      await widget.session.save(
        token: result['accessToken'] as String,
        userId: user['id'] as String,
        userName: user['name'] as String? ?? 'Driver',
      );
      widget.onDone();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: GablaColors.gold, borderRadius: BorderRadius.circular(18)),
                  child: const Icon(Icons.two_wheeler_rounded, color: GablaColors.navy, size: 34),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Gabla Driver', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: GablaColors.navy)),
              const SizedBox(height: 6),
              Text(
                _isRegister ? 'Create your driver account' : 'Sign in to start earning',
                textAlign: TextAlign.center,
                style: const TextStyle(color: GablaColors.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 32),
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: GablaColors.dangerBg, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: GablaColors.danger, fontSize: 13)),
                ),
                const SizedBox(height: 16),
              ],
              if (_isRegister) ...[
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full name')),
                const SizedBox(height: 14),
              ],
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone number', hintText: '+256 700 000000'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _passwordCtrl,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: 'Password',
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : Text(_isRegister ? 'Create account' : 'Sign in'),
              ),
              const SizedBox(height: 18),
              Center(
                child: TextButton(
                  onPressed: () => setState(() => _isRegister = !_isRegister),
                  child: Text(
                    _isRegister ? 'Already have an account? Sign in' : "New driver? Create an account",
                    style: const TextStyle(color: GablaColors.navy, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
