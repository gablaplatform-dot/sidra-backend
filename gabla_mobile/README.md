# Gabla Mobile

Native Flutter rewrite of the Gabla customer app (previously a Capacitor-wrapped
web app, see `../mobile_app` and `../public_app` in the `sidra-backend` monorepo).
Talks to the same Sidra API (`https://sidra-api.fly.dev/api/v1`).

## Stack

- **State management:** [flutter_riverpod](https://pub.dev/packages/flutter_riverpod) - plain
  `Provider` / `NotifierProvider` / `AsyncNotifierProvider` / `FutureProvider`, no code generation.
- **Routing:** [go_router](https://pub.dev/packages/go_router), one route per web page so the two
  apps stay easy to cross-reference.
- **Networking:** [dio](https://pub.dev/packages/dio), wrapped in `ApiClient` to mirror the
  web app's `src/lib/api.js` contract (bearer token, `X-Renewed-Token`, 401 → sign out).
- **Session storage:** `flutter_secure_storage` (the access token + user), `shared_preferences`
  for non-sensitive local state (the cart, the in-progress ride).
- **Auth:** Google Sign-In, same `/auth/google` exchange as the web app.
- **Location:** `geolocator` (device GPS) + `geocoding` (address ⇄ coordinates), used by Ride
  and opt-in Nearby location. Nearby uses native Google Maps satellite imagery; see
  [native Maps setup](docs/NATIVE_MAPS.md) for Android/iOS keys.
- **Theming:** 5 switchable design styles (Settings → Design studio), each with its own light/dark
  `ThemeData` - see "Appearance / theming" below.

## Project layout

```
lib/
  core/                   # cross-feature: network, storage, router, theme, shared widgets, utils
  features/
    auth/                 # session + Google sign-in
    home/                 # the 4-tile dashboard (Shop / Services / Bus / Ride)
    categories/            # directory (/categories) + service (/service-categories) trees
    shop/                  # product categories, listings, product detail
    services/              # bookable listings + bookings
    bus/                    # trips, parks, tickets
    cart/                   # device-local cart
    orders/                 # order history
    provider/                # provider profile, token-gated onboarding, listing form
    ride/                    # ride-hailing: estimate, request, confirm, live tracking
    search/                  # thin placeholder, wired into the router
```

Each feature follows `data/` (repositories over `ApiClient`) → `domain/` (plain model classes) →
`application/` (Riverpod providers/controllers) → `presentation/` (screens/widgets). Screens not
yet built show `PlaceholderScreen` so every route from the web app (`public_app/src/App.jsx`) has
a reachable, demo-able counterpart here - see that file for the full route map this mirrors.

## Running

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=https://sidra-api.fly.dev/api/v1
```

`API_BASE_URL` defaults to the production API if omitted (see `lib/core/config/env.dart`).

Google Sign-In needs native setup before it works end to end:
`android/app/google-services.json` and the iOS `GoogleService-Info.plist` / URL scheme, plus
`--dart-define=GOOGLE_CLIENT_ID=<web-client-id>` if a specific Google client ID is required.

## What's implemented vs. stubbed

Fully wired to the API: sign-in, home dashboard, shop browsing (categories, new arrivals, best
sellers, collections, product detail), cart + checkout (one order per seller, matching the
multi-vendor `Cart.jsx` flow), bus home/search/parks/trip/tickets, services browsing + booking a
service (date/time picking, availability calendar) + My Bookings, my orders, provider detail,
and ride-hailing (fare estimate, request, driver confirmation, live polling, resume-on-restart).

Provider onboarding is **not** a self-serve "become a provider" screen - on the web app it's
entirely gated behind an admin-sent invite link (`?token=...`), and there is no endpoint a
customer can call to register as a provider on their own. This app mirrors that: the screen only
renders a usable form when opened via a deep link carrying a token, e.g.
`gabla:///provider/onboarding?token=<invite-token>` (note the triple slash - the custom `gabla://`
scheme has no host, so the path must start right after it). Opened any other way, it explains
that becoming a provider starts with an invite.

Routed but placeholder UI (`TODO` comments point at the web page to port): listing form, bus
operator portal/login/onboarding, category detail, profile sub-tabs (wallet, documents).

## Shopping experience

The customer shopping flow now has five native presentations, including distinct home heroes,
category/navigation treatments, filter transitions, product galleries, seller profiles, cart,
checkout and order receipts. Catalog filters use the same scoped query as the server facet counts.
Online order payments remain available only after seller acceptance. Quotations and receipts open
in the app through authenticated PDF requests.

See [shopping behavior map and verification](docs/SHOP_EXPERIENCE.md) for the web/backend audit,
endpoint coverage, design differences and remaining live-account checks.

## Appearance / theming

`lib/core/theme/` holds 5 selectable design styles (`AppThemeStyle`), each with its own light +
dark `ThemeData` under `styles/`:

- **Gabla Classic** - the real site's actual design tokens (`public_app/src/styles.css`): blue
  `#2563eb` accent, navy `#0b2046` ink, Inter, pill shapes, soft navy-tinted shadows. Default.
- **Editorial** - bold near-black headlines on soft lavender pastels, floating soft-shadow cards.
- **Discover** - vibrant purple/teal, full-bleed photo cards with a scrim + overlaid white text.
- **Cinematic** - dark-only, moody full-bleed photography, glass surfaces, warm gold accent.
- **Orbit** - floating collage, circular nearby map that expands into exploration.

Design studio keeps layouts, three-color palettes, typography, and ambient motion independent.
Each design remembers its custom palette. Six bundled font pairings work offline; users can choose
aurora, orbs, lines, or no background motion, with intensity and speed controls. Nearby has five
layout treatments, photo map pins, synchronized results, focus animation, and animated camera
changes. Home artwork and product photos use shared-element navigation, with design-specific
page transitions. Motion respects the system reduced-motion preference.

`StyleTokens` (a `ThemeExtension`) carries the handful of things `ThemeData` has no slot for -
pill/card corner radius, card visual treatment (bordered/floating/photo-scrim), section-title and
eyebrow text styles - read via `Theme.of(context).extension<StyleTokens>()`. `ThemeController`
(`features/settings`) owns design, display mode, palettes, typography, and motion preferences, persisted via
`shared_preferences`, and is the single thing `app.dart` reads to build `MaterialApp.router`'s
`theme`/`darkTheme`/`themeMode`. The picker lives at `/settings/appearance` (Profile → Appearance).

Home and the shop product card are fully rebuilt against the real site's actual layout (search
pill, Shop/Ride/Bus quick actions, photo category cards, bordered/floating product cards with
NEW/SALE badges) - earlier revisions of this app had drifted from the real design because they
were modeled on an unused component (`components/mobilehome/MobileHome.jsx`, dead code - the real
`/home` page is `pages/Home.jsx`) instead of what's actually live. Most other screens still use
Flutter's default Material widgets, which already pick up each style's colors/shapes/typography
automatically but haven't been hand-redesigned to the same degree yet.
