# Category relationships, Jobs and Events

Implemented locally on 4 November 2026. Production was not deployed or migrated: the local Fly CLI has no access token. The APK points to the existing production API, so its new Jobs/Events actions require the backend deployment below. Existing shopping remains compatible with the older category API.

## Confirmed product scope

- Jobs: employment vacancies and paid tasks, posted by signed-in users.
- Events: user-posted event listings, posters/photos/videos, start/end times, venue, entrance price, RSVP, and an optional organizer booking link. No in-app ticket sale or payment flow was introduced.
- Five Flutter designs retain independent layouts, palettes, fonts and motion settings. Jobs and Events now appear alongside Shop, Services, Bus and Ride.

## Category structure and retained data

Provider/business categories (`Category`) now relate to product branches (`ProductCategory.providerCategoryId`). The association inherits down the product tree. A business in Electronics or a descendant can choose Phones, Laptops, etc. from the linked product branches. The server enforces this relation when a product is created or its category changes; web and Flutter forms load the business-scoped category tree from `GET /product-categories/mine`.

Service-listing categories (`ServiceCategory`) remain separate. Seller-owned storefront folders (`ShopCategory`) remain private per seller. Existing product-category IDs, listing references, parent relationships, custom-field definitions, images and existing product data are retained. This is an additive relation, not a destructive copy into another category table.

Admin → Product Categories has a **Provider business category** selector. Descendants inherit a link unless explicitly overridden. Unlinked branches remain compatible while migration review is pending. Existing product edits that do not change category continue to work.

The migration script plans associations using an explicit mapping, a unique existing product/business relationship, or a unique exact name. Unmatched product roots create a matching business branch under Shop. Ambiguous cases require an explicit mapping; `--apply` stops before any writes when review entries remain. It does not merge similarly named categories such as Electronics, Phones & Tablets, Fashion, or Fashion and Apparels.

The current public API reported 166 provider categories, 178 product categories, and 59 service categories. Its published product tree exposed 172 reachable nodes; six reported nodes were absent from the public tree. A full database preview must inspect these as well. No private database contents were fetched.

## Migration commands

Run against an isolated copy first. After schema synchronization and Prisma generation:

```sh
DATABASE_URL=file:/absolute/path/to/copy.db node scripts/migrate-product-taxonomy.js --report taxonomy-plan.json
```

Review the plan. A mapping file is a JSON object from product-root ID to provider-category ID; supply it with `--mapping mapping.json` for ambiguous cases.

```sh
DATABASE_URL=file:/absolute/path/to/copy.db node scripts/migrate-product-taxonomy.js --mapping mapping.json --apply
```

`--apply` creates a consistent SQLite backup with `VACUUM INTO` and file mode 0600 before opening the update transaction. It verifies product/listing counts and foreign keys before committing. Repeated application is idempotent. A backup made by this script contains the new additive schema but the original category associations, which supports reverting the data association separately from a code rollback.

The rehearsal used a temporary SQLite copy of the reachable public tree and six public listing fixtures. All 172 category IDs, names, parent IDs, image URLs and custom-field definitions remained identical. All six fixture listing rows remained identical. All 17 product roots received associations, and a second application created no duplicate branches. See [the preview](taxonomy-migration-preview.json). This verifies the migration logic against the public snapshot, not a completed production migration.

## Jobs and Events workflow

Anyone with an active Gabla session can submit and manage their own posts. New/edited posts enter `pending`; the `jobs` or `events` admin permission is required to approve, decline or suspend them. Only approved posts from active accounts appear publicly. Owners can preview pending posts, edit them, close jobs, or cancel events.

Jobs support search, category, district, vacancy/task type, workplace, pay range and deadline data. Applicants submit a cover letter, contact phone and optional HTTPS portfolio/CV link. Only the applicant and the poster can access the relevant application. Posters can review, shortlist or decline; applicants can withdraw. Applications to closed/expired jobs and duplicate active applications are rejected. No applicant scoring, automatic hiring decision, payroll or escrow was added.

