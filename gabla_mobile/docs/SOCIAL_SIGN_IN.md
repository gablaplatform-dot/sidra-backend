# Social sign-in — Android presentation build 13

The customer login now uses native Google sign-in. Password registration has been removed from this screen; the separate bus-operator password flow remains available. Apple sign-in and iOS OAuth configuration are deferred as requested. The current React login and API expose Google, not an Apple authentication endpoint.

## Android configuration

Google Cloud project: `gabla-502615` (Gabla), in the Habtom profile.

- Android client: **Gabla Flutter Android**, created with user approval on 2026-11-03.
- Android client ID: `478189678916-3p7qd5rs61moasc2hvv8nmibcgh9a0of.apps.googleusercontent.com`.
- Package: `com.devcraft.gabla.gabla_mobile`.
- Signing certificate SHA-1: `6D:35:C8:3F:D3:A4:D3:44:10:96:1B:31:8A:00:D5:03:45:57:23:CA`.
- Server/web client ID: `478189678916-l0t6k527ok7rra3p7tcpq8445suh46qj.apps.googleusercontent.com`.

`GoogleSignIn.serverClientId` uses the existing web client ID so the returned ID token has the audience already verified by `/auth/google`. The public client identifier is built into `Env`, with `GOOGLE_CLIENT_ID` available as a build-time override. No client secret is needed or included. Existing web and Capacitor clients were preserved. The Maps key is independent of OAuth and remains in ignored Android local configuration.

Google's creation dialog reported the project is in testing mode. Audience/publishing settings were not changed. Cloud notes that new OAuth settings can take five minutes to several hours to propagate. If a tester is blocked by Google's testing policy, review the project's test users before changing publishing status. Real account sign-in is left to the owner/tester; no personal Google session was used to create a live Gabla account during development.

For Google Play distribution, register the Play app-signing certificate as well. This APK uses the existing local signing identity so it can update the previous APK and retain the configured native Maps restriction.

## Flow and behavior

1. Native Google account picker requests email/profile and returns an ID token.
2. Flutter exchanges it using the existing `POST /auth/google` with `{idToken}`.
3. The API session is stored using the existing secure session controller.
4. New users see the welcome form and then return to their original internal destination.
5. Existing users return to checkout/booking/the requested screen; bus operators without a supplied destination go to their portal.
6. Picker cancellation is quiet, duplicate taps are ignored, and errors remain on screen with a retry button.
7. Existing businesses can request their Google connection link through the web app's `/providers/link-google/request` flow.

## Five login compositions

| Design | Composition | Motion |
| --- | --- | --- |
| Gabla Classic | Asymmetric shopping/ride/services mosaic | Staggered upward entrance |
| Editorial | Large serif headline, asymmetric print-style image spread | Sideways text and image reveals |
| Discover | Full-bleed ride artwork, floating caption, bottom actions | Slow image zoom and rising copy |
| Cinematic | Dark photographic poster, centered display title | Slow image zoom and staged reveals |
| Orbit | Tilted image collage around concentric rings | Gently drifting photos and staggered copy |

The toolbar links directly to Design Studio. Layouts inherit selected fonts and the theme's surface/text colors; photographic designs keep a dark overlay for contrast. Reduced motion stops continuous drift/zoom and shows entrance content immediately. Background animation pauses when the app is inactive.

Inspiration: [Dribbble login animation collection](https://dribbble.com/tags/login-animation), [mobile login flows](https://dribbble.com/search/mobile-login-flow). Google button follows the [official branding guidance](https://developers.google.com/identity/branding-guidelines). Native token configuration follows the [Flutter Google sign-in documentation](https://pub.dev/packages/google_sign_in/versions/6.3.0).

## Validation

- `flutter test test/social_login_test.dart`: 14 checks passed, covering five layouts at 320px with larger text/reduced motion and 430px with animation, safe return destinations, welcome/operator metadata, credential exchange, duplicate taps, and cancellation.
- `flutter analyze --no-pub --no-fatal-infos`: no errors or warnings; pre-existing informational style lints remain.
- Build: `flutter build apk --release --build-number=13`.
- Real Google account sign-in and Apple/iOS were not exercised by automated tests.
