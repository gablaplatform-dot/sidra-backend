# Public web image sources

The web app uses supplied business, product, event, promotion, category, and user media. This change does not modify uploads, API data, media editing, or live records.

Removed bundled generated jobs/events artwork (`public/artwork/jobs.png`, `events.png`) and their home, discovery-header, and post fallback references. `FeatureVisual.jsx` composes simple SVG interface icons on CSS backgrounds. Community posts retain supplied photos; missing or failed lead photos use the appropriate icon.

Removed `public/assets/gabla-provider-welcome.jpg` and its onboarding reference. Visual inspection showed an illustrated person with a phone, not a business photo or brand logo. Its available history records PNG-to-JPEG optimization, not an original source or generation method; provenance is unverified. Onboarding now uses the existing store icon.

Removed the two remote text-to-image defaults in `shopMappers.js`. Product and promotion fallbacks now use `public/icons/product-placeholder.svg` and `promotion-placeholder.svg`, simple programmatic package/tag symbols. Supplied image URLs still take priority.

Preserved `public/brand/gabla-wordmark.png`, existing programmatic bowl/map/interface graphics, and the root sharing fallback SVG. Only `public_app` was edited.

Validation: JSX/JS parsed with Babel, changed CSS parsed with PostCSS, mapper fallback/photo precedence checked directly, and `git diff --check` passed. No build, deployment, or push performed. Browser visual/interaction verification remains outstanding.
