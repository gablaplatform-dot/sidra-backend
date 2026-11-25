import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Applied only once google-services.json exists (dropped in from the Firebase console - see the
// push-notifications setup steps) so a build without it yet still succeeds instead of failing
// with "File google-services.json is missing".
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val mapsLocalProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.devcraft.gabla.gabla_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.devcraft.gabla.gabla_mobile"
        manifestPlaceholders["GOOGLE_MAPS_API_KEY"] =
            System.getenv("GOOGLE_MAPS_ANDROID_API_KEY")
                ?: mapsLocalProperties.getProperty("maps.api.key", "")
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // Allow a release-mode presentation APK on low-memory build machines.
            // Store builds keep normal shrinking unless explicitly overridden.
            val shrinkRelease = providers.gradleProperty("gablaMinifyRelease").orNull != "false"
            isMinifyEnabled = shrinkRelease
            isShrinkResources = shrinkRelease
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
