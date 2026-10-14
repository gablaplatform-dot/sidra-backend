# Gabla MVP launch audit, round 2

Date: 2026-10-14 (afternoon). Four independent code audits (security and the 14 fixes, privacy and abuse, admin app and bus, storefront and mobile shell) plus my own checks of production, all run after the 14 blockers from [LAUNCH_AUDIT.md](LAUNCH_AUDIT.md) were fixed. Ride is excluded. Items marked **(verified)** were reproduced by running code; the rest come from reading it.

## Verdict

**The 14 blockers hold. The platform is safe to take money in a small, watched launch, but not yet safe to open to the public.** What remains falls into five groups, in this order of urgency:

1. **The contact-unlock paywall can still be bypassed** (five ways). That is your revenue model.
2. **Two anonymous attacks can take the server down**: filling the disk through public write endpoints, and saturating the CPU through search and sign-up. There are no per-route rate limits.
3. **Deleting a listing or provider silently destroys paid bookings, wallets and receipts.**
4. **A few screens and flows will embarrass you on day one**: the order dialog cannot be scrolled on phones, no privacy policy or terms, fabricated claims on the Shop page, Reports and dashboard numbers that are invented.
5. **iOS cannot ship yet** (sign-in not configured, Apple requires Sign in with Apple).

## A. The original 14 blockers: independent verification

| # | Blocker | Result |
|---|---|---|
| 1 | Admin permissions | Verified fixed (an Auditor token got 403 on about 25 admin routes). Only the dashboard and permissions list stay open to every admin by design. |
| 2 | Onboarding links | Verified fixed for replay. Three small gaps below (B5). |
| 3 | Bootstrap route | Verified fixed (404, no references left). |
| 4 | Session tokens | Verified fixed. Bad, id-less, purpose and numeric-id tokens all get 401; bus operator and admin-invite sessions still work. |
| 5 | Suspension | Verified fixed for users and admins. **Not fixed for provider suspension**: suspending a provider changes only its public visibility, so it can still sign in, edit listings and request withdrawals (B5). |
| 6 | Long-text freeze | Verified fixed (200,000 characters in about 1 ms). The fix introduced a regression, now fixed (section B). |
| 7 | `javascript:` links | Fixed everywhere except bus operator custom answers, now fixed. |
| 8 | Webhook key | Works as designed. Enforcement is still off by design. |
| 9 | Late payments, sweeper | Verified fixed (late success credited exactly once; four concurrent callbacks credited once). |
| 10 | Refund path | Verified fixed for orders and bookings (three concurrent resolves reversed the wallet once). Bus gaps in B3. |
| 11 | Payout atomicity | Verified fixed. One gap: a payout stuck in "approved" over 5 minutes can only be marked paid, never rejected. |
| 12 | Payouts screen | Backend and shapes verified. It swallows its own error messages (B5). |
| 13 | Favourites and reviews | Verified fixed; the database script also applies cleanly to a fresh and an existing database. |
| 14 | Demo data | Verified: 0 demo users, no bus companies, seeds refuse production. |

## B. Fixed during this audit

- **My own regression:** the stricter website pattern flagged ordinary sentences ("Quiet area. Shop nearby.", "Online booking is available.") as links, so real service listings would have been rejected. Fixed and deployed (verified against 13 test sentences).
- **Gateway amount check could have parked every real payment** if the gateway reports an amount that includes its own charges. It now only logs a mismatch, until a real payment shows what the gateway sends. Set `MOBILE_MONEY_ENFORCE_AMOUNT=true` later to hold on mismatch.
- **Turning on webhook enforcement would have broken ride payments** (their callbacks had no key). Ride callbacks now carry the same key.
- Bus operator answers are now size-bounded and free of script links; the admin app only links web addresses.
- A provider an admin rejected or suspended can no longer be re-approved by completing onboarding; the onboarding info endpoint needs a live link.

## C. Fix before opening to the public

