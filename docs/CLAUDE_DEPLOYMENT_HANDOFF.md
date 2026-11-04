# Superseded category instructions

The user replaced the name-association plan. Read `CATEGORIES_JOBS_EVENTS.md` and use `scripts/migrate-category-workspace.js`, not the old product-taxonomy script. Fly authentication was restored through the CLI browser login on 4 November 2026. Codex is handling the release; do not deploy concurrently. The historical handoff below is retained for context only.

# Claude deployment handoff — Gabla categories, Jobs and Events

The user explicitly asked Codex to instruct the open Claude app to use its Fly access, and to find out how that access works. This handoff is limited to deploying the existing verified Gabla changes and migrating the category associations with backups. Preserve all unrelated work and all live user/business/order/payment data.

Workspace: `/Volumes/DevDisk/dev_external/sidra`

Read first: `docs/CATEGORIES_JOBS_EVENTS.md`. The implementation is already in the shared working tree; do not rebuild the features from scratch. The backend/public repository, `admin_ui`, and `gabla_mobile` are separate repositories/checkouts. Existing uncommitted work is intentional. APK v15 is already built and verified:

`gabla_mobile/build/app/outputs/flutter-apk/Gabla-jobs-events-preview-v15.apk`

## Scope and current verification

- New nullable `ProductCategory.providerCategoryId` links product branches to provider/business categories, inherited by descendants.
- Admin product-category editor assigns the link. Provider product creation is scoped through `GET /product-categories/mine`; backend validates business scope when category is chosen/changed. Existing IDs, images, custom fields, private seller shop folders, and service categories are retained.
- Jobs: vacancies and paid tasks, own posts/saved posts, private applications, employer review/shortlist/decline, applicant withdrawal, admin moderation.
- Events: listings, posters/photos/videos, venue/time/entrance price, maps, RSVP and external organizer booking link. No in-app ticket sales or payment collection.
- New APIs: `/api/v1/jobs`, `/api/v1/events`, with protected own/admin/application routes.
- `jobs` and `events` admin permission keys are registered. Existing Super Admin `*` covers them; do not automatically widen other roles.
- Root `npm run lint`, backend HTTP tests (3), public build, admin build, full Flutter tests (281), and Flutter analysis (no errors/warnings) passed locally.
- Migration rehearsal preserved 172 reachable public category IDs and six listing fixtures; all 17 product roots linked; a repeat apply created no duplicates. The public API reports 178 active product nodes, but six were absent from its returned public tree. You must preview the FULL live DB, including hidden/inactive/unreachable branches, before migration.
- Local Codex `flyctl auth whoami` reports no access token. No production changes have been made by Codex.

## Required deployment sequence

1. Diagnose the working Fly authentication method in your existing session. Report only the mechanism/source (CLI session, environment variable NAME, connector, or CI) and account/app scope, never token values. Do not paste/export credentials into chat or commit them, and do not create/broaden credentials merely to give Codex access.
2. Confirm the target Fly app is `sidra-api`, SQLite DB `/data/sidra.db`, existing public API `https://sidra-api.fly.dev/api/v1`. Use the existing authenticated context.
3. BEFORE deployment/schema sync, create a consistent full SQLite backup on the persistent volume with `sqlite3 .backup` or an equivalent online backup. Set backup mode 0600, verify the backup opens and passes integrity checks, and record its path. Capture record counts and existing category/product/listing IDs for comparison; do not print private customer data.
4. Inspect the current changes and deploy the backend/public build safely through the existing Fly workflow. Standard startup runs `scripts/sqlite-push.js` (additive schema) and generates/seeds existing platform configuration as usual. Do not use `--accept-data-loss`, destructive Prisma resets, directory synchronization with deletion, or restore/clean commands that discard shared working files. In particular, DO NOT run rsync with `--delete` or similar synchronization commands.
5. In the deployed app, run `scripts/migrate-product-taxonomy.js` WITHOUT `--apply` first, using `DATABASE_URL=file:/data/sidra.db`. Save the full live plan and inspect it. It selects explicit mappings, unique existing product/business relationships, or exact unique names; unmatched roots create provider/business branches under Shop. Ambiguous entries are marked `review` and block application. Do not guess or merge overlapping taxonomy nodes. If ambiguity cannot be resolved from actual references, deploy the additive API and leave only that data migration pending with a precise report.
6. Apply the reviewed plan with `--apply` only when it is safe. The script creates an additional protected `VACUUM INTO` backup, updates inside a transaction, and verifies counts/foreign keys. Preserve every existing product/listing ID, parent link, image and custom-field definition. Check the result against the baseline; verify idempotence.
7. Deploy the public web (`public_app`) and admin (`admin_ui`) to their EXISTING configured repositories/hosting projects (`gogabla.com` and `admin.gogabla.com`), preserving any existing remote changes. The existing Claude conversation knows those deployment paths. Do not clone/sync over the workspace or force-push. If using git, keep unrelated local-only files out of commits and do not discard any edits. The backend Docker build now supplies the existing public Google web client ID; retain the deployment's other existing environment configuration.
8. Smoke-test the real public routes: health, product categories, existing products, `/api/v1/jobs`, `/api/v1/events`, and their web pages. Confirm protected posting/admin endpoints reject anonymous callers. Check admin category associations and Jobs/Events moderation controls using existing authorized admin access if available. Do not create fake vacancies/events/users in production, submit real applications, send notifications/emails, or perform payments just for testing. No credentials or personal data should appear in reports.
9. Write the outcome to `/tmp/gabla-live-deployment-result.md`: deployed version/commit or release, public/admin deployment status, backup paths, full live preview/apply outcome, before/after counts, any unresolved mapping IDs, smoke-test results, and Fly authentication mechanism (NO TOKEN VALUES). If access cannot be recovered, record the exact blocker. Tell the user once the live changes are verified.

There is no need to rebuild the Flutter APK for an API-only deployment; v15 already points at the production API. A new APK is necessary only if you make Flutter source changes.

Do not ask for tokens in chat. Use already authorized access, and follow your tool policy for any genuinely mandatory action-time approval. The user's preference is to continue autonomously without routine questions.
