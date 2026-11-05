import '../../features/categories/presentation/categories_screen.dart';
import '../sharing/share_links.dart';
import '../../features/community/presentation/community_screens.dart';
import '../../features/community/presentation/community_editor_screen.dart';
import '../../features/workspace/presentation/workspace_screen.dart';
import '../../features/workspace/presentation/document_design_screen.dart';
import '../../features/shop/presentation/shop_browse_screen.dart';
import '../../features/shop/domain/product_navigation.dart';
import '../../features/settings/application/theme_controller.dart';
import '../theme/app_theme_style.dart';
import 'package:flutter/material.dart';
import '../../features/nearby/presentation/nearby_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/session_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/welcome_screen.dart';
import '../../features/bus/application/bus_providers.dart';
import '../../features/bus/presentation/bus_home_screen.dart';
import '../../features/bus/presentation/bus_onboarding_screen.dart';
import '../../features/bus/presentation/bus_operator_login_screen.dart';
import '../../features/bus/presentation/bus_operator_portal_screen.dart';
import '../../features/bus/presentation/bus_park_screen.dart';
import '../../features/bus/presentation/bus_parks_screen.dart';
import '../../features/bus/presentation/bus_search_screen.dart';
import '../../features/bus/presentation/bus_ticket_screen.dart';
import '../../features/bus/presentation/bus_tickets_screen.dart';
import '../../features/bus/presentation/bus_trip_screen.dart';
import '../../features/cart/presentation/cart_screen.dart';
import '../../features/cart/presentation/checkout_screen.dart';
import '../../features/categories/presentation/category_detail_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/orders/presentation/my_orders_screen.dart';
import '../../features/orders/presentation/provider_order_view_screen.dart';
import '../../features/profile/presentation/delete_account_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/services/presentation/booking_screen.dart';
import '../../features/services/presentation/my_bookings_screen.dart';
import '../../features/provider/presentation/listing_form_screen.dart';
import '../../features/provider/presentation/provider_detail_screen.dart';
import '../../features/provider/presentation/provider_onboarding_screen.dart';
import '../../features/ride/presentation/ride_screen.dart';
import '../../features/search/presentation/search_results_screen.dart';
import '../../features/settings/presentation/appearance_screen.dart';
import '../../features/services/presentation/service_browse_screen.dart';
import '../../features/services/presentation/services_screen.dart';
import '../../features/shop/presentation/product_detail_screen.dart';
import '../../features/shop/presentation/shop_categories_screen.dart';
import '../../features/shop/presentation/shop_collection_screen.dart';
import '../../features/shop/presentation/shop_screen.dart';

/// Pages that only make sense signed in - mirrors `SIGNED_IN_ONLY` in
/// `public_app/src/App.jsx`. Anything under these paths bounces to
/// `/login?next=<path>` when there is no session.
const _signedInOnly = ['/profile', '/orders', '/welcome'];

