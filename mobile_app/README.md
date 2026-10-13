# Gabla mobile apps (Android + iOS)

A Capacitor shell around the storefront in `../public_app`. App name **Gabla**, id **com.devcraft.gabla**.
The web app is bundled inside the app and talks to `https://sidra-api.fly.dev/api/v1`.

## Everyday commands (from this folder)

| Task | Command |
| --- | --- |
| Rebuild the web app into the native projects | `npm run sync` |
| Build the Android test APK | `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk npm run android:apk` |
| Open the iOS project in Xcode | `npm run sync && open ios/App/App.xcodeproj` |
| Regenerate icons and splash from `assets/` | `npm run assets` |

The APK ends up in `android/app/build/outputs/apk/debug/app-debug.apk`.

## iOS to TestFlight
1. `open ios/App/App.xcodeproj` (the project uses Swift Package Manager, so there is no .xcworkspace).
2. Select the **App** target, then **Signing & Capabilities**, choose your Team. Bundle identifier is already `com.devcraft.gabla`.
3. Choose **Any iOS Device (arm64)** as the destination, then **Product > Archive**.
4. In the Organizer, **Distribute App > App Store Connect > Upload**. Build it in App Store Connect under TestFlight.
Bump **Version / Build** in the target's General tab for every upload.

## Android release (Play Store / sharing)
The debug APK is signed with a debug key, which is fine for testing. For the Play Store create a release keystore and
build `./gradlew bundleRelease` from `android/`; keep the keystore and its passwords safe, you cannot replace them later.

## Icons
`brand/` holds the vector sources (`icon-only.svg`, `icon-foreground.svg`, `icon-background.svg`, `splash.svg`) redrawn from the Gabla logo.
Replace them with the designer's original vector logo when available, then `npm run assets`.
