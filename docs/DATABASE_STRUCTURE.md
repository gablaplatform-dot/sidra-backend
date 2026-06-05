# Sidra Database Structure

This document describes the SQLite/Prisma database structure for Sidra. It focuses on the product goal: connect users to service providers through admin-curated categories, invitation-based provider onboarding, discovery, contact, reviews, ecommerce/orders, and analytics.

Source of truth:

- Prisma schema: `prisma/schema.prisma`
- SQLite sync script: `scripts/sqlite-push.js`
- Database URL example: `DATABASE_URL=file:./dev.db`

## Product Model

Sidra has three main user-facing surfaces:

- Admin dashboard: creates categories, invites providers, moderates data, manages finance/settings.
- User app/web app: Google login, discovers providers, views profiles/products, contacts providers, saves favorites, reviews, orders.
- Provider dashboard/web flow: invited providers complete registration, manage profile/listings/orders/leads/wallet.

The system is not primarily a marketplace. It is a service discovery and contact platform, with ecommerce and payments available for categories/providers that need them.

## Core Flow

1. Admin creates categories.
2. Each category has a `behavior` and `appView`.
3. Admin creates a provider invitation by entering provider/company name, email, and category.
4. Backend creates:
   - a provider user
   - a provider profile
   - a provider invitation
   - an onboarding token/link
5. Resend can email the link when configured.
6. Provider completes registration from the link.
7. Provider becomes visible after approval/full registration.
8. Users discover provider through category/search.
9. App tracks profile visits, contact clicks, searches, favorites, reviews, inquiries, orders, and payments.

## Category View Types

Categories control how providers are shown in the app.

Important category columns:

- `behavior`: business family/type.
- `viewType`: app UI template.
- `appView`: app UI template alias used by clients.
- `providerFields`: JSON field schema for provider profile.
- `listingFields`: JSON field schema for products/services/listings.
- `settings`: JSON category-specific display/config settings.

Current supported examples:

- `directory`: general service provider list/profile.
- `professional`: doctors, lawyers, consultants.
- `hotel`: hotel/lodge/guesthouse profile.
- `ecommerce`: online shops with products.
- `restaurant`: menus/food providers.
- `real_estate`: property agents/listings.
- `school`: schools/training institutions.
- `event_vendor`: event service providers.
- `portfolio`: creatives/artisans.
- `booking`: appointment-driven providers.

Suggested future category behaviors:

- `doctor`
- `hotel`
- `online_shop`
- `restaurant`
- `real_estate`
- `school`
- `event_vendor`
- `auto`
- `beauty`
- `legal`
- `fitness`
- `general`

## Table Groups

### Identity And Access

#### `users`

Stores all accounts: end users, providers, and admins.

Key columns:

- `id`: primary key.
- `name`: display name.
- `email`: unique email.
- `phone`: unique phone, can be added later.
- `passwordHash`: password hash. Empty for Google-only users.
- `authProvider`: `password`, `google`, or future auth provider.
- `googleSub`: unique Google subject ID.
- `avatarUrl`: profile image from Google or uploaded media.
- `profile`: JSON extra user details.
- `role`: `user`, `provider`, or `admin`.
- `isActive`: account status.
- `adminPermissions`: JSON permission list for admins.
- `createdAt`, `updatedAt`: timestamps.

Relationships:

- One user can own one `provider`.
- One user can have many `transactions`.
- One user can create many `favorites`, `reviews`, `inquiries`, `orders`, `profile_visits`, `contact_events`, `search_events`.
- Admin users can appear as actors in `audit_logs` and withdrawal approval fields.

Google login:

- User app should call `/api/v1/auth/google` with a Google ID token.
- Backend creates/fetches a `users` row with `authProvider = google`.
- User can later update phone/profile via `/api/v1/auth/me`.

### Categories And App Views

#### `categories`

Admin-defined category tree. These categories appear in the app.

Key columns:

- `id`: primary key.
- `name`: category name.
- `parentId`: optional parent category.
- `behavior`: provider business family.
- `viewType`: app display template.
- `appView`: app display template used by the frontend/app.
- `providerFields`: JSON schema for provider-specific profile fields.
- `listingFields`: JSON schema for listing/product/service fields.
- `settings`: JSON settings for view behavior.
- `sortOrder`: ordering.
- `isActive`: category visibility.
- `createdAt`, `updatedAt`.

Relationships:

- A category can have child categories.
- A category can have many `providers`.

Example:

- Category: Hotels
- `behavior = hotel`
- `appView = hotel`
- `providerFields`: amenities, check-in/out, room types.
- `listingFields`: room, rate, capacity.

### Provider Onboarding And Profiles

