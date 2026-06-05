# Sidra Backend

Express + Prisma backend for the Sidra service discovery platform.

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

## Production

The backend is currently deployed on Fly.io with a persistent SQLite volume. See:

- `docs/HOSTING.md`
- `docs/DATABASE_STRUCTURE.md`
