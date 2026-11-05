# Account, forms and settings polish references

Reviewed 2026-11-05. Scope: `lib/features/auth/presentation`, `lib/features/profile/presentation`, `lib/features/workspace/presentation`, and `lib/features/settings/presentation`. No settings domain, application, data, shared core, or backend files changed by this pass.

## Research provenance

Pinterest search was attempted for login, profile, settings, dashboards and forms. General text searches frequently returned Pinterest product documentation rather than design pins. Direct opens of the four parent-provided pins failed in the web tool. This worker's computer-use tool reported `Browser is not available: iab`. Therefore these four pins are **parent-reported IAB findings**, not images independently inspected by this worker. Their descriptions below come from that handoff. No claim of pixel matching or creator attribution is made.

| Reference | Access/evidence | Appropriate use |
| --- | --- | --- |
| [Profile section](https://www.pinterest.com/pin/904801381401363933/) | Parent identified a profile section in actual Pinterest IAB search; direct web open failed here. | Profile identity followed by organized account destinations. |
| [Banking ProfileSettings redesign](https://www.pinterest.com/pin/1131036893953287123/) | Title and URL supplied by parent; direct web open failed here. | Professional account/settings organization; not a basis for adding banking features. |
| [ModernSettingsProfile](https://www.pinterest.com/pin/1116189088932113588/) | Title and URL supplied by parent; direct web open failed here. | Separate profile, activity, business and preference groups. |
| [DarkModeProfileSettings](https://www.pinterest.com/pin/822469950751263618/) | Title and URL supplied by parent; direct web open failed here. | Keep dark surfaces and readable hierarchy through the current theme, especially Cinematic. |
| [18 UX Design Tips for Registration and Login Forms – UX Planet, Pinterest pin](https://www.pinterest.com/pin/18-ux-design-tips-for-registration-and-login-forms-ux-planet--497577458850963296/) | Web image search returned this actual pin with an indexed Pinterest login screenshot and description. Full pin was not browsed. Screenshot includes older Facebook/Google treatments; not current provider-brand guidance. | Separate the principal sign-in action from business/account-recovery links; retain Gabla's native Google implementation and official brand mark. |
| [Filter Modal for Dashboard UI](https://ru.pinterest.com/pin/304063412340730255/) | Actual pin URL/title returned in web text search. Image not independently inspected. | Discovery reference for workspace sheets only; no visual-detail claims. |
| [Dashboard design UI UX](https://ru.pinterest.com/pin/442830575855885551/) | Actual pin URL/title returned in web text search. Image not independently inspected. | Dashboard discovery reference; no invented charts, counts or visual matching. |
| [Admin dashboard: analytics UX](https://mx.pinterest.com/pin/admin-dashboard-analytics-ux--787918897326498884/) | Actual pin URL/title returned in web text search. Image not independently inspected. | Analytics hierarchy discovery reference; existing API-fed metrics remain unchanged. |

Primary Pinterest material provided additional accessible evidence:

- [New Pin format update](https://create.pinterest.com/blog/new-pin-format-update/): web image search returned a side-by-side old/new mobile form comparison with short labels and a clear final action. Used as a form hierarchy reference, not as permission to change Gabla submission semantics.
- [Get started on Pinterest](https://create.pinterest.com/get-started/): accessible page describes profile image, description, cover image and website as distinct profile elements. Supports treating saved identity and business details as actual user data.
- [Pinterest Analytics explained](https://create.pinterest.com/en-sg/blog/pinterest-analytics-explained-tools-metrics-insights/): accessible primary page describes overview, Pin statistics and distinct metric names. Used only for clear dashboard hierarchy; Gabla continues to display its own existing metrics.
- [New simpler Pin forms](https://newsroom-archive.pinterest.com/new-simpler-pin-forms): historical primary source (2010), explicitly advocating fewer redundant fields. Historical context, not a current design specification.

These sources informed principles and information hierarchy. Product wording below was written for Gabla's actual routes and API behavior; it is not copied Pinterest wording.

## Page-by-page application

| Page / surface | Reference relationship | Delivered changes and wording |
| --- | --- | --- |
| Login: Classic, Editorial, Discover, Cinematic, Orbit | Login pin; existing five Gabla compositions remain the source of visual identity. | Preserve the five composition structures, animations, reduced-motion path, Google brand mark and native sign-in callback. Replace generated artwork tiles and immersive backgrounds with theme-aware shopping, ride, service and compass icons. Business link says “Reconnect an existing business”; sheet action says “Send Google connection link,” matching its account-linking purpose. Email field disables autocorrect and allows wrapping errors. |
| Reconnect business sheet | Login pin and concise forms principle. | Keep enumeration-safe “If this email belongs to a business…” success wording and existing request endpoint; remove extra button-child padding. |
| Welcome / account details | Parent profile pins; primary profile guidance. | “Account details”, “Your profile”, “Save and continue”. Explain optional phone/photo/district, autofill and keyboard actions, distinguish missing-name and invalid-phone errors, show district loading/retry without blocking saving, disable skip while saving, and present API messages without exception wrappers. |
| Profile / account hub | Parent profile/settings pins. | “Your account”; show actual saved avatar with initial underneath, group Profile / Your activity / Your business / Transport / Preferences, readable subtitles, guest sign-in action, and error-colored deletion entry. All existing signed-in routes and role conditions retained. |
| Delete account | Settings grouping principle; behavior verified against local backend, not inferred from Pinterest. | Scrollable explanation, retained-record wording, typed DELETE confirmation, password only for password accounts, checking/retry state, “Delete my account” and “Keep my account”. Server messages explain blocked deletion. Uses existing backend POST contract. |
| Listings | Dashboard organization principle. | Preserve listing cards, edit/remove actions and real review status. Pull-to-refresh works with short content. Shared workspace forms/errors improved. |
| Business details / location / communities / gallery | Profile pins and form hierarchy. | “About your business”, “Business photos”, “Update business photo”; explain empty gallery. Preserve all location coordinates, audience IDs, gallery mutations and online-payment controls. Freeze editable audience fields during save. |
| Wallet / withdrawals / subscription / transactions | Dashboard references are discovery-only. | Preserve actual balance, payment activation and withdrawal requests. Shared forms mark optional fields and show the positive-amount validation message without a StateError wrapper. No balance, revenue or payout data added. |
| Quotes & receipts | Primary form reference; dashboard hierarchy. | “No quotes or receipts yet”; “Resend email” explicitly identifies the action. Real document list and PDF routes retained. |
| Seller orders | Dashboard organization principle. | “No customer orders yet” with next-step guidance; existing order review navigation retained. |
| Service reservations | Form hierarchy. | “No reservations yet”; keep status-dependent accept/decline/complete/cancel operations and payloads. |
| Shop collections | Primary concise-form reference. | “No collections yet”; keep creation, nesting, renaming and removal with original parent IDs. |
| Business insights | Primary analytics guidance; indexed dashboard pins. | Preserve time filters, API metrics and chart data; shared refresh/error handling improved. No fabricated activity. |
| Promotions list | Dashboard organization and form hierarchy. | “No promotions yet”; describe review status and real photo/video submissions. |
| Promotion creation | Primary mobile creation-form comparison. | “Create a promotion”; preserve “Submit for review”, actual media upload and pending-review semantics. Freeze text while submitting, remove excess button padding, show useful save errors. |
| Saved businesses | Profile grouping principle. | “No saved businesses yet”; explain saving from a business profile; preserve discover action and actual saved-provider cards. |
| Customer inquiries | Dashboard organization principle. | Correct description to “Read customer messages and update their status”; “No customer inquiries yet”; title-case visible status options while retaining original status values. |
| Document studio | Primary mobile form hierarchy. | “Quotes and receipts”; preserve section-derived fields, save-only-changed-field patches, logo upload and saved-settings PDF previews. Replace exception wrappers with API messages or retry guidance. |
| PDF viewer | Practical error-state completion. | Keep actual bytes/viewer and retry; explain that the document could not load without rendering a raw exception. |
| Reusable workspace forms | Primary mobile form comparison and historical simpler-form rationale. | Keep controllers, field types, labels/options, required validation and payload conversion. Mark optional fields, wrap errors, add keyboard actions, announce save failures, and let the shared compact button theme determine sizing. |
| Schema-driven custom fields | Form hierarchy. | Show backend option labels while submitting their original option values, consistently mark optional fields, wrap field errors and truncate long dropdown choices. Preserve booleans, multi-select values and numeric parsing. |
| Appearance / designs | Parent modern/dark settings pins; five existing layout previews. | “View [design] on home” describes actual navigation, spaced scrollable tabs, theme-derived selection colors. Every design, preset and custom three-color editor retained. |
| Palettes | Settings organization principle. | “Choose a preset or edit the three colors below”; “View colors on home”. Preserve per-design persistence, reset action and all picker controls. |
| Typography | Parent settings pins. | “Heading and body fonts”; realistic local-business sample copy. Preserve every font group, offline fonts and selection behavior. |
| Motion | Parent settings pins. | “Background animation”, “Animation intensity”, “Animation speed”; explain why controls are disabled on a still background. Image interval tooltips describe more/less frequent images. Existing ranges, motion modes, previews and reduced-motion behavior retained. |
| Display | Dark settings reference; current style contract. | Explain light/dark/system display options rather than unrelated scroll-reveal internals. Preserve Cinematic's dark-only restriction and other styles' mode controls. |

## Behavior evidence

Read-only backend inspection included `src/routes/auth.routes.js`, `src/services/auth.service.js`, `src/controllers/auth.controller.js` and the existing web deletion page.

- Deletion is **POST** `/auth/me/delete`, not DELETE. Body requires `confirm`; password accounts also require their current password. `GET /auth/me` provides `user.authProvider`, so presentation can request the correct field without changing the session/domain model.
- Deletion anonymizes account identity and retains needed transaction records. Open rides, upcoming tickets, orders/bookings, balances and pending withdrawals can block it; driver/operator/admin accounts require support. Backend messages remain authoritative.
- Profile editing remains PATCH `/auth/me`; optional fields keep their existing omission/merge behavior. This pass does not promise that clearing an optional phone or district removes an existing backend value.
- Business reconnect remains POST `/providers/link-google/request`; its response must not reveal whether a business email exists.
- Promotion submission remains POST `/promotions/mine`; no claim of instant publication.
- Workspace routing, role checks, payment flows, backend keys, status transitions, uploads, PDF bytes and reload invalidations remain in place.

## Verification and limitations

- Dart formatter used to parse/format the owned presentation files; scoped `git diff --check` used for whitespace review.
- No Flutter builds, tests, dependency changes, commits or pushes were run by this worker, to avoid interfering with parent work.
- No emulator/device screenshots or runtime verification: keyboard layouts, narrow screens, larger accessibility text, all five styles, actual auth/payment/upload/PDF flows and backend deletion need the parent's serialized verification pass.
- Direct Pinterest access was unavailable in this worker. Indexed images/text and parent-reported pin findings are differentiated above; this is a reference-informed polish, not a verified pixel reproduction.
- Shared compact input/button sizing is owned by the parent. Local extra action padding was removed rather than introducing a competing input theme. Existing palette/font choices and their persistence are preserved.

## Imagery removal handoff (latest user requirement)

No generated artwork or category image references remain in the owned Dart source. Icons were chosen instead of replacement stock photography so login does not depend on third-party image delivery. No photos were downloaded or uploaded.

Changed source: `lib/features/auth/presentation/login_screen.dart`. Removed both the interpolated immersive background artwork load and the reusable artwork tile load. Replaced `_photo`/`_PhotoLabel` with `_categoryTile`/`_CategoryLabel`. The source no longer loads `assets/artwork/shop.png`, `ride.png` or `services.png` (nor any category image).

The five styles keep different arrangements:

- Classic: rounded shopping tile and stacked ride/services tiles.
- Editorial: asymmetric, tightly cornered service/shopping panels.
- Discover: large compass outline and bus motif over a palette-derived dark gradient.
- Cinematic: restrained storefront ring and bag motif over a palette-derived dark gradient.
- Orbit: tilted shopping/ride tiles around the existing circular composition and motion.

Real content is preserved: saved profile `NetworkImage`, uploaded welcome avatar, business gallery/cover/avatar uploads, listing/provider images from API data, promotion photo/video media, document logo uploads, and the existing brand icon `assets/brand/icon-only.png`. No bundled image files were deleted by this worker.

**Tests outside ownership for parent update; not edited or run here:**

| File | Observed reference | Parent follow-up |
| --- | --- | --- |
| `test/social_login_test.dart:199–201` | `assets/artwork/shop.png`, `ride.png`, `services.png` | Update artwork precaching/expectations for icon-based login. Preserve native auth and all five style checks. |
| `test/page_polish_test.dart:94` | `AssetImage('assets/artwork/$name.png')` | Remove generated-artwork precaching; review any screenshot/image assertions. |
| `test/commerce_flow_test.dart:416` | `AssetImage('assets/artwork/shop.png')` | Replace artwork-based fixture independently of uploaded/listing content. |
| `test/community_test.dart:213` | Interpolated events/jobs `assets/artwork/...png` | Parent/community owner replaces the generated-image fixture alongside community defaults. |

These are read-only findings from `rg` after the imagery-removal instruction. Other workers may subsequently update their files. Shared artwork/category asset deletion and references outside the owned source remain with the parent. No Flutter commands, builds or tests were run for the imagery change; the direct Dart SDK formatter parsed the edited files.

Parent integration: login category tiles now import and use `core/widgets/feature_visual.dart` (`FeatureVisual`, shopping emphasized) inside their existing style-specific arrangements. The helper was read but not modified. Discover/Cinematic keep local low-contrast decorative icon backgrounds with palette-derived dark colors. The actual Gabla brand PNG is retained, as confirmed by the parent.

## Parent visual verification follow-up

The parent fetched and visually inspected public Pinterest OpenGraph previews for
[Profile section](https://www.pinterest.com/pin/904801381401363933/) and
[Modern settings/profile](https://www.pinterest.com/pin/1116189088932113588/) on
5 November 2026. The first uses a compact identity area and grouped settings rows;
the second uses a distinct profile summary and consistently aligned settings rows.
Gabla adapts those group boundaries, real account identity and clear destinations;
no sample health data, fabricated activity totals or reference portraits are copied.
[Compact dark/light form](https://www.pinterest.com/pin/265430971781513819/)
was also visually inspected: external labels, rectangular outlined fields and a
separate final action support the shared form treatment. Reference images are
review-only and are not shipped.
