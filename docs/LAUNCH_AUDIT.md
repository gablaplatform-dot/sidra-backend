# Gabla MVP launch audit

Date: 2026-10-14. Scope: everything except the Get a ride module. Six parallel code audits (auth and API security, money flows, marketplace data, bus ticketing, customer web app, admin app) plus my own checks of production, dependencies and infrastructure. Findings marked **(verified)** were reproduced by running the code or hitting production; the rest come from reading the code.

## Verdict

**Not ready to launch as it stands. It can be ready after one focused fix pass.** The product itself is wired up: every API call in the storefront, the admin app and the bus module has a matching route with compatible fields, all three apps build, production is healthy and the email domain is verified. The blockers are not missing features. They are (1) gaps in who is allowed to do what, (2) the payment webhook trusting anyone, (3) money edge cases with no refund path, (4) demo data live on production, and (5) a few screens that show invented numbers.

Counts: 14 launch blockers, about 20 high, about 35 medium.

---

## A. Launch blockers (fix before real users or real money)

### Security and access
1. **Admin routes that skip permission checks (verified).** Withdrawal approve/reject/mark-paid (`src/routes/payment.routes.js:101-123`), provider create/approve/resend (`provider.routes.js:62-98`), all category trees (`category.routes.js`, `productCategory.routes.js`), promotions and ride admin only check "is an admin", not the role's permissions. Any admin, including a read-only Auditor, can trigger a real payout, approve providers, delete categories and publish promotions. Fix: add `requirePermission(...)` to each; add `promotions` and `rides` permission keys.
2. **Provider takeover chain.** The resend-invitation route returns the raw onboarding token, and that token (valid 7 days, never single-use, not checked against the stored hash) lets anyone reset the provider's password and re-approve a suspended provider. Same flaw for bus operators (`busOperator.service.js:255-312`): the emailed link is a reusable master credential, and there is no password reset anywhere. Fix: single-use tokens checked against the invitation row, refuse once registered, never re-approve, don't return tokens in API responses, add an admin "reset access" action.
3. **Open admin bootstrap (verified).** `POST /auth/bootstrap/admin` is public. If production ever starts with no admin, the first caller owns the platform. Fix: delete the route (boot seeding already covers it).
4. **Any signed token without a user id reads everyone's data (verified).** `requireAuth` accepts any JWT signed with our secret, including the admin-invite token, which has no `sub`. Prisma treats `where: { userId: undefined }` as "no filter", and I confirmed it returns bus bookings of other users. Fix: reject tokens without `sub` and with a non-session `purpose`.
5. **Suspension is not enforced.** Google sign-in ignores `isActive`, and `requireAuth` never re-checks it, so suspended users and deactivated admins keep working for up to an hour and can sign straight back in with Google. Google login also doesn't check `email_verified` and links by email, so a pre-registered account with someone else's password survives a Google sign-in. Fix: check `isActive` in both places (cache briefly), require verified email.
6. **ReDoS can freeze the whole server (verified).** The contact-guard regexes are quadratic: a 20,000-character value took 1.5 s on my machine and 100,000 characters takes about 40 s, blocking the single Node process for every user. Any provider can send this in a listing field. Fix: cap string and body sizes, truncate scanned text, bound the regex quantifiers.
7. **`javascript:` links (stored XSS).** Ad links (`ctaHref`), provider website and URL fields accept any scheme and are rendered as links; the session token sits in localStorage. Fix: allow only `/path` and `https://` on the server and when rendering.

### Money
8. **The payment webhook trusts anyone who knows a transaction reference (verified: no auth).** There is no secret, signature or amount check. Anyone who sees a pending reference (it appears on receipts when the gateway sends no network reference, in logs and at the gateway) can POST it and receive credit, tickets, bookings or an unlocked contact for free. Fix: a per-transaction HMAC in the callback URL, amount comparison, store the raw payload. **Caveat:** I don't know whether the gateway preserves query strings on callbacks, so enforcement must be switched on only after one real test payment.
9. **Late or failed-then-successful payments are dropped.** If the gateway call errors after it already accepted (timeout/5xx), or a "failed" callback arrives before a real success, the transaction is marked failed and the later success is ignored: the customer pays and gets nothing. Pending payments are also never expired or reconciled; there are no background jobs at all. Fix: allow failed to upgrade to succeeded, add a periodic sweeper that expires stale pending rows and reconciles.
10. **Payments landing on a cancelled, expired or already-paid order/booking are credited and never refunded.** Provider can cancel a paid order or booking and keep the money in a withdrawable wallet; an expiring booking can be paid after its dates were released; a second prompt after 10 minutes charges twice. There is no refund state at all. Fix: state-aware webhook that flags `refund_due` and does not credit the provider, a minimum refund queue in admin, block cancelling paid items except through it, one-open-payment rule.
11. **Payout approval can pay twice.** Approve reads the status then updates without a conditional claim; two clicks or two admins both pay; reject is allowed while an approval is in flight; a network error after the gateway paid refunds the wallet and marks it rejected. Fix: atomic claim (`updateMany where status=requested`), reject only from requested, an "unknown outcome" state instead of auto-refund.
12. **Withdrawals cannot be approved from the admin app.** The withdrawals data is fetched but no screen shows it, so every payout request would sit untouched with the provider's money debited. Fix: build the Withdrawals queue (approve/reject/mark-paid with confirm, provider phone, note).
13. **Favourites and reviews are broken (verified).** Both endpoints throw `Unknown argument userId_providerId` and return 500 (a unique constraint was removed from the schema but not the code). Fix: restore a unique key and align schema and the hand-written SQL.

