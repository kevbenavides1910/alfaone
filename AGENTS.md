# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Single **Next.js 15 monolith** ("Alfa One", package `alfa-one`) using **Prisma + PostgreSQL**, App Router, NextAuth. Business modules live under `src/modules/*` (core, presupuestos, disciplinario, inventario, plataforma). The top-level `facturacion_cr/` folder is a separate Frappe project and is **not** part of the Next.js app — ignore it for normal dev.

General dev docs: `docs/LOCAL-DEV.md`, `SETUP.md`. Standard scripts live in `package.json`.

### Services & how to run them
Only one service to run for dev: the Next.js app plus a PostgreSQL database.

- **Database**: PostgreSQL runs **natively** (not Docker) on `localhost:5432`, database `security_contracts`, user/pass `postgres`/`postgres`. It is **not** the docker-compose port 5433. `.env` and `.env.local` are already configured for this. Postgres does not auto-start on a fresh VM boot — start it each session with:
  ```bash
  sudo pg_ctlcluster 16 main start   # no-op/error-safe if already running; verify with: sudo pg_lsclusters
  ```
- **App (dev)**: `npm run dev` → http://localhost:3000. Login: `admin@seguridadgrupocr.com` / `admin123` (seeded).
- **Migrations**: `npx prisma migrate deploy` (already applied in the snapshot). This is a production-real codebase — see `.cursor/rules/produccion-proteger-bd.mdc`; never run destructive Prisma commands (`migrate reset`, `db push --force-reset`, etc.).

### Non-obvious gotchas
- **Seeding under Node 22**: `npm run db:seed` fails with `Unknown file extension ".ts"` because the plain script omits the CommonJS ts-node flag. Use `npx prisma db seed` or `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts`. The DB is already seeded in the snapshot; re-seed only if you reset it.
- **`npm run lint` is broken repo-wide**: `next lint` prompts to create an ESLint config because **no ESLint config is committed**. It exits non-zero non-interactively and this same failure reproduces in GitHub CI — it is a pre-existing repo issue, not an environment problem. Do not add a config unless the task asks for it.
- **`npm run build` works** and is the meaningful CI compile check (`next build`).