/// Rebuilds the router (and so re-evaluates `redirect`) whenever sign-in
/// state flips, same effect as the web app's `SessionGuard` listening for
/// `gabla-session-expired`.
final appRouterProvider = Provider<GoRouter>((ref) {
  final authChange = ValueNotifier(ref.read(isSignedInProvider));
  ref.listen(isSignedInProvider, (_, value) => authChange.value = value);
  ref.onDispose(authChange.dispose);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: authChange,
    redirect: (context, state) {
      final path = state.uri.path;
      final needsAuth = _signedInOnly.any(
        (p) => path == p || path.startsWith('$p/'),
      );
      if (needsAuth && !authChange.value) {
        return Uri(path: '/login', queryParameters: {'next': path}).toString();
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/share/:type/:id',
        redirect: (context, state) => sharedDestination(state.uri) ?? '/home',
      ),
      for (final kind in ['jobs', 'events']) ...[
        GoRoute(
          path: '/$kind',
          builder: (c, s) => CommunityHubScreen(kind: kind),
        ),
        GoRoute(
          path: '/$kind/mine',
          builder: (c, s) => CommunityHubScreen(kind: kind, scope: 'mine'),
        ),
        GoRoute(
          path: '/$kind/saved',
          builder: (c, s) => CommunityHubScreen(kind: kind, scope: 'saved'),
        ),
        GoRoute(
          path: '/$kind/new',
          builder: (c, s) => CommunityEditorScreen(kind: kind),
        ),
        GoRoute(
          path: '/$kind/edit/:id',
          builder: (c, s) =>
              CommunityEditorScreen(kind: kind, id: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/$kind/p/:id',
          builder: (c, s) =>
              CommunityDetailScreen(kind: kind, id: s.pathParameters['id']!),
        ),
      ],
      GoRoute(
        path: '/jobs/applications',
        builder: (c, s) => const CommunityApplicationsScreen(),
      ),
      GoRoute(
        path: '/jobs/applicants/:id',
        builder: (c, s) =>
            CommunityApplicationsScreen(postId: s.pathParameters['id']),
      ),
      GoRoute(
        path: '/nearby',
        pageBuilder: (context, state) {
          final style = ref.read(themeControllerProvider).style;
          final reduced = MediaQuery.disableAnimationsOf(context);
          return CustomTransitionPage(
            key: state.pageKey,
            child: const NearbyScreen(),
            transitionDuration: Duration(milliseconds: reduced ? 0 : 480),
            reverseTransitionDuration: Duration(
              milliseconds: reduced ? 0 : 350,
            ),
            transitionsBuilder: (context, animation, secondary, child) {
              if (reduced) return child;
              final eased = CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              );
              return FadeTransition(
                opacity: eased,
                child: switch (style) {
                  AppThemeStyle.gabla => SlideTransition(
                    position: Tween(
                      begin: const Offset(0, .13),
                      end: Offset.zero,
                    ).animate(eased),
                    child: child,
                  ),
                  AppThemeStyle.editorial => SlideTransition(
                    position: Tween(
                      begin: const Offset(.18, 0),
                      end: Offset.zero,
                    ).animate(eased),
                    child: child,
                  ),
                  AppThemeStyle.discover => ScaleTransition(
                    scale: Tween(begin: .93, end: 1.0).animate(eased),
                    child: child,
                  ),
                  AppThemeStyle.cinematic => ScaleTransition(
                    scale: Tween(begin: 1.04, end: 1.0).animate(eased),
                    child: child,
                  ),
                  AppThemeStyle.orbit => ClipOval(
                    clipper: _NearbyCircleClipper(eased.value),
                    child: child,
                  ),
                },
              );
            },
          );
        },
      ),
      GoRoute(
        path: '/provider/onboarding',
        builder: (c, s) =>
            ProviderOnboardingScreen(token: s.uri.queryParameters['token']),
      ),
      GoRoute(
        path: '/login',
        builder: (c, s) => LoginScreen(next: s.uri.queryParameters['next']),
      ),
      GoRoute(
        path: '/welcome',
        builder: (c, s) => WelcomeScreen(next: s.uri.queryParameters['next']),
      ),
      GoRoute(path: '/home', builder: (c, s) => const HomeScreen()),
      GoRoute(path: '/categories', builder: (c, s) => const CategoriesScreen()),
      GoRoute(
        path: '/category/:categoryId',
        builder: (c, s) =>
            CategoryDetailScreen(categoryId: s.pathParameters['categoryId']!),
      ),
      GoRoute(
        path: '/provider/:providerId',
        builder: (c, s) =>
            ProviderDetailScreen(providerId: s.pathParameters['providerId']!),
      ),
      GoRoute(path: '/profile', builder: (c, s) => const ProfileScreen()),
      GoRoute(
        path: '/profile/inquiries',
        builder: (c, s) => const WorkspaceScreen(section: 'inquiries'),
      ),
      GoRoute(
        path: '/profile/document-design',
        builder: (c, s) => const DocumentDesignScreen(),
      ),
      GoRoute(
        path: '/profile/promotion-new',
        builder: (c, s) => const PromotionCreateScreen(),
      ),
      GoRoute(
        path: '/profile/listings',
        builder: (c, s) => const WorkspaceScreen(section: 'listings'),
      ),
      GoRoute(
        path: '/profile/business',
        builder: (c, s) => const WorkspaceScreen(section: 'business'),
      ),
      GoRoute(
        path: '/profile/wallet',
        builder: (c, s) => const WorkspaceScreen(section: 'wallet'),
      ),
      GoRoute(
        path: '/profile/documents',
        builder: (c, s) => const WorkspaceScreen(section: 'documents'),
      ),
      GoRoute(
        path: '/profile/seller-orders',
        builder: (c, s) => const WorkspaceScreen(section: 'orders'),
      ),
      GoRoute(
        path: '/profile/reservations',
        builder: (c, s) => const WorkspaceScreen(section: 'bookings'),
      ),
      GoRoute(
        path: '/profile/categories',
        builder: (c, s) => const WorkspaceScreen(section: 'categories'),
      ),
      GoRoute(
        path: '/profile/analytics',
        builder: (c, s) => const WorkspaceScreen(section: 'analytics'),
      ),
      GoRoute(
        path: '/profile/ads',
        builder: (c, s) => const WorkspaceScreen(section: 'ads'),
      ),
      GoRoute(
        path: '/profile/saved',
        builder: (c, s) => const WorkspaceScreen(section: 'saved'),
      ),

      GoRoute(
        path: '/profile/orders/:orderId',
        builder: (c, s) =>
            ProviderOrderViewScreen(orderId: s.pathParameters['orderId']!),
      ),
      GoRoute(
        path: '/profile/bookings',
        builder: (c, s) => const MyBookingsScreen(),
      ),
      GoRoute(
        path: '/settings/appearance',
        builder: (c, s) => const AppearanceScreen(),
      ),
      GoRoute(
        path: '/account/delete',
        builder: (c, s) => const DeleteAccountScreen(),
      ),
      GoRoute(
        path: '/profile/listings/new',
        builder: (c, s) => const ListingFormScreen(),
      ),
      GoRoute(
        path: '/profile/listings/:listingId/edit',
        builder: (c, s) =>
            ListingFormScreen(listingId: s.pathParameters['listingId']),
      ),
      GoRoute(
        path: '/search',
        builder: (c, s) =>
            SearchResultsScreen(initialQuery: s.uri.queryParameters['q']),
      ),
      GoRoute(path: '/cart', builder: (c, s) => const CartScreen()),
      GoRoute(
        path: '/checkout',
        builder: (c, s) => CheckoutScreen(
          quickBuyId: s.uri.queryParameters['buy'],
          initialPaymentMethod: s.uri.queryParameters['payment'] == 'online'
              ? 'online'
              : 'cash',
        ),
      ),
      GoRoute(path: '/orders', builder: (c, s) => const MyOrdersScreen()),
      GoRoute(path: '/services', builder: (c, s) => const ServicesScreen()),
      GoRoute(
        path: '/services/all',
        builder: (c, s) =>
            ServiceBrowseScreen(parameters: s.uri.queryParameters),
      ),
      GoRoute(
        path: '/services/c/:categoryId',
        builder: (c, s) => ServiceBrowseScreen(
          categoryId: s.pathParameters['categoryId'],
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/services/booking/:listingId',
        builder: (c, s) =>
            BookingScreen(listingId: s.pathParameters['listingId']!),
      ),
      GoRoute(path: '/ride', builder: (c, s) => const RideScreen()),
      GoRoute(path: '/shop', builder: (c, s) => const ShopScreen()),
      GoRoute(
        path: '/shop/categories',
        builder: (c, s) => const ShopCategoriesScreen(),
      ),
      GoRoute(
        path: '/shop/new-arrivals',
        builder: (c, s) => ShopCollectionScreen(
          collection: 'new',
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/shop/best-sellers',
        builder: (c, s) => ShopCollectionScreen(
          collection: 'bestsellers',
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/shop/all',
        builder: (c, s) => ShopCollectionScreen(
          collection: 'all',
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/shop/product/:listingId',
        builder: (c, s) {
          final navigation = s.extra is ProductNavigation
              ? s.extra as ProductNavigation
              : null;
          return ProductDetailScreen(
            listingId: s.pathParameters['listingId']!,
            heroTag: navigation?.heroTag,
            previewProduct: navigation?.product,
          );
        },
      ),
      GoRoute(
        path: '/shop/:categoryId',
        builder: (c, s) => ShopScreen(
          categoryId: s.pathParameters['categoryId'],
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(
        path: '/provider/:providerId/catalog',
        builder: (c, s) => ShopBrowseScreen(
          providerId: s.pathParameters['providerId'],
          kind: s.uri.queryParameters['type'] ?? 'product',
          parameters: s.uri.queryParameters,
        ),
      ),
      GoRoute(path: '/bus', builder: (c, s) => const BusHomeScreen()),
      GoRoute(
        path: '/bus/search',
        builder: (c, s) => BusSearchScreen(query: s.extra as BusSearchQuery?),
      ),
      GoRoute(path: '/bus/parks', builder: (c, s) => const BusParksScreen()),
      GoRoute(
        path: '/bus/parks/:slug',
        builder: (c, s) => BusParkScreen(slug: s.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/bus/trip/:tripId',
        builder: (c, s) => BusTripScreen(tripId: s.pathParameters['tripId']!),
      ),
      GoRoute(
        path: '/bus/tickets',
        builder: (c, s) => const BusTicketsScreen(),
      ),
      GoRoute(
        path: '/bus/tickets/:ticketNumber',
        builder: (c, s) =>
            BusTicketScreen(ticketNumber: s.pathParameters['ticketNumber']!),
      ),
      GoRoute(
        path: '/bus/onboarding',
        builder: (c, s) =>
            BusOnboardingScreen(token: s.uri.queryParameters['token']),
      ),
      GoRoute(
        path: '/bus/operator/login',
        builder: (c, s) => const BusOperatorLoginScreen(),
      ),
      GoRoute(
        path: '/bus/operator',
        builder: (c, s) => const BusOperatorPortalScreen(),
      ),
      GoRoute(
        path: '/bus/operator/trips/:tripId',
        builder: (c, s) => BusOperatorPortalScreen(
          section: 'trips',
          tripId: s.pathParameters['tripId'],
        ),
      ),
      // The web app matches `/bus/operator/*` (any depth) for its portal SPA;
      // go_router routes are flat, so only depth-1 sub-paths are covered here.
      GoRoute(
        path: '/bus/operator/:section',
        builder: (c, s) => BusOperatorPortalScreen(
          section: s.pathParameters['section'] ?? 'dashboard',
        ),
      ),
      GoRoute(path: '/', redirect: (c, s) => '/home'),
    ],
    errorBuilder: (c, s) => const HomeScreen(),
  );
});

class _NearbyCircleClipper extends CustomClipper<Rect> {
  const _NearbyCircleClipper(this.progress);
  final double progress;
  @override
  Rect getClip(Size size) {
    final diameter = size.longestSide * 2 * progress;
    return Rect.fromCenter(
      center: Offset(size.width / 2, size.height * .3),
      width: diameter,
      height: diameter,
    );
  }

  @override
  bool shouldReclip(covariant _NearbyCircleClipper oldClipper) =>
      oldClipper.progress != progress;
}