### Data and launch hygiene
14. **Demo data is live on production.** The 10 demo bus companies are the only companies on `/bus/parks`, bookable by real customers, ranked first by fake ratings, with public demo logins in the repo and non-zero wallets and pending payouts. The demo marketplace providers and listings are also live, 350 users in total. Real money can flow to demo operators. Fix: reconcile any real bookings on demo operators first, then clear both seeds, remove the demo logins, add an `isDemo` guard or refuse to seed in production.

---

## B. High priority (fix in the first week, or before launch if time allows)

**Money correctness**
- Floating-point drift in wallet balances (verified in SQLite): sums like 179.16999999999996 make an exact full withdrawal fail and can break the platform revenue page. Round after every aggregate and make `parseMoneyToCents` tolerant; longer term store integer amounts.
- Quotation and receipt totals can differ from the amount actually charged (delivery fee, discount, tax never change the order total); receipt prints the quote total, not the payment.
- Admin dashboard "Revenue" sums every succeeded transaction including withdrawals and gross sales, labelled 30 days but all-time; the Reports screen is entirely invented numbers and its CSV exports them; wallets screen totals are wrong at scale; platform ledger hides platform withdrawals because of a NULL filter bug (verified in Prisma behaviour).
- Bus: operators can withdraw immediately, before the trip runs; cancelling after a payout drives the balance negative; platform commission is never reversed on refunds; refunds are manual with no record, no customer email, and the UI mislabels the cause; tickets can be issued after departure; no per-user cap on seat holds (griefing and double prompts).
- Withdrawal fee is charged on top of the sale fee and never credited to the platform; subscriptions are sold but nothing expires or enforces them.

**Privacy / paywall**
- Contact details leak around the unlock fee: instant bookings return phone, address and exact map link and the confirmation email repeats them (book, read, cancel, repeat); quotation and receipt PDFs and emails print the provider's phone and address on any free cash order; public provider descriptions and custom fields are unredacted; favourites return the exact location once fixed.
- The contact guard is easy to evade (`0777/123/456`, full-width digits, "john at gmail dot com", numeric JSON values, object keys) and fails open if the AI call errors; it only covers service listings, not products, provider profiles, ads or category names.
- Exact provider location can be recovered by asking for distance from three points.
- Booking `instructions` (door codes and similar) are published on every public listing response though the form promises "shown once confirmed".

**Abuse and cost**
- `/listings/nearby-map` is unauthenticated and calls the paid AI on every unique search; only a global 120/min per IP limit applies. `/search` loads the whole catalogue into memory per request (1.85 s of blocked server per call at 10k documents). The platform can be used to send email from your domain to any address (buyer-supplied email, unlimited quotation resends). Anonymous contact-unlock can push payment prompts to arbitrary phone numbers. Fix: per-route limits, an AI budget and caching, validate and throttle email.
- Presigned upload URLs have no size or quota limits and any role can mint them.
- Only one global rate limit exists and static files count against it; carrier NAT users will see 429s.

