# Gabla Project

Gabla backend, public website, admin interface, customer Flutter app, and driver Flutter app in one repository.

## Applications

| Folder | Application |
| --- | --- |
| `src/`, `prisma/` | Express + Prisma API |
| `public_app/` | Public customer website |
| `admin_ui/` | Admin website |
| `gabla_mobile/` | Native Flutter customer app with Riverpod |
| `driver_app/` | Flutter driver app |
| `mobile_app/` | Previous Capacitor mobile app |

These are regular source folders: cloning this repository includes their source without initializing submodules. Separate app repositories remain available; their Git metadata is local and excluded here.

See [Flutter setup](gabla_mobile/README.md), [native Maps configuration](gabla_mobile/docs/NATIVE_MAPS.md), and [driver setup](driver_app/README.md).

Dependencies, APKs, build output, signing keys, and local credentials are excluded. The latest test APK is available at [gogabla.com/get-app](https://gogabla.com/get-app).

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
