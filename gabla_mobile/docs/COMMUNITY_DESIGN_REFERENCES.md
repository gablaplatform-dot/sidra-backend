# Jobs and Events — Pinterest reference pass

The previous oval artwork, capsule inputs and overlapping posting FAB were replaced. All five native designs now have compact field geometry, independent browse/detail headers, different posting compositions, and reserved bottom actions. Palettes and font groups remain user-selectable.

## Inspected references

- User's Evenfonic event app: https://www.pinterest.com/pin/821203313317364231/ — dark discovery header, concert photography, compact event cards and white detail surfaces.
- Event Discovery / Instant: https://www.pinterest.com/pin/930204498050366574/ — restrained event feed, small metadata rows, clear image and price hierarchy.
- Event Booking App: https://www.pinterest.com/pin/892064638684859573/ — image-led event details, clean panels, compact category/navigation controls (inspected in Pinterest search results).
- Create Event Form (Dark & Light): https://www.pinterest.com/pin/265430971781513819/ — external field labels, short rectangular inputs, compact date/location/attachment controls.
- FocoTik Create Event Flow: https://www.pinterest.com/pin/875176140092114838/ — media-first creation, dark field panels, event date/time controls and preview hierarchy.
- Pixsellz Create Event: https://www.pinterest.com/pin/249949848060442704/ — light, compact creation surface and restrained field separators (inspected in search results).
- Jobify: https://www.pinterest.com/pin/619385755042076715/ — minimal job feed, organization marks, clear role/pay hierarchy.
- Job Finder Mobile: https://www.pinterest.com/pin/875176140099973122/ — dark job-match header and compact information cards (inspected in search results).
- Mint job discovery: https://www.pinterest.com/pin/1049620256922176279/ — coloured discovery panels and structured role cards (inspected in search results).
- Modern Job Finder: https://www.pinterest.com/pin/877076096198414363/ — restrained green/white structure and geometric organization marks (inspected in search results).

## Reference adaptation by design

| Design | Browse/detail composition | Posting composition |
|---|---|---|
| Gabla | Evenfonic dark hero, image cards, compact white detail panel | Outlined section cards; compact labels and controls from Create Event |
| Editorial | Jobify/Instant typography, rules, title-first detail page | Pixsellz-style light form; underlined fields and sequential sections |
| Discover | Mint discovery panels, image-led cards, floating detail panel | Guided four-step form, thin progress rail, Back/Continue actions |
| Cinematic | Dark job-match treatment and concert imagery; media-first detail header | FocoTik media-first event creation, dark compact fields and section panels |
| Orbit | Geometric organization marks, rectangular image strips, compact side-by-side detail | Compact tabbed creation workspace, 4px corners, actionable completion checklist |

These are reference-based adaptations for Gabla's actual functionality, not copied designer artwork or claims of pixel-identical replicas. The bundled concert photograph illustrates the event category. [Photo source](https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f). Actual posts use their uploaded images/posters.

Location entry supports debounced Google suggestions, selecting a resolved place, address search, choosing a Google Maps pin, and a complete typed address. Editing the address clears stale coordinates. Locations are required for posting. Search/pin interactions use the existing native Maps setup and map mode switcher.

Motion: existing visibility-based entrances for cards/sections; short fade/slide transitions between guided steps; no motion when reduced motion is enabled. Input corners range from 0 to 10px (Orbit 4px). Text areas align at the top. Posting actions do not cover scroll content. Community app bars no longer show a shopping-cart action.

Rendered previews: `build/previews/community/STYLE-jobs.png`, `STYLE-events.png`, `STYLE-post-job.png`, and `STYLE-post-event.png` for all five styles. Widget coverage includes narrow screens, large text, location search/map entry and shared-link routing.

Release verification: 294 full-suite Flutter tests passed, plus a 54-test community pass after copy refinements. Analysis has no errors/warnings. APK v17 retains the verified Maps key/package/signature. Run Flutter checks and release builds sequentially: concurrent pub get/analyze can rewrite the generated Android plugin registrant with test-only plugins; a normal release build regenerates the correct configuration.