**Operations and UI**
- No error logging at all on the server (500s are silent), and tokens appear in access logs (`morgan` logs full URLs incl. onboarding tokens).
- Single Fly machine with SQLite on one volume: only Fly's 5-day snapshots as backup, no off-site copy; a deploy takes the site down briefly (health check failures seen).
- Order dialog cannot scroll on phones, so "Place order" can be unreachable (CSS: `.modal-card` has no max-height/overflow). Expired sessions leave the UI looking logged in. Cart is silently emptied after any failed load and quantity can't be typed. Delivery orders are blocked if the Maps key fails.
- Admin: Settings page shows placeholder values if loading fails and Save then writes them to production; default contact fee of 0 with contact fee "enabled" locks contacts and makes unlocking fail; admin invite links point at the customer app (`ADMIN_INVITE_BASE_URL` unset); no password reset for admins or bus operators; Subscriptions edits and Users buttons look real but only change local screen state; delete-provider destroys wallet, orders, receipts and bookings.
- Fabricated social proof on the storefront (invented ratings and review counts, "10,000+ happy customers", "24/7 support", "100% satisfaction guarantee"); placeholder images load from a developer-tool image URL.
- No privacy policy or terms anywhere (needed for Google sign-in consent, App Store, Play Store); iOS Google sign-in not configured and Apple requires Sign in with Apple when Google is the only option; quotation/receipt PDFs probably won't open in the native app; the bus QR image is blocked in browsers by a CORP header (verified `same-origin` on production).

---

## C. Wiring status by module

| Module | Wired and working | Notes |
|---|---|---|
| Storefront to API (about 95 calls) | Yes | Fields, methods and shapes match. Failures are in behaviour, not wiring. |
| Services, categories, bookings, order-then-pay | Yes (tested earlier in browser) | See A10, B (paywall leaks). |
| Bus ticketing | Yes (no missing endpoints) | Demo data and money rules are the issues. |
| Admin app | Mostly | Withdrawals, reviews moderation, user suspend, orders, bookings, promotions have no screen; several screens fake data. |
| AI search and AI gate | Yes | Cost and evasion issues above. |
| Email | Yes | Domain verified; failures not retried or surfaced. |
| Mobile apps | Android works; iOS blocked | iOS sign-in config and App Store requirements. |

## D. What is in good shape

Passwords hashed with bcrypt, JWT verification correct, Prisma everywhere (no SQL injection), role and ownership checks correct for orders, bookings, documents, listings and bus operator data, error responses don't leak stack traces, `.env` never committed, AI key encrypted at rest, upload filenames sanitised, signed uploads limited to safe types, database schema script matches the Prisma schema for every table (two missing foreign keys and the favourites constraint aside), all three apps build, production health check and key public endpoints respond (0.8 to 1.2 s from here including network distance), email domain verified, disk 5 GB with encrypted volume, daily snapshots, integrity check "ok".

## E. Ops checklist before launch

- Clear demo data (see A14). Remove demo logins.
- Confirm the mobile money gateway at `hive-sooty-eight.vercel.app` is in live mode and run one real end-to-end payment per type (unlock, subscription, order, booking, bus) before enforcing webhook signatures.
- Set `ADMIN_INVITE_BASE_URL`, `API_BASE_URL` (present), `PUBLIC_SITE_URL`; set `ALLOWED_ORIGINS` (present); remove `SEED_ADMIN_PASSWORD` from Fly secrets after first login; confirm a strong `JWT_SECRET` (the AI key encryption key derives from it, so rotating it drops the saved key).
- Set real fees, or turn the contact fee off, before opening (zero fee plus "enabled" locks contacts).
- Add off-site SQLite backups (a nightly copy of `/data/sidra.db` to R2 or Litestream) and test a restore; plan for a second machine or accept short deploy downtime.
- Restrict the Google Maps key by referrer (add `https://localhost` and `capacitor://localhost` for the apps) and create the Android and iOS OAuth clients.
- Publish privacy policy and terms; add them to Google consent screen and the stores.
- Dependencies: `npm audit` shows one critical (`proxy-addr`, via Express) and several high (`joi`, `body-parser`/`qs` and others in the backend; `vite`, `postcss` and others in the storefront). `npm audit fix` is non-breaking for the backend runtime items.
- Load test: 20 concurrent bus payments on one trip and a burst of bookings (SQLite write contention could surface as 500s).

## F. Suggested order of work

1. **Day 1, small and high value:** permissions on admin routes, delete bootstrap route, reject sub-less tokens, `isActive` checks, cap string sizes in the guard, URL scheme checks, QR header, favourites fix, modal scrolling, strip booking instructions and contact from public/booking/document outputs, `npm audit fix`.
2. **Day 1-2, money safety:** webhook HMAC (log-only first), late-success handling and a stale-pending sweeper, state-aware payment application with `refund_due`, atomic payout claim, withdrawals screen, rounding fixes.
3. **Day 2-3, launch hygiene:** demo data clear with reconciliation, single-use onboarding links and reset action, admin Settings load/fee-default safety, remove or wire the Reports screen and fake dashboard numbers, privacy policy and terms, off-site backups, per-route rate limits and AI budget.
4. **After launch:** integer money storage, refund and escrow workflow for bus and bookings, audit log viewer, review moderation and orders/bookings oversight screens, search and facets performance, code splitting, accessibility and iOS polish.
