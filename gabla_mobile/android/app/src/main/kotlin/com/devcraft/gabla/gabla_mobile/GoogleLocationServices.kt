package com.devcraft.gabla.gabla_mobile

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.Executors

/** Fixed Google endpoints only. The API key stays in native configuration. */
class GoogleLocationServices(private val context: Context) {
    private val pool = Executors.newFixedThreadPool(3)
    private val main = Handler(Looper.getMainLooper())
    @Suppress("DEPRECATION")
    private val key: String get() = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getString("com.google.android.geo.API_KEY").orEmpty()
    @Suppress("DEPRECATION")
    private fun certificate(): String {
        val manager = context.packageManager
        val signatures = if (Build.VERSION.SDK_INT >= 28) manager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo?.apkContentsSigners
            else manager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES).signatures
        return signatures?.firstOrNull()?.let { signature -> MessageDigest.getInstance("SHA-1").digest(signature.toByteArray()).joinToString("") { "%02X".format(it) } }.orEmpty()
    }
    private fun encode(value: String) = URLEncoder.encode(value, "UTF-8")
    private fun request(url: String, body: JSONObject? = null, mask: String? = null): JSONObject {
        if (key.isBlank()) throw IllegalStateException("Google Maps is not configured in this build.")
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 15000
        connection.setRequestProperty("X-Android-Package", context.packageName)
        connection.setRequestProperty("X-Android-Cert", certificate())
        connection.setRequestProperty("X-Goog-Api-Key", key)
        if (mask != null) connection.setRequestProperty("X-Goog-FieldMask", mask)
        try {
            if (body != null) {
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val data = JSONObject(stream?.bufferedReader()?.use { it.readText() } ?: "{}")
            if (status !in 200..299) throw IllegalStateException("Google location service is unavailable (${data.optJSONObject("error")?.optString("status") ?: status}).")
            return data
        } finally { connection.disconnect() }
    }
    private fun point(location: JSONObject, address: String): Map<String, Any> = mapOf("lat" to location.getDouble("lat"), "lng" to location.getDouble("lng"), "address" to address)
    private fun waypoint(lat: Double, lng: Double) = JSONObject().put("location", JSONObject().put("latLng", JSONObject().put("latitude", lat).put("longitude", lng)))
    private fun coordinate(call: MethodCall, name: String, min: Double, max: Double): Double {
        val value = call.argument<Number>(name)?.toDouble() ?: throw IllegalArgumentException("Missing coordinate")
        if (!value.isFinite() || value < min || value > max) throw IllegalArgumentException("Invalid coordinate")
        return value
    }
    fun handle(call: MethodCall, result: MethodChannel.Result) {
        if (call.method !in listOf("geocode", "reverse", "autocomplete", "place", "route")) { result.notImplemented(); return }
        pool.execute {
            try {
                val value: Any = when (call.method) {
                    "geocode", "reverse" -> {
                        val query = if (call.method == "reverse") "latlng=${coordinate(call,"lat",-90.0,90.0)},${coordinate(call,"lng",-180.0,180.0)}"
                            else "address=${encode(call.argument<String>("query").orEmpty().take(250))}&region=ug"
                        val data = request("https://maps.googleapis.com/maps/api/geocode/json?$query&key=${encode(key)}")
                        if (data.optString("status") != "OK") throw IllegalStateException(if(data.optString("status") == "ZERO_RESULTS") "No matching address was found." else "Google address lookup is unavailable.")
                        val first = data.getJSONArray("results").getJSONObject(0)
                        point(first.getJSONObject("geometry").getJSONObject("location"), first.optString("formatted_address"))
                    }
                    "autocomplete" -> {
                        val body = JSONObject().put("input", call.argument<String>("query").orEmpty().take(250))
                            .put("includedRegionCodes", JSONArray().put("ug")).put("sessionToken", call.argument<String>("session").orEmpty())
                        val suggestions = request("https://places.googleapis.com/v1/places:autocomplete",body).optJSONArray("suggestions") ?: JSONArray()
                        (0 until suggestions.length()).mapNotNull { i -> suggestions.getJSONObject(i).optJSONObject("placePrediction")?.let { p ->
                            mapOf("id" to p.optString("placeId"), "label" to p.optJSONObject("text")?.optString("text").orEmpty()) } }
                    }
                    "place" -> {
                        val id = call.argument<String>("id").orEmpty()
                        if (!id.matches(Regex("[A-Za-z0-9_-]{1,256}"))) throw IllegalArgumentException("Invalid place")
                        val data = request("https://places.googleapis.com/v1/places/${encode(id)}?sessionToken=${encode(call.argument<String>("session").orEmpty())}", mask="id,formattedAddress,location")
                        val loc = data.getJSONObject("location")
                        mapOf("lat" to loc.getDouble("latitude"), "lng" to loc.getDouble("longitude"), "address" to data.optString("formattedAddress"))
                    }
                    else -> {
                        val body = JSONObject().put("origin", waypoint(coordinate(call,"fromLat",-90.0,90.0),coordinate(call,"fromLng",-180.0,180.0)))
                            .put("destination", waypoint(coordinate(call,"toLat",-90.0,90.0),coordinate(call,"toLng",-180.0,180.0))).put("travelMode","DRIVE")
                        val routes = request("https://routes.googleapis.com/directions/v2:computeRoutes", body, "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline").optJSONArray("routes")
                        val route = routes?.optJSONObject(0) ?: throw IllegalStateException("No road route was found.")
                        mapOf("distanceMeters" to route.optInt("distanceMeters"),"duration" to route.optString("duration"),"polyline" to route.optJSONObject("polyline")?.optString("encodedPolyline").orEmpty())
                    }
                }
                main.post { result.success(value) }
            } catch (e: Exception) {
                // Never propagate URLs, request bodies or the credential to Dart/logs.
                val message = if (e is IllegalStateException || e is IllegalArgumentException) e.message?.replace(key,"[redacted]") else "Location lookup failed. Please try again."
                main.post { result.error("GOOGLE_LOCATION_FAILED",message,null) }
            }
        }
    }
    fun close() { pool.shutdownNow() }
}
