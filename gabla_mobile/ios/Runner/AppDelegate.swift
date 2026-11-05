import Flutter
import UIKit
import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var mapsConfigurationChannel: FlutterMethodChannel?
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let key = (Bundle.main.object(forInfoDictionaryKey: "GoogleMapsAPIKey") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let configured = !key.isEmpty && !key.hasPrefix("$(") && !key.hasPrefix("YOUR_")
    if configured { GMSServices.provideAPIKey(key) }
    GeneratedPluginRegistrant.register(with: self)
    if let registrar = registrar(forPlugin: "GablaMapsConfiguration") {
      let channel = FlutterMethodChannel(name: "gabla/maps_configuration", binaryMessenger: registrar.messenger())
      channel.setMethodCallHandler { call, result in
        if call.method == "isConfigured" { result(configured) }
        else { result(FlutterMethodNotImplemented) }
      }
      mapsConfigurationChannel = channel
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
