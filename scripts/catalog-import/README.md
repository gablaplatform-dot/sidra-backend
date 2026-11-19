# Additive demo catalogue import

This batch adds 600 public-source product references and 60 clearly labelled demo
provider accounts. These are presentation accounts, not the actual Jiji sellers.
No seller identities, phone numbers, ratings, reviews, orders, transactions,
promotions or payment records are imported. Commerce and contact fees are disabled
on the new providers, and payments are disabled on their listings.

`catalog-20261112.json` records each item's original source URL, original product
photo URL, factual price, category mapping and validated filter attributes. Prices
are source references rather than live offers. Public source URLs can subsequently
change or stop serving photos. Images are not generated and are not stock-photo
substitutes. The source page itself remains the authority on the original offer.

Collect public pages sparingly, respecting source rate limits. `collect.py --offline`
uses previously cached pages under `/tmp/gabla-catalog-sources`. Required category
fields must be established from source attributes or explicit words in the title;
items without sufficient information are skipped. Category schemas are never changed.

## Run

From the repository root, with `DATABASE_URL` set to the intended SQLite database:

```sh
node scripts/catalog-import/import.js
node scripts/catalog-import/import.js --apply
```

The first command validates and prints a plan without writing anything. The second
creates missing batch rows only. Deterministic IDs make reruns additive and
idempotent. ID collisions with records lacking the batch marker abort the import.
Pre-existing rows in the three writable tables are fingerprinted before and after.
`import-report.json` contains totals and the manifest hash after a successful run.

Take a consistent SQLite backup with `.backup` before a production import; copying
the database file alone can omit active WAL changes. Never run the older
`seed-demo-marketplace.js` as a substitute: that script clears its own earlier data
and has different scope.

Batch records use IDs beginning `catalog-20261112-`, reserved `.invalid` email
addresses, `user.profile.seedBatch`, and provider/listing `media.seedBatch`.
The import does not modify existing records, categories or existing APK releases.

## Category relevance and coverage audit

`coverage.py` audits the original demo batch against explicit source category,
gender, product name and selected photo reviews. It uses no random category
assignment. It fills visible leaf-category gaps toward 12 distinct source-backed
items, retaining original item photographs and source links. Identical source URLs
and photo URLs are excluded. The release batch also passed an image-file hash
check across the complete original and new catalogue (2,026 unique images).

The preparation snapshot covers 148 visible leaf categories. The reviewed expansion
adds 1,426 items, corrects 58 demo listings, and reaches the target in 146 leaves.
Franchise/dealership and investor/partner opportunities remain below target because
the public source pool did not establish enough genuine matching offers. These gaps
are explicit in `coverage-20261112.json`; unrelated products are not used as filler.

Regenerate preparation from a fresh read-only production taxonomy/listing snapshot
at `/tmp/gabla-catalog-audit.json` and public source navigation links at
`/tmp/gabla-source-category-links.json`. Public HTML and photo responses are cached
in `/tmp/gabla-catalog-sources`. Requests must respect source rate limits.

```sh
python3 scripts/catalog-import/coverage.py --online
node scripts/catalog-import/apply-coverage.js
node scripts/catalog-import/apply-coverage.js --apply
```

Omit `--online` to use cached public pages only. The JavaScript command defaults to
dry-run. Only listings explicitly owned by the original demo batch can be corrected;
other existing records are fingerprinted and checked for preservation. Additions
have deterministic batch IDs. A second local apply was verified to make zero changes.
`coverage-report.json` records the production result and remaining gaps.

The expansion never invents an undisclosed specification to satisfy a seller form.
Known answers are checked against existing field definitions; unknown required
seller-form answers are omitted and recorded in `media.unverifiedRequiredFields`.
The seller forms and category schemas retain their existing validation. The source
attributes remain in media provenance for future enrichment.