#### `providers`

Stores service provider/business profiles.

Key columns:

- `id`: primary key.
- `userId`: owner user.
- `businessName`: company/provider name.
- `publicSlug`: public app/web slug.
- `description`: profile description.
- `categoryId`: assigned category.
- `contact`: JSON phone/WhatsApp/email/website.
- `media`: JSON avatar, cover, gallery.
- `customFields`: JSON values from category `providerFields`.
- `location`: JSON address/city/geo.
- `isApproved`: public visibility approval flag.
- `moderationStatus`: `pending`, `approved`, `rejected`, `suspended`.
- `onboardingStatus`: `draft`, `invitation_sent`, `registered`, etc.
- `invitationSentAt`: last invitation send timestamp.
- `invitationAcceptedAt`: invitation accepted timestamp.
- `registeredAt`: provider completed registration timestamp.
- `ratingAvg`, `ratingCount`: review summary.
- `profileViews`: cached visit count.
- `contactClicks`: cached contact click count.
- `subscriptionStatus`: provider subscription state.
- `walletEnabled`: internal wallet enabled flag.
- `settingsOverrides`: JSON provider-specific finance/settings overrides.
- `availability`: JSON schedule/availability.
- `verification`: JSON verification metadata.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to one `user`.
- Belongs to one `category`.
- Has many `service_products`, `transactions`, `subscriptions`, `withdrawal_requests`, `favorites`, `reviews`, `profile_visits`, `contact_events`, `inquiries`, `media_assets`, `orders`, `provider_invitations`.
- Has one `wallet`.

#### `provider_invitations`

Tracks admin-created provider onboarding invitations and resend state.

Key columns:

- `id`: primary key.
- `providerId`: provider being invited.
- `email`: invite destination.
- `tokenHash`: hash of onboarding token.
- `status`: `sent`, `accepted`, future `expired`/`failed`.
- `sentAt`: first send time.
- `resentCount`: number of resends.
- `lastSentAt`: last send time.
- `acceptedAt`: accepted time.
- `expiresAt`: link expiry.
- `metadata`: JSON delivery provider/status/response.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to one `provider`.

Resend email flow:

