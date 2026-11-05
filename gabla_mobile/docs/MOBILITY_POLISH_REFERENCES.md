# Mobility polish references and handoff

Date: 5 November 2026. Scope: `lib/features/ride`, `lib/features/bus`, `lib/features/nearby`. Shared theme, navigation, widgets and asset deletion are parent-owned.

## Research evidence and limits

**The worker could not verify Pinterest pin references; a parent visual verification is recorded below.** Pinterest search URLs returned an unauthenticated HTML shell without pins; the browser connection timed out twice. Web and image searches scoped to Pinterest did not produce usable mobility pins. No Pinterest pin ID, creator attribution or visual review is invented below. Search links are research entry points, not evidence that a particular design was inspected.

Pinterest searches attempted:

- [Ride map and bottom sheet](https://www.pinterest.com/search/pins/?q=taxi%20app%20ui)
- [Bus booking screens](https://www.pinterest.com/search/pins/?q=bus%20booking%20app%20ui)
- [Nearby map and results](https://www.pinterest.com/search/pins/?q=nearby%20app%20ui)

The following accessible sources support the layout decisions. They are design references, not assets installed in the app, and do not establish Gabla backend capabilities.

| ID | Exact source | Evidence available in this pass | Applicable principle |
| --- | --- | --- | --- |
| R1 | [Riider — Elux Space](https://dribbble.com/shots/26297862-Riider-Transportation-Mobile-App) | Creator page opened; indexed image preview described map, ride comparison and driver request screens | Keep route context next to fare and driver decisions |
| B1 | [Bus Booking App UI Design — Neointeraction Design](https://dribbble.com/shots/23024390-Bus-Booking-App-UI-Design) | Search result and indexed image preview | Compact route/date form and scannable departure information |
| B2 | [Redbus App Design Concept](https://www.behance.net/gallery/115931757/Redbus-App-Design-Concept) | Indexed image preview | Clear quantity/price/action hierarchy; its seat map is not copied |
| B3 | [Bus Ticket Booking App](https://www.behance.net/gallery/165306547/Bus-Ticket-Booking-App) | Indexed image preview; direct project fetch returned 403 | Separate ticket identity, trip details and boarding QR |
| N1 | [Nearme — Surja Sen Das Raj / Ofspace](https://dribbble.com/shots/26165945-Nearme-Discovery-Community-Connection-UX-UI-Design) | Creator page opened; indexed image preview | Visible search area, filters and linked map/list exploration |
| N2 | [Workmorr](https://workmorr.com/) | Indexed screenshot and description of service map/list | Explain map limitations while keeping results useful |

Full visual inspection of these reference images and device previews was not performed by this worker. Operator forms were audited against the actual fields and actions in this repository; no unverified external operator reference is attributed to them. Verified Pinterest pins for each screen remain a research follow-up.

## Exact screen-to-source and implementation mapping

Paths below are relative to `lib/features/`.

| Screen / state | Source mapping | Concrete polish |
| --- | --- | --- |
| `ride/presentation/ride_screen.dart` — route setup | R1 | Compact pickup/destination controls, direct heading, 42% initial sheet and 20% collapsed sheet to expose the map |
| Same — fare comparison | R1 | Route summary remains visible, compact vertical fare rows in Classic/Editorial/Cinematic, horizontal choices in Discover/Orbit, estimated-fare label and explicit empty-fares retry |
| Same — driver confirmation | R1 + existing controller stages | Copy asks for review before confirmation; retains vehicle, plate, rating, phone, fare and cancellation |
| Same — live / terminal | Existing controller stages, R1 for hierarchy | Status-specific instructions, single status heading, unchanged tracking/cancellation/reset actions |
| `bus/presentation/bus_home_screen.dart` | B1 | Replaced window-seat promise with route search, compact town/date controls, selected quick-date chips, factual popular-route heading and suggestion availability notices |
| Same — town picker | B1 + existing places provider | Town entry remains possible when suggestions are loading or unavailable |
| `bus/presentation/bus_search_screen.dart` | B1 | Route/date lead results, EAT label, unchanged filters and sorting; no-departure recovery changes route while filtered-empty recovery clears filters |
| `bus/presentation/bus_design_widgets.dart` — departure cards | B1 | Reduced spacing, explicit seats-left label, fare prefix, visible ticket action; missing duration no longer claims a direct route |
| `bus/presentation/bus_trip_screen.dart` — ticket quantities | B2, adapted to actual API | Explicit assigned-seat explanation and empty-ticket-types message; no fictitious selectable seat plan |
| Same — passenger / payment / restore | Existing checkout controller | Short payment-phone label with fallback helper, keyboard/autofill hints, explicit restore message and confirmed booking copy |
| `bus/presentation/bus_tickets_screen.dart` | B3 | Consistent My tickets title, literal empty state, readable backend status labels, compact token-based surfaces |
| `bus/presentation/bus_ticket_screen.dart` | B3 | Smaller route header, neutral Bus ticket title, QR semantics, actionable reconnect/refresh copy; QR and ticket values remain server-backed |
| `bus/presentation/bus_parks_screen.dart` | B1 for list hierarchy; existing park data | Distinguishes an empty directory from an empty filtered search |
| `bus/presentation/bus_park_screen.dart` | Existing park data, B1 for route actions | Real park map retained; icon fallback, routes/departures heading and explicit no-routes state |
| `bus/presentation/bus_operator_login_screen.dart` | Repository fields and auth flow | Task-focused header, coherent bus icon, autofill, busy fields and accurate password-toggle tooltip |
| `bus/presentation/bus_onboarding_screen.dart` | Repository onboarding contract | Icon invitation header, literal setup/review headings, step count and compact panels; password/profile/routes/review flow retained |
| `bus/presentation/bus_route_editor.dart` | Repository route payload and validation | Route-detail grouping, shorter duration label, EAT guidance, empty ticket/departure instructions and optional-stop explanation |
| `bus/presentation/bus_operator_portal_screen.dart` — overview | Repository stats | Compact company overview and metric typography |
| Same — routes / schedules / trips | Repository actions | Literal empty states and EAT time labels; route, fare, schedule, trip, delay and cancellation actions retained |
| Same — bookings / manifest / verification | Repository actions | Explicit empty bookings/manifest, direct verification heading, busy ticket input |
| Same — customers / announcements / payouts / profile | Repository actions | Literal empty states and compact token-based panels; customer, announcement, payout, upload and map-location behavior retained |
| `nearby/presentation/nearby_entry.dart` | N1 for discoverability | Product/service purpose is explicit; five compositions use fitting icons instead of generated pictures |
| `nearby/presentation/nearby_search_chrome.dart` | N1 | Consistent Find nearby title, compact search, 48px filter targets, icon categories, visible chosen area and radius |
| `nearby/presentation/nearby_screen.dart` | N1, N2 | Accurate idle/loading/error/results headings; loading explanation, error retry, readable category labels, enlarged-text fallback from horizontal rail to scrollable list |
| `nearby/presentation/nearby_map.dart` | Actual map-mode provider | Removed misleading fixed SATELLITE badge; selected map mode remains visible through the existing map-mode control |

## Five layouts and inherited design settings

Layout differences use composition instead of competing copy or invented data:

| Design | Ride | Bus | Nearby |
| --- | --- | --- | --- |
| Gabla Classic | Progress-led sheet, compact vertical fares | Single bus icon, clear form/list hierarchy | Existing map + draggable results sheet |
| Editorial | Ruled heading and vertical comparison | Route-axis icon composition and ruled result treatment | Existing framed map + list; restrained headings |
| Discover | Open heading and horizontal fare choices | Route/bus icon pairing and narrow result accent | Existing map + swipeable results |
| Cinematic | Side-rule heading and compact fare rows | Framed icon and restrained console treatment | Existing map + photo rail using actual returned images |
| Orbit | Leading route/status icon and horizontal choices | Circular icon motif; compact panels | Existing expandable circular map + results |

Owned surfaces read `StyleTokens.cardRadius` or the inherited card shape: Orbit 4, Editorial 0, Cinematic 6, Classic 8, Discover 12 through the parent theme. Font families and colors remain inherited. Existing stage/map/list motion remains; ride progress now also respects OS reduced motion. Global button/input sizing is parent-owned.

## Generated imagery removal

- No `Image.asset`, `assets/artwork`, `assets/categories`, or `artwork:` references remain under these three owned features.
- Bus scenes use Material icons and the parent's `featureIcon('bus')`; missing nearby photos use the parent's `FeatureVisual`.
- Removed the bus login artwork header, onboarding coach picture, repeated result-card coach image, nearby discovery pictures, cinematic entry picture and image category filters.
- Actual `Image.network` content, uploaded provider/product photos, uploaded operator logo/cover flows, QR images and map marker photo handling are preserved.
- Bundled PNG deletion, pubspec changes and shared `MobilityLayout` imagery replacement are parent-owned. This worker did not delete assets or modify shared core.

## Validation and parent handoff

- Ran standalone Dart formatting on owned presentation files; no Flutter commands, tests, builds, dependency commands, booking calls or payment calls were run by this worker.
- `git diff --check` was clean at the source handoff. Runtime layout and full analysis/testing are delegated to the parent; no device-preview or test-pass claim is made here.
- Parent reported and fixed the missing `bus_design_widgets.dart` import in `bus_park_screen.dart`, then began full tests. Source editing stopped at the parent's request.
- Existing assertions requiring a copy update: `test/mobility_test.dart:486` and `integration_test/mobility_device_test.dart:40` expect `Find my bus`; the button now reads `Search buses`. Tests were not edited by this worker.
- Existing route/fare/payment/booking/location/operator controllers, repositories and domain models were not edited. Google Maps satellite default, persisted user map modes and returned coordinates remain on the existing providers.
- No commit or push. The shared filesystem includes concurrent parent changes; review the scoped feature diff rather than attributing the entire working tree to this worker.

Limitations: verified per-screen Pinterest pins remain outstanding; parent runtime checks are required to confirm small-screen and enlarged-text layouts. No backend features, selectable bus seats, availability, prices or ETA were fabricated.

### Nearby overflow follow-up

The parent's full-test log `/tmp/gabla-polish-all-tests.log` reported the same two overflows across all five nearby designs at 320px and 1.3 text scaling. Targeted corrections:

- `nearby_search_chrome.dart`: moved the radius into the flexible area selector as a subtitle. It no longer competes with the location label and two icons for horizontal space; the area action retains a minimum 48px height.
- `nearby_screen.dart`: removed the fixed summary height so wrapped text determines its extent. The following sliver reports that actual extent for map-pin-to-result scrolling, replacing the previous assumed 100px offset.

Standalone Dart formatting and scoped `git diff --check` completed. No Flutter commands or tests were run by this worker; parent must rerun `nearby_test.dart` and serialized checks to verify the fix.

## Parent Pinterest visual verification

The parent subsequently fetched the public Pinterest OpenGraph preview images and
inspected them locally on 5 November 2026. These reference images are not bundled.

- [Riider — Transportation Mobile App UI](https://www.pinterest.com/pin/1123437069557643328/): three screens with full-width map, lower fare/vehicle controls, and compact match confirmation. Applied hierarchy: map is the main scene; route/fare controls stay in the lower sheet; real driver and fare fields remain authoritative. No fake map pins, promo codes or driver portraits introduced.
- [User's map reference](https://www.pinterest.com/pin/531987774755110430/): linked feed/map composition, photo pins, quiet location control and navigation. Gabla retains actual listing-photo pins, linked list/map selection, and map-mode switching; social stories and follower UI were not introduced.
- [Compact form reference](https://www.pinterest.com/pin/265430971781513819/): external labels, rectangular outlined fields, date rows and a clear final action. Applied consistently to bus passenger/operator forms via the shared theme; no ticket functionality inferred from this event-form reference.

A dedicated bus Pinterest reference was not verified. Bus layouts use the documented
creator references and Gabla's actual town/departure/ticket fields rather than an
invented Pinterest attribution.
