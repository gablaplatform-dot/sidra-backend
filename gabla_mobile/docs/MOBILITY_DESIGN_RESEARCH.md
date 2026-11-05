# Mobility design research — 3 November 2026

## Evidence and inspiration

- [Uber redesigned rider experience](https://www.uber.com/gb/en/u/redesigned-uber-app/): strong destination entry, service comparison, accessible activity and tracking.
- [Uber Base](https://base.uber.com/): clear hierarchy and consistent interaction patterns. Adapt principles, not brand assets.
- [World Travel Tech Awards 2025](https://worldtraveltechawards.com/award/world-best-ride-hailing-app/2025): Uber won; Bolt, Careem and Grab were nominees. This is a travel-industry award, **not a comparative UI score**.
- [Uber Simple mode](https://investor.uber.com/news-events/news/press-release-details/2025/Uber-Launches-Senior-Accounts-and-Simple-Mode-Nationwide/): fewer controls and readable type help high-pressure booking moments.
- [FlixBus app](https://www.flixbus.com/service/bus-app): fast booking, station directions, booking management, mobile ticket scanning and trip updates.
- [redBus app](https://www.redbus.com/info/mobile): boarding location and live bus tracking are important parts of the passenger journey. These are references, not claims of Gabla backend support.
- [Next-Gen Bus Booking UI by Sk Abu Hasan](https://dribbble.com/shots/27277914-Next-Gen-Bus-Booking-Mobile-App-UI): useful comparison of departure/arrival hierarchy and compact travel cards. A design concept, not a verified production app or independently ranked design.
- [Move It concept](https://www.behance.net/gallery/220944161/Move-It-App-Redesign-2025) and [Khatwa concept](https://www.behance.net/gallery/240390099/Khatwa-Ride-Hailing-App-Design-%28Rider-Driver-%29) appeared in search results. Full pages returned 403; do not claim visual review or awards.

## Five Gabla directions

Colors and fonts continue to come from Design Studio. Layout identity does not depend on a particular palette.

| Studio design | Ride composition | Bus composition | Motion |
| --- | --- | --- | --- |
| Gabla Classic | Map/artwork first, overlapping dispatch sheet, stacked fare choices | Image-first departure board, overlapping route planner | Short sheet rise and selection morph |
| Editorial | Large headline, ruled route axis, short landscape image, squared controls | Travel-journal heading, ruled itinerary, timetable cards | Lateral reveal and restrained stage slide |
| Discover | Tall immersive image, white text overlay, rounded booking dock, horizontal vehicles | Destination-led cover and floating planner, image-led route discovery | Taller rise and image reveal |
| Cinematic | Separate journey console, framed map, narrow status strip | Departure lounge, framed coach image, focused itinerary | Short fade/slide, calm spacing |
| Orbit | Circular travel scene, orbital rings, capsule planner, horizontal vehicles | Circular coach scene, ticket-stub planner | Scale entrance, rounded selection morph |

## Interaction rules

- Preserve Google Places, GPS and satellite map selection; never invent driver availability, fares, ratings or ETA.
- Display journey duration only from the estimate/trip response. It is not a pickup ETA.
- Preserve backend ride stages: route → estimates → matched driver confirmation → tracking → terminal result.
- Call driver using the returned phone number. Cancellation must retain a live ride if the server rejects it.
- Honor OS reduced motion and the existing font/palette settings. Scroll reveals run on viewport exposure.
- Bus backend offers ticket types + quantities; seats are assigned on confirmed payment. Do not draw a fictitious seat picker.
- Bus requests use `/bus/bookings` with `tripId`, `items[{ticketTypeId,quantity}]`, `passenger` and `payPhone`. Confirmation comes only from polling `/bus/bookings/{id}`.
- Correct backend fields are `departureAt`, `priceFrom`, `seatsLeft`. Popular routes return `{from,to,minPrice,companies}`, not scheduled trips.
- My tickets returns `{upcoming:[booking],past:[booking]}`; ticket detail returns `{ticket,booking}`. Departure display is always East Africa Time.
- Payment submission is a deliberate user action; UI verification must not initiate a real charge.

## Implemented and verified

- Five ride compositions cover route setup, fares, driver confirmation and live/terminal status, with editable routes, payment choice and callable driver contact.
- Stage entrances, artwork scroll parallax, viewport reveals, animated vehicle selection and an activity pulse honor OS reduced motion.
- Five bus home compositions lead to styled departure results, date/operator/time/availability filters, sorting, ticket quantities, passenger validation, mobile-money status and boarding passes.
- Corrected the pre-existing bus DTO/envelope mismatches. Popular-route taps open a search rather than a nonexistent trip ID.
- Pending bus booking IDs persist across app restarts. Polling interruptions keep the same booking. No client-side seat-selection promise: the server assigns seats on payment confirmation.
- Bus-company profiles show actual park coordinates on a satellite map when available, contact phone, boarding information and company-scoped route searches.
- Restored rides recover their pickup/drop-off coordinates. A failed cancellation retains the active trip; stale polling cannot reopen a cleared trip.

Validation on Android and Flutter:

- `flutter analyze --no-pub --no-fatal-infos`: no errors or warnings; informational lints remain in the project.
- `flutter test test`: **126 passed**. Includes 70 layout cases (five designs × two phone widths × seven screens/stages), real API-envelope fixtures, checkout payload/validation, phone normalization, pending-payment recovery and rejected ride cancellation.
- `flutter test integration_test/mobility_device_test.dart -d emulator-5554`: **passed**. Opened all five ride and all five bus home designs in the real Android app and verified native Maps configuration.
- Rendered previews reviewed at 430 px with enlarged type; horizontal vehicle cards grow naturally rather than clipping content. Previews use fixture data, not a claim of available drivers or departures.
- Public production `/bus/places`, `/bus/trips` and `/bus/popular-routes` response envelopes checked read-only. No real booking, payment or driver dispatch was initiated during validation.

Build for client testing:

```sh
flutter build apk --release --build-number=11
```

The APK uses this project's existing Android signing identity and ignored native Maps configuration. No iOS key or iOS SDK was configured as part of this work.

Run the release build after tests finish, with no concurrent Flutter test/pub commands. Flutter can otherwise rewrite its generated plugin registry with test-only plugins during Android compilation ([upstream issue](https://github.com/flutter/flutter/issues/193430)).