- Admin creates provider.
- Backend creates invitation and token.
- If `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured, backend sends email.
- Admin can resend via provider route.
- Delivery metadata is stored in `metadata`.

### Listings, Products, Services

#### `service_products`

Stores both services and products. The category app view decides how clients display them.

Key columns:

- `id`: primary key.
- `providerId`: owner provider.
- `name`: service/product name.
- `description`: description.
- `price`: price.
- `type`: `service` or `product`.
- `status`: `pending`, `approved`, `suspended`.
- `featured`: featured flag.
- `media`: JSON image/gallery.
- `customFields`: JSON values from category `listingFields`.
- `inventory`: optional stock quantity.
- `sku`: optional shop SKU.
- `availability`: JSON availability/booking data.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to one `provider`.
- Can appear in many `order_items`.

Examples:

- Ecommerce category: listings are products.
- Doctor category: listings may be consultation/service types.
- Hotel category: listings may be rooms/packages.

### Discovery And Analytics

#### `profile_visits`

Tracks provider profile views.

Key columns:

- `id`: primary key.
- `providerId`: visited provider.
- `userId`: optional signed-in user.
- `source`: source screen/campaign.
- `sessionId`: anonymous/user session ID.
- `ipHash`: optional privacy-safe IP hash.
- `userAgent`: request user agent.
- `metadata`: JSON extra context.
- `createdAt`.

Relationships:

- Belongs to one `provider`.
- Optionally belongs to one `user`.

Used for:

- Most visited providers.
- Provider analytics dashboard.
- Ranking/quality insights.

#### `contact_events`

Tracks contact actions such as call, WhatsApp, email, website, directions.

Key columns:

- `id`: primary key.
- `providerId`: contacted provider.
- `userId`: optional user.
- `type`: `call`, `whatsapp`, `email`, `website`, `directions`.
- `value`: contact value used.
- `paid`: whether contact was paid/unlocked.
- `source`: source screen.
- `sessionId`: session ID.
- `metadata`: JSON extra context.
- `createdAt`.

Relationships:

- Belongs to one `provider`.
- Optionally belongs to one `user`.

Used for:

- Contact conversion metrics.
- Provider dashboard leads.
- Admin reports.

#### `search_events`

Tracks app search behavior.

Key columns:

- `id`: primary key.
- `userId`: optional user.
- `query`: search text.
- `categoryId`: selected category.
- `filters`: JSON filters used.
- `resultCount`: number of returned results.
- `sessionId`: session ID.
- `createdAt`.

Relationships:

- Optionally belongs to one `user`.

Used for:

- Search analytics.
- Demand insights.
- Missing categories/services.

### User Engagement

#### `favorites`

Stores saved providers for users.

Key columns:

- `id`: primary key.
- `userId`: user saving provider.
- `providerId`: saved provider.
- `createdAt`.

Relationships:

- Belongs to `user`.
- Belongs to `provider`.
- Unique pair: `userId + providerId`.

#### `reviews`

Stores provider reviews.

Key columns:

- `id`: primary key.
- `userId`: reviewer.
- `providerId`: reviewed provider.
- `rating`: integer rating.
- `comment`: text comment.
- `status`: `pending`, `approved`, `rejected`, `archived`.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to `user`.
- Belongs to `provider`.
- Unique pair: `userId + providerId`.

Provider rating summary:

- `providers.ratingAvg`
- `providers.ratingCount`

These are recomputed when admin moderates reviews.

#### `inquiries`

Stores user leads/messages to providers.

Key columns:

- `id`: primary key.
- `userId`: optional signed-in user.
- `providerId`: provider receiving inquiry.
- `listingId`: optional listing/product/service.
- `type`: inquiry type.
- `status`: `new`, `open`, `closed`, `archived`.
- `name`, `email`, `phone`: contact details.
- `message`: inquiry message.
- `metadata`: JSON extra context.
- `createdAt`, `updatedAt`.

Relationships:

- Optionally belongs to `user`.
- Belongs to `provider`.

### Orders And Ecommerce

#### `orders`

Stores ecommerce/order requests.

Key columns:

- `id`: primary key.
- `userId`: optional buyer user.
- `providerId`: seller/provider.
- `transactionId`: optional linked payment transaction.
- `status`: `pending`, `accepted`, `fulfilled`, `canceled`, `rejected`.
- `subtotal`, `fee`, `total`: money fields.
- `customer`: JSON customer details.
- `fulfillment`: JSON delivery/pickup details.
- `metadata`: JSON extra context.
- `createdAt`, `updatedAt`.

Relationships:

- Optionally belongs to `user`.
- Belongs to `provider`.
- Optionally belongs to `transaction`.
- Has many `order_items`.

#### `order_items`

Stores order line items.

Key columns:

- `id`: primary key.
- `orderId`: parent order.
- `listingId`: optional service/product.
- `name`: item name snapshot.
- `quantity`: quantity.
- `unitPrice`: unit price snapshot.
- `total`: line total.
- `metadata`: JSON extra context.

Relationships:

- Belongs to `order`.
- Optionally belongs to `service_products`.

### Payments, Wallets, Subscriptions

#### `transactions`

Stores all money movement.

Key columns:

- `id`: primary key.
- `type`: `subscription`, `contact_unlock`, `purchase`, `withdrawal`.
- `status`: `pending`, `succeeded`, `failed`, `canceled`, `refunded`.
- `userId`: optional user.
- `providerId`: optional provider.
- `amount`: gross amount.
- `fee`: platform fee.
- `netAmount`: provider net amount.
- `metadata`: JSON payment details.
- `reference`: external payment reference.
- `createdAt`, `updatedAt`.

Relationships:

- Optionally belongs to `user`.
- Optionally belongs to `provider`.
- Can have one `withdrawal_request`.
- Can have one `order`.

#### `wallets`

Stores provider wallet balances.

Key columns:

- `id`: primary key.
- `providerId`: unique provider.
- `balance`: available balance.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to one `provider`.

#### `withdrawal_requests`

Stores provider withdrawal requests.

Key columns:

- `id`: primary key.
- `providerId`: provider requesting withdrawal.
- `amount`, `fee`, `netAmount`.
- `status`: `requested`, `approved`, `rejected`, `paid`.
- `transactionId`: linked transaction.
- `requestedBy`, `approvedBy`, `rejectedBy`, `paidBy`: user/admin IDs.
- `approvedAt`, `rejectedAt`, `paidAt`.
- `note`.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to `provider`.
- Belongs to `transaction`.
- References users/admins for workflow actions.

#### `subscriptions`

Stores provider subscriptions.

Key columns:

- `id`: primary key.
- `providerId`: provider.
- `amount`: subscription amount.
- `expiresAt`: expiry time.
- `status`: `pending`, `active`, `expired`, `canceled`.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to `provider`.

#### `contact_unlocks`

Tracks paid access to provider contact details.

Key columns:

- `id`: primary key.
- `userId`: user who unlocked.
- `providerId`: provider unlocked.
- `paid`: paid flag.
- `createdAt`, `updatedAt`.

Relationships:

- Belongs to `user`.
- Belongs to `provider`.
- Unique pair: `userId + providerId`.

### Media And Files

#### `media_assets`

Stores uploaded media metadata after R2 upload.

Key columns:

- `id`: primary key.
- `providerId`: optional related provider.
- `ownerId`: uploader user/admin/provider ID.
- `key`: R2 object key.
- `url`: public URL.
- `mimeType`: file MIME type.
- `size`: file size.
- `kind`: `image`, `video`, etc.
- `metadata`: JSON extra context.
- `createdAt`.

Relationships:

- Optionally belongs to `provider`.

Upload flow:

1. Client requests `/storage/upload-url`.
2. Client uploads to R2.
3. Client calls `/storage/assets` to register metadata.
4. Admin media screen reads `media_assets`.

### Admin And System

#### `admin_settings`

Stores platform-wide feature and finance settings.

Key columns:

- `id`: primary key.
- `enableSubscription`
- `enableContactFee`
- `enableWallet`
- `enableEcommerce`
- `subscriptionFee`
- `contactFee`
- `transactionFeePercent`
- `minimumWithdrawalAmount`
- `platformName`
- `supportEmail`
- `supportPhone`
- `featureFlags`: JSON settings for email templates/security/other flags.
- `createdAt`, `updatedAt`.

Used by:

- Payment service.
- Provider effective settings.
- Admin settings screen.

#### `audit_logs`

Stores admin/system activity records.

Key columns:

- `id`: primary key.
- `actorId`: optional user/admin actor.
- `action`: action name.
- `entity`: entity/table/module.
- `entityId`: affected record.
- `metadata`: JSON context.
- `createdAt`.

Relationships:

- Optionally belongs to actor `user`.

## Important Relationships Summary

```text
users 1--1 providers
categories 1--many providers
categories 1--many categories children
providers 1--many provider_invitations
providers 1--many service_products
providers 1--many profile_visits
providers 1--many contact_events
providers 1--many reviews
providers 1--many favorites
providers 1--many inquiries
providers 1--many orders
providers 1--1 wallets
providers 1--many subscriptions
providers 1--many withdrawal_requests