Events support poster/photo/video upload through the existing storage API, venue coordinates, maps, entrance information, age guidance and organizer contacts. RSVP states are interested/going; these are not purchased tickets. User-tapped videos open with sound in Flutter. Venue maps use the existing native Google Maps integration and saved Road/Satellite/Hybrid/Terrain selection.

Saved posts, My posts, My applications and applicants screens are implemented. Applicant contact details and moderator notes are excluded from public discovery. Owner isolation and admin permissions are enforced by the backend.

Core API routes:

| Action | Jobs | Events |
| --- | --- | --- |
| Browse / create | `GET/POST /jobs` | `GET/POST /events` |
| Own posts / saved | `/jobs/mine`, `/jobs/saved` | `/events/mine`, `/events/saved` |
| Read / edit | `GET/PATCH /jobs/:id` | `GET/PATCH /events/:id` |
| Close / cancel | `POST /jobs/:id/close` | `POST /events/:id/close` |
| Save / RSVP | `PUT /jobs/:id/response` | `PUT /events/:id/response` |
| Admin review | `GET /jobs/admin`, `PATCH /jobs/admin/:id` | `GET /events/admin`, `PATCH /events/admin/:id` |
| Apply / applicants | `POST /jobs/:id/apply`, `GET /jobs/:id/applicants` | — |
| Applicant history | `GET /jobs/applications/mine`, `PATCH /jobs/applications/:id` | — |

## Design direction

- Classic: image-led discovery, compact opportunity cards and poster cards with information below.
- Editorial: print-style typography, ruled job listings and side-by-side event posters/details.
- Discover: photographic job cards, immersive event posters, parallax deck navigation and rising entrances.
- Cinematic: dark opportunity panels with strong pay hierarchy, tall event posters and staged reveals.
- Orbit: rounded rows with circular media, floating badges, playful entrances and collage navigation.

Existing generated Gabla artwork is reused for module launch cards and empty-poster fallbacks. Actual event media comes from the creator; no invented events or vacancies were seeded into production. Preview fixtures are illustrative test data only.

References: [job-board interfaces](https://dribbble.com/tags/job-board), [event discovery concept](https://dribbble.com/shots/26935612-Modern-Event-Discovery-Ticket-Booking-App-UI), [event UI collection](https://dribbble.com/tags/event-app-ui). The implementation adapts discovery patterns to Gabla rather than copying the referenced interfaces.

## Verification and release status

- Full Flutter unit/widget suite: **281 passed**, including narrow-phone checks across all five designs and rendered Jobs/Events previews.
- Flutter analysis: no errors/warnings; informational style lints remain.
- Backend HTTP tests: **3 passed**, covering authentication, owner isolation, moderation, private applications, duplicate/closed application handling, RSVP/cancellation and category scoping.
- Root `npm run lint`: passed after excluding generated native/vendor bundles and removing four unused source symbols.
- Public web and admin production builds: passed.
- Migration rehearsal and repeat application: passed on the temporary public-data fixture database.
- No real applications, events, payments, notifications or email messages were submitted to production.

Backend tests refuse to run unless `DATABASE_URL` is exactly `file:/tmp/gabla-community-test.db`, preventing accidental production resets. To reproduce:

```sh
DATABASE_URL=file:/tmp/gabla-community-test.db node scripts/sqlite-push.js
DATABASE_URL=file:/tmp/gabla-community-test.db npx prisma generate
DATABASE_URL=file:/tmp/gabla-community-test.db JWT_SECRET=community-test-only node --test test/community.test.js
```

For live release: first take a protected full backup of `/data/sidra.db`, deploy the tested backend/public build using an authenticated Fly session or the existing CI workflow, inspect the full database migration preview, resolve review entries, and run the migration against the live database. Deploy the admin build through its existing separate hosting workflow and assign Jobs/Events permissions to the intended admin roles (Super Admin's wildcard already covers them). The backend's standard startup synchronizes the additive schema. The Docker build now supplies the existing public Google web client ID, with a build-argument override available.

The review APK is built with version code 15. It is intended for layout review until the new API is deployed. APK version/package, signing certificate and embedded Maps configuration are verified during packaging. Actual Google account login, real media uploads and native event-map rendering are left for device acceptance testing; map/audio platform integration comes from the existing tested implementation.
