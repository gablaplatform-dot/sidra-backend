# Commerce polish references

Reviewed 5 November 2026. Scope: `lib/features/shop`, `cart`, `orders`, `services`, `provider`. No backend, shared core, dependency, routing or business-data changes. Work is directly in the shared checkout; no commit, push, APK or Flutter command was run by this worker.

## Actual Pinterest sources inspected

Web search was attempted first; the search index returned weak results. The following exact Pinterest pin pages were then opened in the in-app browser and their visible images inspected. These are layout references, not product content or assets copied into the application.

| ID | Exact source | Observed visual evidence | Applied principle |
| --- | --- | --- | --- |
| P1 | [E-commerce App Checkout — Cipherslab](https://www.pinterest.com/pin/1044694444807164615/) | Product-to-cart video; compact product details, related products and persistent bottom action. | Keep order action and price clear; concise detail sections. This pin was inspected mid-video, not every video frame. |
| P2 | [Minimalist E-commerce App UI/UX Design — Aleem Zybs](https://www.pinterest.com/pin/627337423138163326/) | Two phone screens: category strip, two-column product grid, large product photograph, seller row, quantity and bottom price/action. | Clear category/product/seller hierarchy, restrained metadata, compact controls. No promotional claims, model images or fake ratings copied. |
| P3 | [Salon Booking Flow — Mobile UI by Vikky](https://www.pinterest.com/pin/683562049742174850/) | Three screens: provider portrait/service list, date/time options, review details with date/time/place/total. Linked original: [Dribbble](https://dribbble.com/shots/27583590-Salon-Booking-Flow-Mobile-UI). | Distinguish date selection from contact details; repeat the actual chosen dates, EAT time and price in booking review. |
| P4 | [E-commerce Home Screen](https://www.pinterest.com/pin/1088393434980765374/) | Search-first storefront, compact promotional area, categories and a regular product grid. | Prioritize real inventory and navigable categories; replace the no-ad marketing hero with a compact explanatory panel. |
| P5 | [Grocery shopping cart app UI](https://www.pinterest.com/pin/1088393434979330703/) | Thumbnail rows, adjacent quantity controls and prices, remove affordance, persistent total/action. | Compact cart rows in every style; subtotal wording; explicit review action. Gabla sends requests and does not charge at this stage. |

Search entry points actually used: [Commerce](https://www.pinterest.com/search/pins/?q=mobile%20ecommerce%20ui), [Booking](https://www.pinterest.com/search/pins/?q=service%20booking%20app%20ui).

## Five design directions

These use the existing five selectable designs, inherited fonts, customized palette and shared motion/reduced-motion controls. They are not five new duplicate flows.

| Existing design | Commerce structure |
| --- | --- |
| Gabla | Regular compact two-column catalog, lightly outlined seller/summary panels, conventional aligned information hierarchy. |
| Editorial | Existing list-first catalog and title-before-gallery flow; flat sections with top rules, square geometry and left-aligned identity. |
| Discover | Taller portrait product grid, contained cards, category-led discovery and existing bottom-sheet filters. |
| Cinematic | Single-column larger product presentation, more deliberate image focus, higher-surface receipt panels and framed detail views. |
| Orbit | Staggered product columns with varied photo proportions, centered identity and secondary-tinted panels; existing centered filter dialog retained. |

Critical transaction controls remain predictable across designs. Explicit list preference is preserved. Narrow content and large text use rows to avoid squeezing a grid. No new animations were introduced; existing transitions continue to consult reduced motion.

## Page-by-page application

| Page / owned source | References | Concrete changes |
| --- | --- | --- |
| Shop / `shop_screen.dart`, `shop_hero.dart` | P2, P4 | Plain Shop/search/category labels; no generated no-ad hero; real uploaded advertising still renders; compact no-ad explanation. |
| Categories / `shop_categories_screen.dart` | P2, P4 | Bounded category hierarchy, concise introduction, usable empty/error states. |
| Browse, collections and service browse / `shop_browse_screen.dart`, delegated collection/service screens | P2, P4 | Result vocabulary covers products and services; compact title; clear filters; honest Apply filters label rather than a stale total; reject nonnumeric/nonfinite prices and show price feedback near inputs. Existing category, location, audience and custom attribute filters remain. |
| Catalog items / `product_layout.dart`, `widgets/product_card.dart` | P2, P4 | Five styles differ in list/grid/portrait/feature/staggered structure; larger legible metadata, 48px add action; narrow/large-text row fallback. |
| Product/service detail / `product_detail_screen.dart`, existing gallery | P1, P2 | Compact cinematic gallery ratio; clear description/seller/ordering labels and failure guidance; unavailable provider action disabled; uploaded images/video and gallery behavior retained. |
| Cart / `cart_screen.dart` | P5 | Consistent cart vocabulary, compact seller groups and thumbnail rows in every style, useful empty/error states, review-order action, item subtotal, accessible quantity controls. |
| Checkout and result / `checkout_screen.dart`, `delivery_location_field.dart` | P1, P5 | Actual order summary, explicit no-charge notice, pickup/delivery and payment sections, no decorative fictitious stepper, useful address helper, clear complete/partial submission wording. Existing per-seller submission and retry behavior retained. |
| Customer orders and documents / `my_orders_screen.dart` | P1, P5 | Order history heading, clear awaiting/completed/cancelled labels, visible pickup/delivery context, readable progress labels and concise recovery. Documents/payment behavior retained. |
| Seller order / `provider_order_view_screen.dart` | P1, P5 | Smaller customer heading, customer/fulfillment grouping, explicit Accept / Decline / Mark completed actions. Existing confirmation and quotation/document behavior retained. |
| Services / `services_screen.dart` | P3, P4 | Compact categories with uploaded images or composed service icons; useful featured-services/provider labels; invitation CTA accurately describes invite-only onboarding. |
| Booking / `booking_screen.dart` | P3 | Compact actual-listing summary, accurate two-stage flow, EAT explanation, no-times guidance, selected dates/time repeated in booking summary, quantity grammar and restrained submission button. Existing availability/deposit/payment logic retained. |
| Booking history / `my_bookings_screen.dart` | P3 | Distinguish empty filtered view, visible provider identity, correct room/space terminology using actual booking unit, inherited status colors. |
| Business profile / `provider_detail_screen.dart` | P2, P3 | Compact uploaded cover and identity, safer empty-name fallback, clear about/catalog sections and actual published listing count; useful no-listings state. |
| Contact and reviews / `provider_contact_panel.dart`, `provider_engagement_panel.dart` | P2, P3 | Compact contact map, clear locked-access fee explanation without an unsupported lifetime guarantee, straightforward save/contact labels. Existing unlock, inquiries, reviews and favorites retained. |
| Listing editor / `listing_form_screen.dart` | P2, P3 | Structured details header and section hierarchy, real-photo guidance, practical description/stock helper labels; compact inherited inputs and booking controls. Media upload and save payloads retained. |
| Invitation / `provider_onboarding_screen.dart` | P3 | Compact themed business icon replaces generated hero; accurate invitation/profile labels; actual invitation completion remains. |
| Feature-local primitives / `commerce_widgets.dart` | P1–P5 | Commerce-only scaffold, compact titles, consistent panel grammar, theme-aware icon default; inherits user fonts/colors/motion. Shared core is untouched. |

## Imagery and coordination

Removed all `Image.asset`, `assets/artwork/*`, `assets/categories/*` and `CategoryCover` usage from owned feature screens. Replacements use Material icons composed with the selected theme. No external stock photos or invented business data were added. Actual network-supplied listing, business, category, gallery and advertising media remain intact. Their provenance cannot be inferred from a URL; the code does not delete user uploads. Parent owns deletion of generated PNG directories and pubspec entries.

The existing screenshot helper is in `test/commerce_flow_test.dart` (`COMMERCE_PREVIEWS`, `RepaintBoundary`, outputs `build/previews/shop/<style>.png`). It preloaded `assets/artwork/shop.png` around line 416 at inspection time; parent was notified and owns its removal. The same test expects `Show matching finds · 1`; the intentional label is now `Apply filters`. Parent owns test edits. No tests were edited by this worker.

## Verification and limits

- Standalone Dart formatter parsed all owned presentation sources successfully. This invokes the cached Dart binary directly, not Flutter.
- `git diff --check` passed for the five owned features.
- Source search confirms no generated bundled image references remain in owned features.
- Runtime tests, analyzer, current render capture and visual review of resulting Flutter screens are delegated to parent per instruction. Pinterest screenshots were visually inspected; app render approval has not been claimed.
- Suggested parent coverage: existing commerce flow/payment/image-settings tests plus 320px and 390px layouts, all five styles, text scaling 1.3/1.6, custom palette/font and reduced motion; especially long cart totals, filter validation, booking availability/summary and profile empty states.
- Backend routes, repositories, domain models and submission payloads were not changed. Server-supplied arbitrary error strings still exist in some existing submission-result flows; recovery messages for primary browse/order/profile loading are now plain language.

## Changed source inventory

All paths below are relative to this application. Only these 21 source files and this reference document were changed by this worker.

- `lib/features/cart/presentation/`: `cart_screen.dart`, `checkout_screen.dart`, `delivery_location_field.dart`.
- `lib/features/orders/presentation/`: `my_orders_screen.dart`, `provider_order_view_screen.dart`.
- `lib/features/provider/presentation/`: `listing_form_screen.dart`, `provider_contact_panel.dart`, `provider_detail_screen.dart`, `provider_engagement_panel.dart`, `provider_onboarding_screen.dart`.
- `lib/features/services/presentation/`: `booking_screen.dart`, `my_bookings_screen.dart`, `services_screen.dart`.
- `lib/features/shop/presentation/`: `commerce_widgets.dart`, `product_detail_screen.dart`, `product_layout.dart`, `shop_browse_screen.dart`, `shop_categories_screen.dart`, `shop_hero.dart`, `shop_screen.dart`, `widgets/product_card.dart`.
