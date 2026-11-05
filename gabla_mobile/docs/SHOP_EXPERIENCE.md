# Customer shopping experience

Audited against `public_app/src/pages/{Shop,ShopBrowse,ProductDetail,ProviderDetail,Cart,MyOrders}.jsx`, the shop/browse/product/provider components, `lib/{browseFilters,orders,tracking,providerContact,documents}.js`, and the backend listing, provider, interest, payment, promotion, document and engagement routes/services.

## Five presentations

| Design | Shopping home | Catalog and filters | Detail / seller treatment |
| --- | --- | --- | --- |
| Gabla Classic | Split shopping hero, compact category rail, arrivals and best-seller grid | Grid-first, native bottom sheet | Rounded photo gallery, seller groups, clear purchase bar |
| Editorial | Large serif edit, angled photo, ruled footer, early promotion placement | List-first until a layout preference is saved; filter panel slides from the right | Headline before photos, square edges, reading-led seller profile |
| Discover | Capsule photo hero, personalized picks first, swipeable arrivals | Grid/list with spacious rounded filter sheet | Inset swipe gallery, rounded product surfaces, stacked cart photos |
| Cinematic | Full-photo hero with scrim, best sellers before arrivals | Dark catalog; filter panel fades and gently scales | Taller gallery, cinematic seller cover, persistent purchase bar |
| Orbit | Circular masked hero image, category chips, personalized picks and horizontal arrivals | Grid/list; filter panel expands from the bottom-right | Rounder gallery and panels, centered seller identity, grouped bag |

Palettes, font pairings and ambient backgrounds remain independent. Existing system reduced-motion support applies to page, filter, gallery and scroll animations. Gallery autoplay pauses during interaction, zoom, backgrounding, offscreen exposure and reduced motion. Muted ad video pauses when inactive/offscreen.

## Behavior mapping

| Web capability | Flutter implementation / contract |
| --- | --- |
| Home categories, new arrivals, best sellers | Dedicated roots/new-arrivals/best-sellers endpoints; independently loaded shelves and pull-to-refresh |
| Nearby district advertisements and promotions | `/promotions/ads/nearby`, `/promotions/featured`; supplied images/video, CTA targets, countdown when an expiry is supplied |
| Personalization and continue browsing | `/interest/for-you`; categories, recent searches, recently viewed products; explicit clear-history confirmation; account claim and view/category/search/cart/order signals |
| Category hierarchy | Nested category explorer and category filters; product and service category trees remain separate |
| Category / collection / seller catalogs | `/listings`; productCategoryId, serviceCategoryId, providerId and provider-owned shopCategoryId scopes |
| Filters and honest counts | `/listings/facets` shares the listing filter query; price bounds/buckets, discount, multi-value attributes, countries, cultures, districts, GPS radius |
| Seller-owned categories | `/shop-categories/provider/:id`; unscoped category counts preserve the rest of the seller tree |
| Sort, pagination and layouts | Five server sorts, 24-item pages, total count, persistent grid/list preference, search widening notices, preferred-district arrangement |
| Share / Back | Copyable canonical web collection links; repeated attribute parameters are read; local history restores earlier filter states; product links can be copied |
| Product detail | Deduplicated photos, swipe/thumbnail navigation, fullscreen zoom, descriptions, category labels, custom specifications with units/booleans/URLs, discounts, location/date, similar listings and more from seller |
| Purchase controls | Product-only cart additions; cash and online-after-acceptance order requests; seller/listing online-payment flags; direct buy with quantity without disturbing the cart |
| Bookable/service listings | Booking configuration derives bookability; existing native availability/booking route; service contact actions and service-scoped browse/filter/catalog |
| Seller profile | Cover/avatar, real review counts and rating, approval, member year, listing count, audiences, description, category-defined answers, gallery/portfolio, menu/booking/ecommerce category treatments |
| Contact gating | Server-redacted details remain hidden. Authenticated contact access or device unlock proof restores contact. Anonymous unlock proof is stored in secure storage |
| Contact actions | Call, WhatsApp, email, website, directions and copy; non-blocking contact/visit analytics |
| Cart | Device-local 1–99 quantities, remove/clear confirmation, seller groups, per-line and seller totals, unavailable-listing retry/removal, sign-in required only for order submission |
| Checkout | Name/phone/address validation, pickup/delivery, notes, GPS/geocoded/map coordinates, one order per seller; successful cart lines removed and failed seller lines retained; no payment collected here |
| Customer orders | Uses `/engagement/orders/mine`, not the provider-only detail endpoint; all/open/completed/closed filters and counts, item links, seller links, lifecycle steps, fulfillment, payment state |
| Pay an accepted order | `/payments/orders/:id/pay`, mobile-money prompt, status polling, success/failure/timeout, check-again without creating another charge |
| Quotations and receipts | Metadata, revisions, superseded and email state; authenticated `/documents/:id/pdf` binary download and an in-app zoomable PDF viewer |

## Verification and practical limits

- Automated tests cover listing/facet query parity, payment gates and booking DTOs, partial checkout, buy-now cart preservation, PDF authorization/renewal, complete/incomplete delivery coordinates, payment polling, and all five shopping presentations at 320px with enlarged text.
- Existing navigation, scroll, nearby, theme and cart tests remain part of the suite. Rendered previews are generated with `flutter test test/commerce_flow_test.dart --dart-define=COMMERCE_PREVIEWS=true` into `build/previews/shop/`.
- Read-only live checks confirmed the current listings, category tree, audience, advertisement and promotion response envelopes.
- Live order creation, real mobile-money charges, authenticated documents and contact-unlock purchases require a test account/provider and payment sandbox. No real purchases or charges were made during implementation.
- Native map pins and satellite views require the native Maps keys described in `NATIVE_MAPS.md`. Typed delivery addresses, GPS/geocoding and the catalog remain usable without them. The mobile app requests location on an explicit location action rather than prompting every visitor automatically.
- This is the public customer shopping flow. Administrative/provider inventory editing, promotion publishing and staff order management retain their separate existing routes.

Product image auto-scroll is adjustable in **Design Studio → Motion**. It defaults to 1.5 seconds, supports 1–10 seconds in 0.5-second steps, and persists across app launches. Changes apply to galleries across all five designs; reduced motion, visibility, background, and interaction pauses still apply.
