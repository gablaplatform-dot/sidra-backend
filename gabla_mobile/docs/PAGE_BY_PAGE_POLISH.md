# Gabla page-by-page polish — 5 November 2026

This pass revises the existing native app. It preserves live API operations and
saved colour, font and motion preferences. References guide hierarchy and control
patterns; these are adaptations for Gabla, not claims of pixel-identical copies.

## Foundation and discovery

Pinterest references inspected:

- [Zevoa Super App, Orbix Studio](https://www.pinterest.com/pin/755901118752997058/): compact forms, explicit labels and task-based multi-service navigation.
- [Super app concept](https://www.pinterest.com/pin/259801472269809437/): multi-service home hierarchy (observed in Pinterest search grid).
- [Screen with Home](https://www.pinterest.com/pin/726416614907226293/): grouped entry points (observed in search grid).

| Screen | Change |
| --- | --- |
| Home | Six named destinations with task-specific descriptions; appropriate section icons; five separate compositions. |
| Home search | Opens global search rather than silently opening Nearby. |
| Business category index | Dedicated searchable directory; home “See all” no longer opens unrelated shop categories. |
| Category detail | Shorter category image, direct “Subcategories” and “Filter businesses” labels, accurate empty state. |
| Search | Plain search instructions, text-first initial view, clear result tabs and query context. |
| Shared discovery headers | Smaller hierarchy; no oval hero; no generic decorative image in search. |
| API-backed sections | Content skeleton during loading, compact recovery action, no unexplained raw exception text. |
| Shared fields/buttons | Visible field outlines and focus/error states, restrained corners, 48px minimum primary/secondary button targets. |

## Five home compositions

- Classic: six icon-and-caption entries in a practical two-column grid.
- Editorial: numbered rows separated by rules, serif headings, compact symbols.
- Discover: a shop icon lead, a service/event pair and compact transport/job rows.
- Cinematic: ride icon lead with a compact vertical destination list.
- Orbit: transport pair, horizontal shop/service entries and a jobs/events pair;
  four-pixel corners, no floating rotated collage.

## Copy rules

Use the name of the actual action or content. “Bus tickets” describes routes and
seats; “Jobs” describes vacancies and paid tasks. Avoid invented trust claims,
marketing slogans, developer implementation notes and payment instructions that
contradict the backend. Never fill empty production lists with invented businesses,
posts, fares or reviews.

## Module reviews

Detailed reference and implementation notes are maintained alongside this index:

- `COMMERCE_POLISH_REFERENCES.md`: shop, cart, checkout, orders, services, bookings and provider pages.
- `COMMUNITY_POLISH_REFERENCES.md`: jobs/events discovery, details, posting, saved/mine and applications.
- `MOBILITY_POLISH_REFERENCES.md`: ride, nearby, bus search, tickets and operator pages.
- `ACCOUNT_POLISH_REFERENCES.md`: authentication, profile, settings and business workspace.

## Review evidence

`test/page_polish_test.dart` renders all five home/search/category-index variants to
`build/previews/polish/` and checks home search/category routing and directory filtering.
Existing commerce/community/mobility/authentication tests cover the underlying flows.
Screenshot fixtures remain test-only; they do not publish data to production.

## Imagery revision

All 13 generated feature/category/concert PNGs have been removed. The app uses icons
for section navigation and missing-image states, and authentic API-supplied images
for actual listings, businesses, categories and events. No external stock-photo
requests or attributed real people are needed for the navigation.

The general directory API includes both shop and service businesses. Its labels use
“Business categories”; the dedicated Services and Shop sections retain their own
category scopes. This avoids describing shop categories as services.

## Verification for APK v18

- Full Flutter suite: 310 tests passed, including narrow phones, larger text,
  commerce checkout/payments, ride/bus, community posting, maps, media sound,
  palette/font persistence and social sign-in UI.
- After the final directory wording correction, 19 discovery/category checks passed.
- Flutter analysis: no errors or warnings; existing informational style suggestions remain.
- Root ESLint and both public-web production builds passed.
- Rendered previews load the actual bundled typefaces and Material icon font.
- Physical-device sign-in, live payments, live Google location permissions and
  real posting/upload flows were not exercised against production accounts.
