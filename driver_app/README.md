# Gabla Driver

Flutter driver application for the Gabla ride service.

## Local setup

```sh
flutter pub get
flutter run
```

For Android Maps, set `GOOGLE_MAPS_API_KEY=your-driver-android-key` in
`android/local.properties` (ignored by Git), or provide the `GOOGLE_MAPS_API_KEY`
environment variable when building. The key must allow Maps SDK for Android and
be restricted to this app's package and signing certificate.

Signing credentials and local SDK paths must be configured on each developer's machine.
