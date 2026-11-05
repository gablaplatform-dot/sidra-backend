import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../settings/application/theme_controller.dart';
import '../application/auth_controller.dart';
import '../application/session_controller.dart';

/// Five compositions, sharing one native Google flow and the website's API.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});
  final String? next;
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  late final _ambient = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 12),
  );
  AppThemeStyle? _previous;
  bool _reduced = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = MediaQuery.disableAnimationsOf(context);
    if (_reduced) {
      _entrance.value = 1;
      _ambient.stop();
    } else {
      _entrance.forward();
      if (!_ambient.isAnimating) _ambient.repeat(reverse: true);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_reduced) {
      _ambient.repeat(reverse: true);
    } else {
      _ambient.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _entrance.dispose();
    _ambient.dispose();
    super.dispose();
  }

  Future<void> _google() async {
    await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (!mounted) return;
    final session = ref.read(sessionControllerProvider).valueOrNull;
    if (session == null || ref.read(authControllerProvider).hasError) return;
    final target = loginDestination(
      widget.next,
      isBusOperator: session.isBusOperator,
    );
    context.go(
      session.isNewUser
          ? Uri(path: '/welcome', queryParameters: {'next': target}).toString()
          : target,
    );
  }

  Widget _reveal(Widget child, {double start = 0, bool sideways = false}) =>
      AnimatedBuilder(
        animation: _entrance,
        child: child,
        builder: (context, child) {
          final t = Curves.easeOutCubic.transform(
            ((_entrance.value - start) / (1 - start)).clamp(0.0, 1.0),
          );
          return Opacity(
            opacity: t,
            child: Transform.translate(
              offset: sideways
                  ? Offset(-28 * (1 - t), 0)
                  : Offset(0, 30 * (1 - t)),
              child: child,
            ),
          );
        },
      );

  @override
  Widget build(BuildContext context) {
    final style = ref.watch(themeControllerProvider.select((p) => p.style));
    if (_previous != style) {
      _previous = style;
      if (_reduced) {
        _entrance.value = 1;
      } else {
        _entrance.forward(from: 0);
      }
    }
    final c = Theme.of(context).colorScheme;
    final immersive =
        style == AppThemeStyle.discover || style == AppThemeStyle.cinematic;
    final ink = immersive ? Colors.white : c.onSurface;
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      backgroundColor: c.surface,
      body: Stack(
        children: [
          if (immersive) Positioned.fill(child: _immersiveBackground(style)),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                key: ValueKey(style),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Center(
                    child: SizedBox(
                      width: math.min(width, 580),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _toolbar(ink),
                            const SizedBox(height: 16),
                            switch (style) {
                              AppThemeStyle.gabla => _classic(c),
                              AppThemeStyle.editorial => _editorial(c),
                              AppThemeStyle.discover => _discover(
                                c,
                                constraints.maxHeight,
                              ),
                              AppThemeStyle.cinematic => _cinematic(
                                c,
                                constraints.maxHeight,
                              ),
                              AppThemeStyle.orbit => _orbit(c),
                            },
                            const SizedBox(height: 28),
                            _reveal(_actions(style, ink), start: .28),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _toolbar(Color ink) => Row(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.asset('assets/brand/icon-only.png', width: 38, height: 38),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          'Gabla',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.of(context).display(size: 24, color: ink),
        ),
      ),
      IconButton(
        tooltip: 'Design Studio',
        onPressed: () => context.push('/settings/appearance'),
        icon: Icon(Icons.tune_rounded, color: ink),
      ),
      IconButton(
        tooltip: 'Close sign in',
        onPressed: () => context.go('/home'),
        icon: Icon(Icons.close_rounded, color: ink),
      ),
    ],
  );

  Widget _eyebrow(String text, Color ink) => Text(
    text,
    style: TextStyle(
      color: ink,
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 2.3,
    ),
  );
  Widget _heading(String text, Color ink, {double size = 43}) => Text(
    text,
    style: AppTypography.of(context).display(size: size, color: ink),
  );
  Widget _body(String text, Color ink) => Text(
    text,
    style: TextStyle(
      color: ink.withValues(alpha: .78),
      height: 1.55,
      fontSize: 14,
    ),
  );

  Widget _classic(ColorScheme c) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _reveal(
        SizedBox(
          height: 236,
          child: Row(
            children: [
              Expanded(
                flex: 6,
                child: _photo(
                  'shop',
                  radius: 28,
                  child: const _PhotoLabel(
                    'A little discovery',
                    Icons.shopping_bag_outlined,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 4,
                child: Column(
                  children: [
                    Expanded(child: _photo('ride', radius: 24)),
                    const SizedBox(height: 10),
                    Expanded(child: _photo('services', radius: 24)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 28),
      _reveal(_eyebrow('YOUR EVERYDAY, CONNECTED', c.primary), start: .08),
      const SizedBox(height: 12),
      _reveal(
        _heading('Your world.\nA little closer.', c.onSurface),
        start: .12,
      ),
      const SizedBox(height: 14),
      _reveal(
        _body(
          'Find your next favourite. Book your next journey. Make it yours with Gabla.',
          c.onSurface,
        ),
        start: .18,
      ),
    ],
  );

  Widget _editorial(ColorScheme c) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _reveal(
        Row(
          children: [
            Expanded(child: _eyebrow('THE EVERYDAY EDIT', c.onSurface)),
            Icon(Icons.north_east, color: c.primary),
          ],
        ),
        sideways: true,
      ),
      const SizedBox(height: 16),
      _reveal(
        _heading('Good things\nstart here.', c.onSurface, size: 49),
        start: .08,
        sideways: true,
      ),
      const SizedBox(height: 24),
      _reveal(
        SizedBox(
          height: 215,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(flex: 7, child: _photo('services', radius: 2)),
              const SizedBox(width: 12),
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _photo('shop', radius: 2)),
                    const SizedBox(height: 10),
                    Text(
                      'LOCAL FINDS.\nNEW STORIES.',
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.7,
                        letterSpacing: 1.1,
                        fontWeight: FontWeight.w700,
                        color: c.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        start: .14,
        sideways: true,
      ),
      const SizedBox(height: 22),
      Divider(color: c.outlineVariant),
      const SizedBox(height: 10),
      _reveal(
        _body(
          'Your address book for a life well explored. One account for everything you love.',
          c.onSurface,
        ),
        start: .22,
      ),
    ],
  );

  Widget _discover(ColorScheme c, double height) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(height: (height * .2).clamp(92.0, 210.0)),
      _reveal(
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: .28),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white30),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.explore_outlined, size: 16, color: Colors.white),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'A world waiting for you',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 22),
      _reveal(
        _heading('Go where\nlife takes you.', Colors.white, size: 47),
        start: .12,
      ),
      const SizedBox(height: 18),
      _reveal(
        _body(
          'The ride. The find. The weekend plan.\nBring it all together.',
          Colors.white,
        ),
        start: .2,
      ),
      const SizedBox(height: 12),
    ],
  );

  Widget _cinematic(ColorScheme c, double height) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      SizedBox(height: (height * .12).clamp(50.0, 120.0)),
      _reveal(
        Center(
          child: Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white54),
            ),
            child: const Icon(
              Icons.auto_awesome_outlined,
              color: Colors.white,
              size: 26,
            ),
          ),
        ),
      ),
      const SizedBox(height: 30),
      _reveal(
        Center(child: _eyebrow('EVERY DAY HAS A STORY', Colors.white70)),
        start: .12,
      ),
      const SizedBox(height: 20),
      _reveal(
        Text(
          'Make room\nfor more.',
          textAlign: TextAlign.center,
          style: AppTypography.of(
            context,
          ).display(size: 51, color: Colors.white),
        ),
        start: .2,
      ),
      const SizedBox(height: 18),
      _reveal(
        Text(
          'Extraordinary finds. Familiar places.\nYour next chapter starts with Gabla.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white70,
            height: 1.6,
            fontSize: 14,
          ),
        ),
        start: .26,
      ),
      const SizedBox(height: 25),
      Center(child: Container(height: 30, width: 1, color: Colors.white54)),
    ],
  );

  Widget _orbit(ColorScheme c) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AnimatedBuilder(
        animation: _ambient,
        builder: (context, _) {
          final t = _reduced ? 0.0 : math.sin(_ambient.value * math.pi * 2);
          return SizedBox(
            height: 252,
            child: LayoutBuilder(
              builder: (context, box) => Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: c.primary.withValues(alpha: .22),
                      ),
                    ),
                  ),
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: c.secondaryContainer.withValues(alpha: .5),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    top: 16 + t * 5,
                    child: Transform.rotate(
                      angle: -.13 + t * .02,
                      child: SizedBox(
                        width: box.maxWidth * .47,
                        height: 158,
                        child: _photo('shop', radius: 24),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 0,
                    top: 58 - t * 7,
                    child: Transform.rotate(
                      angle: .13 - t * .025,
                      child: SizedBox(
                        width: box.maxWidth * .46,
                        height: 158,
                        child: _photo('ride', radius: 24),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 10 + t * 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color: c.primary,
                        borderRadius: BorderRadius.circular(40),
                        boxShadow: [
                          BoxShadow(
                            color: c.shadow.withValues(alpha: .12),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.favorite_outline,
                            size: 17,
                            color: c.onPrimary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'All your favourites, together',
                            style: TextStyle(
                              fontSize: 11,
                              color: c.onPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
      const SizedBox(height: 20),
      _reveal(
        Center(child: _eyebrow('FIND YOUR LITTLE EVERYDAY', c.primary)),
        start: .08,
      ),
      const SizedBox(height: 13),
      _reveal(
        Text(
          'A whole lot\nto love.',
          textAlign: TextAlign.center,
          style: AppTypography.of(
            context,
          ).display(size: 46, color: c.onSurface),
        ),
        start: .15,
      ),
      const SizedBox(height: 15),
      _reveal(
        Text(
          'Shopping, services and journeys.\nOne happy place to keep them all.',
          textAlign: TextAlign.center,
          style: TextStyle(color: c.onSurfaceVariant, height: 1.55),
        ),
        start: .22,
      ),
    ],
  );

  Widget _immersiveBackground(AppThemeStyle style) => AnimatedBuilder(
    animation: _ambient,
    builder: (context, _) => Stack(
      fit: StackFit.expand,
      children: [
        Transform.scale(
          scale: _reduced ? 1.06 : 1.06 + _ambient.value * .045,
          alignment: Alignment.topCenter,
          child: Image.asset(
            'assets/artwork/${style == AppThemeStyle.cinematic ? 'services' : 'ride'}.png',
            fit: BoxFit.cover,
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: style == AppThemeStyle.cinematic
                  ? const [
                      Color(0xAA07101A),
                      Color(0xD907101A),
                      Color(0xFF07101A),
                    ]
                  : const [
                      Color(0x88071121),
                      Color(0x66071121),
                      Color(0xF2071121),
                    ],
            ),
          ),
        ),
      ],
    ),
  );

  Widget _photo(String name, {double radius = 24, Widget? child}) => ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: Stack(
      fit: StackFit.expand,
      children: [
        Image.asset('assets/artwork/$name.png', fit: BoxFit.cover),
        if (child != null)
          Align(
            alignment: Alignment.bottomLeft,
            child: Padding(padding: const EdgeInsets.all(12), child: child),
          ),
      ],
    ),
  );

  Widget _actions(AppThemeStyle style, Color ink) {
    final state = ref.watch(authControllerProvider);
    final c = Theme.of(context).colorScheme;
    final immersive =
        style == AppThemeStyle.discover || style == AppThemeStyle.cinematic;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (state.hasError)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Semantics(
              liveRegion: true,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.errorContainer,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  state.error is ApiException
                      ? (state.error as ApiException).message
                      : 'Could not sign in. Please try again.',
                  style: TextStyle(color: c.onErrorContainer),
                ),
              ),
            ),
          ),
        SizedBox(
          height: 56,
          child: OutlinedButton(
            key: const Key('google-sign-in'),
            style: OutlinedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF1F1F1F),
              side: const BorderSide(color: Color(0xFF747775)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  style == AppThemeStyle.editorial ? 4 : 28,
                ),
              ),
            ),
            onPressed: state.isLoading ? null : _google,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (state.isLoading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  const GoogleBrandMark(),
                const SizedBox(width: 12),
                Flexible(
                  child: Text(
                    state.isLoading ? 'Signing in…' : 'Continue with Google',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Sign in or create your account in one step.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            height: 1.5,
            color: ink.withValues(alpha: .66),
          ),
        ),
        const SizedBox(height: 18),
        TextButton(
          onPressed: state.isLoading ? null : () => context.go('/home'),
          style: TextButton.styleFrom(foregroundColor: ink),
          child: const Text('Explore as a guest'),
        ),
        TextButton(
          onPressed: state.isLoading
              ? null
              : () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (_) => const _ReconnectBusinessSheet(),
                ),
          style: TextButton.styleFrom(
            foregroundColor: immersive ? Colors.white70 : c.onSurfaceVariant,
          ),
          child: const Text(
            'Already have a business on Gabla?',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11),
          ),
        ),
      ],
    );
  }
}

