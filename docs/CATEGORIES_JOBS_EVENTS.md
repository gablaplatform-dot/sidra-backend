# Category workspace, Jobs and Events

Updated 4 November 2026. The category plan uses two admin sections: **Service Categories** and **Shop Categories**. The earlier name-association migration was stopped before application. `scripts/migrate-product-taxonomy.js` now refuses execution; use `scripts/migrate-category-workspace.js`.

## Production status

Deployed and migrated on 4 November 2026; Fly release 152, CI run 41793786311 succeeded. Public/admin main branches are published. All 7 listings and 179 product categories remain intact; provider category rows are now 346, including shop mirrors and the retained legacy service bridge. Database integrity/foreign-key checks passed, and a repeat preview proposes no additions or provider moves. APK `Gabla-category-workspace-v16.apk` is built and verified. Two legacy businesses selling products while assigned to service categories remain flagged for admin classification review; their current listings remain editable.

## Categories

- `Category.taxonomyKind` identifies `service` or `shop`. Existing provider categories retain their IDs and tree. Electronics Appliances is retired from the service tree; its provider moves to the existing Electronics shop branch.
- Existing `ProductCategory` rows are the shop tree. IDs, parents, images, listing fields, existing listing references and attribute filters stay intact. Category rows with the same stable IDs allow businesses to select shop categories. No name matching connects unrelated businesses.
- Services use the existing provider service tree. ServiceCategory rows mirror those stable IDs for existing listing foreign keys. Old service rows remain stored. A used old category is retained under its actual provider branch with inherited fields, without changing its listing ID/reference.
- Admin sidebar has one Categories entry. Its window starts with Service Categories and Shop Categories; standalone Product Categories and Service Categories entries are removed.
- Web and native forms load `/product-categories/mine` and `/service-categories/mine`. Server validation restricts new or category-changed listings to active leaves inside the provider's branch. Ancestors remain breadcrumbs; sibling branches are excluded.
- An owned listing's current category path can be included using `?listingId=...` so existing listings stay editable. This does not permit new listings outside the business scope or expose another seller's private listing.
- Shop and service edits synchronize their listing/provider category mirrors transactionally. Cross-tree moves are blocked. Categories used by providers or listings cannot be deleted. Ordering is independent for service and shop roots.
- Existing service field definitions win by key. Additional questions are optional and editable: rooms/amenities, repair scope/materials/warranty, teaching mode/course duration, consultation modes, vehicle types, event capacity, equipment capacity, and other service-specific questions.
- Seller-owned `/shop-categories` remain private storefront collections; they are distinct from the global Shop Categories admin section.
- Businesses already selling products under service business categories are reported for admin review. Their current identity is not silently changed from product names; existing listings remain editable.

## Migration

Preview against a consistent copy first:

```sh
DATABASE_URL=file:/absolute/path/copy.db node scripts/migrate-category-workspace.js --report /safe/path/plan.json
```

After reviewing the plan, add `--apply`. The script creates a 0600 SQLite VACUUM backup and writes within one transaction. It verifies every original listing and product category (except the new association/timestamps), original provider-category parents/names/images/settings/provider questions and existing listing field definitions, record counts, and foreign keys. Repeated application creates no duplicate categories or questions.

A rehearsal using all 166 provider, 179 product, and 59 old service category records passed. The isolated workflow test covers retained listing data, a legacy service bridge, Electronics movement, service/shop scoping, editing exceptions and cross-provider isolation, category edits and ordering, inactive ancestors, and idempotence. Full Flutter tests: 281 passing; analysis has no errors/warnings (informational style suggestions remain).

## Jobs and Events

- Jobs support vacancies and paid tasks, public browse/filter/detail, signed-in posting/editing, own/saved posts, applications with a portfolio/CV URL, applicant withdrawal, and owner review/shortlist/decline.
- Events support posters/photos/videos, start/end time, venue/location, entrance prices, RSVP, and an optional organizer booking link. No in-app ticket sales or payment collection.
- Admin Jobs/Events permissions control moderation. Posts require approval before public browsing; owner changes return a post to moderation. Existing superadmins retain `*`; other roles are not widened automatically.
- Ownership, private application data, allowed response statuses, required dates, and closed/deadline checks are enforced server-side. Public DTOs omit moderation notes and applicant contact information.
- Five native designs have independent layouts and existing palette/font/motion settings. Videos use tap-to-open sound playback. Maps use the existing native Google Maps configuration and mode switching.

## Verification commands

Taxonomy tests only allow the dedicated disposable database and require a fresh fixture:

```sh
DATABASE_URL=file:/tmp/gabla-taxonomy-workspace-test.db node scripts/sqlite-push.js
DATABASE_URL=file:/tmp/gabla-taxonomy-workspace-test.db node --test test/category-workspace.test.js
```

Community HTTP tests only allow `file:/tmp/gabla-community-test.db`. Never run fixture resets against a live database. Production verification uses read-only health/category/listing/API checks; no fake production posts, applications, users, messages, or payments are created.
