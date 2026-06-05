# Sidra Hosting Plan

## Recommended MVP Setup

Use Cloudflare for the admin dashboard and static app assets, and host the backend API on Fly.io in Johannesburg.

This keeps the API and SQLite database close to Uganda while preserving the current Express + Prisma codebase.

## Why Fly.io for the Backend

- Region `jnb` is Johannesburg, South Africa, which is usually the closest practical cloud region to Uganda.
- The backend can run as the existing Node/Express API with no framework rewrite.
- A persistent Fly volume can hold the SQLite database at `/data/sidra.db`.
- The admin dashboard can keep running on Cloudflare and call the Fly API.

## Production Caveat

SQLite is acceptable for a fast MVP, but Sidra's long-term production database should be Postgres once traffic grows. The app records many writes: profile visits, contact clicks, reviews, inquiries, orders, media records, wallet records, and provider updates.

Recommended evolution:

1. Launch MVP with Fly.io Johannesburg + SQLite volume.
2. Add backups for `/data/sidra.db`.
3. Move to Postgres before heavy production traffic or multi-region API scaling.

## Backend Environment Variables

Set these on the backend host:

```bash
DATABASE_URL=file:/data/sidra.db
JWT_SECRET=<strong-secret>
JWT_ISSUER=sidra
JWT_ACCESS_TTL_SECONDS=3600
ALLOWED_ORIGINS=https://<admin-cloudflare-domain>,https://<app-domain>
APP_BASE_URL=https://<app-domain>
PROVIDER_ONBOARDING_BASE_URL=https://<app-domain>/provider/onboarding
GOOGLE_CLIENT_ID=<google-client-id>
RESEND_API_KEY=<resend-key>
RESEND_FROM_EMAIL=Sidra <onboarding@your-domain>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET=sidra
R2_PUBLIC_BASE_URL=https://<cdn-domain>
SEED_ADMIN_EMAIL=<admin-email>
SEED_ADMIN_PASSWORD=<strong-admin-password>
SEED_ADMIN_NAME=Admin
```

## Fly.io Deployment Commands

Install and sign in to Fly.io, then run:

```bash
fly launch --no-deploy
fly volumes create sidra_data --region jnb --size 5
fly secrets set JWT_SECRET="<strong-secret>"
fly secrets set ALLOWED_ORIGINS="https://<admin-cloudflare-domain>,https://<app-domain>"
fly secrets set APP_BASE_URL="https://<app-domain>"
fly secrets set PROVIDER_ONBOARDING_BASE_URL="https://<app-domain>/provider/onboarding"
fly secrets set GOOGLE_CLIENT_ID="<google-client-id>"
fly secrets set RESEND_API_KEY="<resend-key>"
fly secrets set RESEND_FROM_EMAIL="Sidra <onboarding@your-domain>"
fly secrets set R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
fly secrets set R2_ACCESS_KEY_ID="<r2-access-key>"
fly secrets set R2_SECRET_ACCESS_KEY="<r2-secret>"
fly secrets set R2_BUCKET="sidra"
fly secrets set R2_PUBLIC_BASE_URL="https://<cdn-domain>"
fly secrets set SEED_ADMIN_EMAIL="<admin-email>"
fly secrets set SEED_ADMIN_PASSWORD="<strong-admin-password>"
fly deploy
```

After deployment:

```bash
curl https://sidra-api.fly.dev/health
```

Expected response:

```json
{"ok":true,"service":"sidra-backend"}
```

## Admin Dashboard Wiring

The admin dashboard already reads:

```bash
VITE_API_URL
```

Set the Cloudflare Pages production variable to:

```bash
VITE_API_URL=https://sidra-api.fly.dev/api/v1
```

Then redeploy the admin dashboard from Cloudflare.

## Cloudflare R2

Use R2 for provider images, galleries, product photos, documents, and videos. The backend already supports signed upload URLs and media registration.

Recommended bucket:

```bash
sidra
```

Recommended public URL:

```bash
https://cdn.<your-domain>
```

## Scaling Notes

For high traffic, do not scale the SQLite version horizontally with multiple writers. Use one API machine with a persistent volume until Postgres is added.

When Sidra is ready for heavier load:

- Change Prisma datasource to Postgres.
- Move `DATABASE_URL` to managed Postgres.
- Run real Prisma migrations.
- Scale API machines horizontally.
- Keep R2 for media.
- Keep Cloudflare in front for caching, TLS, and static delivery.
