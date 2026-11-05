# Native Google Maps satellite setup

The nearby screen uses the official Google Maps Flutter SDK with satellite imagery. Native map keys are separate from the web Maps JavaScript key. Enable Maps SDK for Android and/or Maps SDK for iOS in your Google Cloud project with billing enabled. Restrict each key to its native app.

## Android

Add `maps.api.key=YOUR_ANDROID_KEY` to `android/local.properties` (already ignored by Git). Alternatively set `GOOGLE_MAPS_ANDROID_API_KEY` in the build environment. The application ID is `com.devcraft.gabla.gabla_mobile`. Register the signing certificate SHA-1 for the APK you distribute.

Build: `flutter build apk --release`.

## iOS

Create `ios/Flutter/Maps.local.xcconfig` (ignored by Git) with `GOOGLE_MAPS_API_KEY = YOUR_IOS_KEY`. Register the Runner bundle identifier in the iOS key restriction. Run `flutter build ios` or build through Xcode.

The app reads only a native boolean indicating whether a key was configured; it never sends the key through Dart or stores it in settings. Without a key, the map shows an unavailable state and results/list search still work. A configured key must also have the appropriate SDK enabled and valid restrictions; native satellite imagery cannot be verified without those keys.

## Verified app identities

For the current presentation APKs (including v8), use:

- Google Cloud project inspected: `craftpayments-63619`.
- Android package: `com.devcraft.gabla.gabla_mobile`.
- Android APK signing certificate SHA-1: `6D:35:C8:3F:D3:A4:D3:44:10:96:1B:31:8A:00:D5:03:45:57:23:CA`.
- iOS bundle identifier: `com.devcraft.gabla.gablaMobile`.

Create a Maps SDK for Android key with the package/certificate restriction and a separate Maps SDK for iOS key with the bundle restriction. Current presentation APKs use the project's existing debug signing configuration. A future store release must register its actual distribution/Play App Signing certificate too.

Inspection found that the existing `nyumba` key permits Geocoding, Maps JavaScript, Places, Places (New), and Routes. It does not currently permit either native Maps SDK, and both native SDKs were disabled when inspected. No existing key restrictions were changed during inspection.

## Android setup scope approved

The Android Maps SDK was enabled in `craftpayments-63619`. iOS setup was not approved and remains unconfigured.

The requested new Android key allowlist is: Geocoding API, Maps JavaScript API, Places API, Places API (New), Routes API, and Maps SDK for Android. The package/certificate restriction above still applies. API allowlisting does not make a native Android key suitable for website use: browser maps continue using the separate web key. The Flutter map itself uses Maps SDK for Android.

## Android configuration completed (3 November 2026)

Created `Gabla Android` in `craftpayments-63619`, restricted to the verified package and signing certificate, with exactly the six APIs listed above. The existing `nyumba` key was unchanged. The new value is stored only in ignored `android/local.properties` and is supplied to the Android manifest at build time. No iOS key was created.

Android location searches now use Google Geocoding, Places autocomplete/details, and Routes through fixed native endpoints. The bridge attaches Android package/certificate headers and never returns the credential to Dart. Device GPS still supplies the physical location. Nearby, delivery, ride selection/road previews/live driver maps, unlocked seller map pins, and invite-based business location picking share this setup. Browser JavaScript maps continue to require the existing separate web key.

Verification: real Google Geocoding, Places and Routes calls succeeded with the approved Android identity; incorrect package/certificate requests were rejected. The Android emulator integration test passed native key detection, geocoding/reverse lookup, autocomplete, place details, road routing, Google satellite-map snapshot checks, and place-selection confirmation. Test APK v9 is a normal app build (not the integration-test harness), with the embedded key and signing identity checked before delivery.