### C1. The contact paywall (your revenue) can be bypassed
1. **Instant bookings reveal everything for free (verified).** Phone, WhatsApp, address, a map link with exact coordinates and the door-code instructions are returned the moment a booking is confirmed, and in the confirmation email. A free account books any date, reads it, cancels, repeats. Fix: only show contact and instructions once the deposit is paid or the contact is unlocked; never put exact coordinates in a link.
2. **Quotation emails and PDFs print the provider's phone, address, email and website (verified).** Any logged-in user can place an order with a made-up line for any provider and get the quotation. The reply-to address is the provider's login email. Fix: brand quotations and unpaid-order documents with name and logo only; drop reply-to; require a real product line on every order.
3. **Exact location from three requests (verified, 32 m error).** `distanceKm` rounded to 0.1 km sits beside the "approximate" pin; the ads endpoint returns it unrounded. Fix: snap coordinates to a 1 to 2 km grid before computing distance publicly, or bucket distance to 5 km.
4. **Booking `instructions` (door codes) are public on every listing response (verified).**
5. **Only services are guarded.** Product names and descriptions, provider profile text, ads, review comments and category names accept phone numbers, emails and links; changing a service to a product with `PATCH` skips the guard. Fix: run the guard on every create and update path.
6. **The guard can be evaded.** Text past 2,000 characters is not scanned (a phone after 2,400 characters got through); digits split by letters or long separators, emoji digits, other TLDs (`.rw`, `.africa`), "Instagram bestsalon" and lowercase addresses all pass, and an AI failure lets everything through.

### C2. Anonymous attacks on availability
1. **Disk fill (verified, about 100 MB a minute from one IP).** The public visit, contact-event, search-event and inquiry endpoints store whole `metadata` and `filters` objects up to the 1 MB body limit. At the global limit that fills the 5 GB volume in about 50 minutes, after which all writes fail. Contact events also accept a client-supplied `paid: true`. Fix: cap those fields to a few hundred bytes or drop them.
2. **No per-route rate limits.** One global bucket of 120 requests a minute, applied before static files (carrier NAT will cause false 429s). Needed per minute per IP: search 10, nearby search 5, contact unlock 3, login 10, sign-up 5, link-google request 3, orders and bookings 10, uploads 10, public writes 10.
3. **`/search` blocks the server (measured).** It loads every provider and listing and scores them in JavaScript: about 0.8 to 1.8 s per call at 10,000 listings. Fix: filter in SQL first and cache for a few seconds.
4. **Sign-up and login burn CPU (measured).** Password hashing takes 373 ms; eight at once lag the server by 0.8 s. Sign-up is open and unverified.
5. **The home search calls the paid Anthropic API on every new query** (anonymous; adding a word defeats the cache). Fix: a per-IP limit, an hourly budget and a stem-keyed cache.
6. **Anonymous contact unlock sends payment prompts to any phone (verified, 30 numbers in 188 ms).** Fix: require sign-in, validate the number, one open unlock per user and provider.
7. **Email relay.** Quotations go to a buyer-supplied, unvalidated email with buyer-chosen item names; resends and the Google reconnect email have no cooldown. Fix: validate and rate-limit sends per user and per recipient.
8. **Uploads have no size limit or quota**, and any account can mint upload links.

### C3. Data loss
1. **Deleting a listing silently deletes its bookings, including paid ones (verified).** The guest's booking disappears, the provider keeps the money, and nothing is queued for refund.
2. **Deleting a provider destroys wallet, withdrawal requests, orders, receipts and bookings**, with no balance or open-item check.
3. **The refund queue only reads the newest 1,500 payments**, so an older refund drops out of view.
4. Four foreign keys are missing even on a fresh database, and the live (older) database very likely lacks about ten more, so deleted categories leave dangling ids. Category deletes do not check use.

### C4. Booking and order logic
- Anyone can hold a provider's whole calendar for free (20 instant bookings back to back, verified); instant bookings without a deposit never expire.
- The quotation total can differ from what is charged (verified: quote 150,000, buyer charged 100,000, receipt prints 150,000).
- Product stock is never checked or reduced; accepted online orders never expire; there is no order state machine (a rejected order can be accepted, a refunded one fulfilled); a guest can stay and then cancel a paid booking.
- Concurrent booking bursts give 500 errors to about 40% of requests (no double booking happens).