String loginDestination(String? next, {bool isBusOperator = false}) {
  final uri = next == null ? null : Uri.tryParse(next);
  if (uri != null &&
      !uri.hasScheme &&
      !uri.hasAuthority &&
      next!.startsWith('/') &&
      !next.startsWith('//') &&
      uri.path != '/login' &&
      uri.path != '/welcome' &&
      !next.contains('\\'))
    return next;
  return isBusOperator ? '/bus/operator' : '/home';
}

class _PhotoLabel extends StatelessWidget {
  const _PhotoLabel(this.text, this.icon);
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .94),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: Colors.black87),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 9,
              color: Colors.black87,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

/// Google's unmodified multi-colour G paths, from the official brand asset.
class GoogleBrandMark extends StatelessWidget {
  const GoogleBrandMark({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 20,
    height: 20,
    child: CustomPaint(painter: _GooglePainter()),
  );
}

class _GooglePainter extends CustomPainter {
  const _GooglePainter();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 48, size.height / 48);
    canvas.drawPath(
      Path()
        ..moveTo(24, 9.5)
        ..cubicTo(27.5, 9.5, 30.6, 10.7, 33.1, 13.1)
        ..lineTo(39.9, 6.3)
        ..cubicTo(35.8, 2.4, 30.3, 0, 24, 0)
        ..cubicTo(14.6, 0, 6.5, 5.4, 2.6, 13.2)
        ..lineTo(10.5, 19.3)
        ..cubicTo(12.4, 13.6, 17.7, 9.5, 24, 9.5)
        ..close(),
      Paint()..color = const Color(0xFFEA4335),
    );
    canvas.drawPath(
      Path()
        ..moveTo(46.5, 24.5)
        ..cubicTo(46.5, 22.9, 46.4, 21.4, 46.1, 20)
        ..lineTo(24, 20)
        ..lineTo(24, 29)
        ..lineTo(36.7, 29)
        ..cubicTo(36.1, 32, 34.4, 34.5, 31.9, 36.2)
        ..lineTo(39.4, 42)
        ..cubicTo(43.8, 37.9, 46.5, 31.9, 46.5, 24.5)
        ..close(),
      Paint()..color = const Color(0xFF4285F4),
    );
    canvas.drawPath(
      Path()
        ..moveTo(10.5, 28.7)
        ..cubicTo(9.5, 25.7, 9.5, 22.3, 10.5, 19.3)
        ..lineTo(2.6, 13.2)
        ..cubicTo(-.9, 20, -.9, 28, 2.6, 34.8)
        ..close(),
      Paint()..color = const Color(0xFFFBBC05),
    );
    canvas.drawPath(
      Path()
        ..moveTo(24, 48)
        ..cubicTo(30.5, 48, 35.9, 45.9, 39.9, 42.2)
        ..lineTo(32.4, 36.4)
        ..cubicTo(30.3, 37.8, 27.5, 38.7, 24, 38.7)
        ..cubicTo(17.7, 38.7, 12.4, 34.6, 10.5, 28.9)
        ..lineTo(2.6, 35)
        ..cubicTo(6.5, 42.6, 14.6, 48, 24, 48)
        ..close(),
      Paint()..color = const Color(0xFF34A853),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ReconnectBusinessSheet extends ConsumerStatefulWidget {
  const _ReconnectBusinessSheet();
  @override
  ConsumerState<_ReconnectBusinessSheet> createState() =>
      _ReconnectBusinessSheetState();
}

class _ReconnectBusinessSheetState
    extends ConsumerState<_ReconnectBusinessSheet> {
  final _email = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;
  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      24,
      28,
      24,
      MediaQuery.viewInsetsOf(context).bottom + 24,
    ),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Reconnect your business',
            style: AppTypography.of(context).display(size: 28),
          ),
          const SizedBox(height: 14),
          Text(
            _sent
                ? 'If this email belongs to a business, you’ll receive a link to connect Google. Check your inbox.'
                : 'Use the email registered to your Gabla business. We’ll send you a secure link to connect your Google account.',
            style: const TextStyle(height: 1.5),
          ),
          if (!_sent) ...[
            const SizedBox(height: 20),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: InputDecoration(
                labelText: 'Business email',
                errorText: _error,
              ),
              enabled: !_busy,
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy
                  ? null
                  : () async {
                      if (!RegExp(
                        r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                      ).hasMatch(_email.text.trim())) {
                        setState(() => _error = 'Enter a valid email address.');
                        return;
                      }
                      setState(() {
                        _busy = true;
                        _error = null;
                      });
                      try {
                        await ref
                            .read(apiClientProvider)
                            .post(
                              '/providers/link-google/request',
                              body: {'email': _email.text.trim()},
                            );
                        if (mounted) setState(() => _sent = true);
                      } catch (e) {
                        if (mounted)
                          setState(
                            () => _error = e is ApiException
                                ? e.message
                                : 'Could not send the link. Try again.',
                          );
                      } finally {
                        if (mounted) setState(() => _busy = false);
                      }
                    },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_busy ? 'Sending…' : 'Send connection link'),
              ),
            ),
          ],
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(_sent ? 'Done' : 'Cancel'),
          ),
        ],
      ),
    ),
  );
}
