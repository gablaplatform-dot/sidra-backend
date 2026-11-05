import 'core/motion/motion_background.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/application/session_controller.dart';
import 'features/settings/application/theme_controller.dart';

class GablaApp extends ConsumerWidget {
  const GablaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The signed-in session must finish loading from secure storage before
    // the router's redirect logic (which depends on it) can make a correct
    // first decision - otherwise a signed-in user would flash through
    // `/login` on cold start.
    final session = ref.watch(sessionControllerProvider);

    if (session.isLoading) {
      return const MaterialApp(home: _SplashScreen());
    }

    final router = ref.watch(appRouterProvider);
    final preferences = ref.watch(themeControllerProvider);
    return MaterialApp.router(
      title: 'Gabla',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.resolve(
        preferences.style,
        Brightness.light,
        preferences.colors,
        preferences.fontGroup,
      ),
      darkTheme: AppTheme.resolve(
        preferences.style,
        Brightness.dark,
        preferences.colors,
        preferences.fontGroup,
      ),
      themeMode: preferences.mode,
      routerConfig: router,
      builder: (context, child) =>
          AppMotionSurface(child: child ?? const SizedBox.shrink()),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.navy,
      body: Center(
        child: Text(
          'Gabla',
          style: TextStyle(
            color: AppColors.gold,
            fontSize: 32,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
