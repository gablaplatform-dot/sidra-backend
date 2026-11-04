# Public sharing and app previews

Four canonical public share links are used by native and web share buttons:

- https://gogabla.com/share/job/ID
- https://gogabla.com/share/event/ID
- https://gogabla.com/share/product/ID
- https://gogabla.com/share/service/ID

The backend `src/sharing/sharePreview.js` returns complete HTML, including Open Graph title/description/image/canonical URL and Twitter large-image tags. Published records only are selected. Jobs/events require an active owner; products/services require an approved listing and provider and an active provider account. Pending, declined, missing or mismatched-type records return a no-store 404 without private item details. Provider contact-unlock information and private applications are never loaded. HTML and image URL handling is escaped/HTTPS-only. Crawler visits do not increment listing view counts.

Pages Functions proxy only `/share/*` and `/get-app` to the fixed backend origin. Preview rendering does not depend on browser JavaScript, user authentication, cookies or user-agent detection. Product pages show image/price, service pages show the provider/service summary, jobs show opportunity details, and events show their poster/date/venue/entrance details. Shared links include both an Open in Gabla action and a website fallback.

`/get-app` serves the Android download landing. The button downloads the fixed persistent file `/data/releases/gabla-latest.apk` from `https://sidra-api.fly.dev/app/download`. No API keys/signing secrets are published. The APK contains the existing restricted native Maps configuration as expected for Android apps. Before the file is uploaded, the page explains that the download is being updated. iOS availability is explicitly marked as later; there is no invented App Store URL.

The Android intent filter handles verified `https://gogabla.com/share/` URLs; `public/.well-known/assetlinks.json` contains the package and SHA-256 from the actual release APK certificate. GoRouter maps all four kinds to their real detail screens. `gabla:///share/TYPE/ID` supports an explicit Open in Gabla button. There is no deferred-install link restoration promise.

Native sharing uses share_plus 11.1, compatible with this project's existing Android Gradle plugin. It opens the OS share sheet; users choose WhatsApp, contacts or other apps themselves. The app falls back to copying the canonical link if native sharing is unavailable. No messages were sent during verification.

WhatsApp and other platforms decide how and when to fetch/cache previews. Tests verify server HTML, images and crawler access; they cannot guarantee the recipient's cache state. Never share signed-in preview pages, invitation tokens or private application links as public content.

Verification: isolated sharing HTTP tests cover all four kinds, unpublished/inactive/declined records, escaping, metadata, APK response headers/content, and the fixed-origin Pages proxy. Native tests cover URL routing, location autocomplete/map entry, and removal of stale coordinates on address edits.