users 1--many favorites
users 1--many reviews
users 1--many orders
users 1--many transactions
users 1--many profile_visits
users 1--many contact_events
users 1--many search_events

orders 1--many order_items
service_products 1--many order_items
transactions 1--0/1 orders
transactions 1--0/1 withdrawal_requests
```

## Visibility Rules

A provider should appear in the app when:

- `isApproved = true`
- `moderationStatus = approved`
- `onboardingStatus = registered`
- assigned category is active

Categories should appear when:

- `isActive = true`

Listings/products should appear when:

- provider is visible
- listing `status = approved`

## Ranking And Most Visited

Most visited provider data comes from:

- `providers.profileViews`
- `profile_visits` detailed event records

Most contacted provider data comes from:

- `providers.contactClicks`
- `contact_events` detailed event records

Recommended ranking inputs:

- category match
- search text relevance
- `featured`
- `ratingAvg`
- `ratingCount`
- `profileViews`
- `contactClicks`
- location proximity
- provider subscription/plan, if enabled

## Environment Variables

Important DB/auth/email variables:

```env
DATABASE_URL=file:./dev.db
JWT_SECRET=change_me
GOOGLE_CLIENT_ID=
APP_BASE_URL=http://localhost:5173
PROVIDER_ONBOARDING_BASE_URL=http://localhost:5173/provider/onboarding
RESEND_API_KEY=
RESEND_FROM_EMAIL=Sidra <onboarding@sidra.com>
```

Default admin:

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=Admin
SEED_ADMIN_PHONE=
```

## Commands

Because the local Prisma SQLite schema engine currently fails with a blank error, this project uses a custom SQLite sync command:

```bash
npm run db:push
npm run db:generate
npm run db:seed
```

Combined:

```bash
npm run db:setup
```

Validation:

```bash
DATABASE_URL=file:./dev.db npx prisma validate
npm run lint
```

## Notes For App Development

User app:

- Use Google login first.
- Ask for phone/profile details later via `/auth/me`.
- Fetch categories, then render by `appView`.
- Record searches with `search_events`.
- Record provider profile opens with `profile_visits`.
- Record contact clicks with `contact_events`.

Provider dashboard:

- Provider enters through invitation link.
- Complete profile and category-specific fields.
- Manage listings/products based on category `appView`.
- View leads/inquiries, orders, visits, contacts, wallet.

Admin dashboard:

- Create categories and choose `appView`.
- Create provider invitation.
- Resend invitation email.
- Moderate provider/listing/review.
- Track visits/contact/reporting.
