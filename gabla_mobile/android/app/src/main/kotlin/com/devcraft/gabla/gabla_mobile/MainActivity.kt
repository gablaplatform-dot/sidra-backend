package com.devcraft.gabla.gabla_mobile

import android.content.pm.PackageManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var locations: GoogleLocationServices? = null
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        locations = GoogleLocationServices(applicationContext)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gabla/google_location")
            .setMethodCallHandler { call, result -> locations?.handle(call,result) }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gabla/maps_configuration")
            .setMethodCallHandler { call, result ->
                if (call.method == "isConfigured") {
                    @Suppress("DEPRECATION")
                    val info = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
                    val key = info.metaData?.getString("com.google.android.geo.API_KEY").orEmpty().trim()
                    result.success(key.isNotEmpty() && !key.startsWith("YOUR_"))
                } else { result.notImplemented() }
            }
    }
    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gabla/google_location").setMethodCallHandler(null)
        locations?.close()
        locations = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