### C5. Storefront and apps
- **The order dialog cannot be scrolled on phones, so "Place order" can be unreachable** (modal CSS has no overflow).
- **No privacy policy, terms or account deletion anywhere.** Required by Google sign-in verification and both app stores.
- Shop page shows fabricated claims ("Loved by 50,000+ customers", "100% satisfaction guarantee", invented star ratings, "24/7 support", "Background-checked") and falls back to a hero with dead buttons now that the demo ads are gone. Listings without a photo load a stock image from a developer image-generator URL.
- **Expired sessions leave the app looking signed in**; "Sign in" appears to do nothing. The token lasts one hour with no refresh, so the app asks for Google every hour.
- **The cart is emptied by any failed load**, and typing a quantity breaks.
- A contact-unlock payment can be lost if the buyer taps outside the dialog while waiting.
- Delivery orders are blocked if the Maps key is rejected (the "type your address" fallback never triggers).
- PDFs (quotes, receipts) will not open in the native app.
- The bus promo still shows although there are no bus companies.
- **iOS:** sign-in not configured, no URL scheme, Apple requires Sign in with Apple, no privacy manifest. **Android:** release build is unsigned and the status bar is white on white; the Google sign-in needs the Android OAuth client with SHA-1s.

### C6. Admin
- **Settings can overwrite production fees with placeholder values** if it fails to load (subscription 29.99, contact 1.50, fee 5%, e-commerce off).
- **Reports and its CSV are fabricated**, and the dashboard has invented charts, trend percentages and a revenue figure that adds up withdrawals and all-time sales.
- Creating a provider with a blank description fails; there is no "resend invitation" button and no email delivery feedback.
- The Payouts screen swallows failures (an error is set and immediately cleared), so an admin never sees "provider balance too low".
- Resolving a bus refund in the new queue leaves the bus booking stuck, so the same refund can be paid twice from the Bus screen. Cancelled-trip bus refunds are not in the new queue.
- Suspending a provider does not block API use; provider deletion is unguarded.
- Reviews can never be approved (no screen), so none appear publicly; no user suspend screen, no orders or bookings view, no promotions manager. Users, Subscriptions and several header controls are dead.
- Roles already in the database do not gain the new `promotions`, `rides` keys.

### C7. Bus
- Operators can withdraw immediately, before the trip runs; cancelling afterwards drives the balance negative and the platform fee is never reversed.
- The ticket QR image is blocked in browsers (`Cross-Origin-Resource-Policy: same-origin`, verified earlier on production).
- Tickets can be issued after departure; no per-user cap on seat holds; the payment result page says "expired" or "declined" when a late payment is about to succeed or the money was taken and seats are gone.
- A registered operator who forgot their password cannot reset it from the UI; a mistyped company email cannot be corrected or removed.

### C8. Operations
- Production settings today: contact fee UGX 1,000 (good); **subscription fee 0 with subscriptions enabled** (activating a subscription fails until you set a fee or turn it off); sale fee 0%; minimum withdrawal 0.
- The `SEED_ADMIN_PASSWORD` secret is still on Fly. Confirm you can sign in, then remove it.
- Webhook key enforcement and the new amount check stay off until one real payment has been tested.
- Dependencies: one critical and several high advisories remain (`npm audit fix` is non-breaking for the backend runtime packages).
- Backups: only Fly's 5-day snapshots plus the file copy I made today; no off-site copy.
- Production checks that passed: strict CORS (disallowed origin gets no header), HSTS and security headers, rate limit works per client IP (120 per minute), health check, admin and storefront sites up, admin invite link points at the real admin domain.

## D. Suggested order

1. **Batch 1, about a day (stops the worst):** bound the public write payloads; per-route rate limits and a search cache; gate booking contact and instructions; strip contact from quotations and reply-to; snap public distances; guard products, profiles and ads and scan full text; block listing and provider delete when money is attached; fix the order dialog scroll; Settings placeholder save; QR header; Payouts error display.
2. **Batch 2, about a day:** privacy policy, terms and account deletion; replace fake claims and placeholder images; session expiry and cart fixes; bus payout holdback and hold caps; quotation total written to the order; booking hold caps and an order state machine; provider suspension that really blocks; Reports and dashboard made real or hidden; provider invite and resend fixes.
3. **Before any iOS build:** iOS OAuth client, URL scheme, Sign in with Apple, privacy manifest. **Before Play:** release signing and a policy-compliant listing.
