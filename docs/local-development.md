# Local development

CRITS runs as a Vite storefront, an Express API, and PostgreSQL. The API and storefront bind to loopback by default. Product images are saved under `var/product-images`; PostgreSQL data persists independently of the app processes.

## Requirements

- Node.js 20.19 or newer and Corepack
- pnpm 10 (the workspace pins the exact version)
- PostgreSQL 15 or newer, running on a loopback-only port

On Windows, use the included `compose.yaml` with Docker Desktop or install PostgreSQL from the official PostgreSQL installer. The Compose service binds only to `127.0.0.1:5433` by default, avoiding conflict with an existing local PostgreSQL server on `5432`, and keeps its data in a named volume. The setup script generates unique database and media-signing secrets in `.env.local` and can start PostgreSQL and apply the schema:

```powershell
.\scripts\setup-local.ps1 -StartDatabase
```

The script will not overwrite an existing `.env.local`. Do not expose the database port to the internet.

Install workspace dependencies from the repository root:

```powershell
corepack pnpm install
```

For a native PostgreSQL install, create a database and a dedicated login role for the app. Do not use the `postgres` superuser as the application login. With `psql` connected as the local database administrator, run these statements separately:

```sql
CREATE ROLE crits_app LOGIN PASSWORD 'a unique random password';
CREATE DATABASE crits_db OWNER crits_app;
```

Then connect to `crits_db` and grant the role ownership of its schema:

```sql
ALTER SCHEMA public OWNER TO crits_app;
```

## Configure local settings

The setup script creates `.env.local` with a dedicated app database role and strong random local secrets. If you create the file manually, set `DATABASE_URL` to the `crits_app` database connection and `MEDIA_UPLOAD_SIGNING_KEY` to a random secret of at least 32 bytes. Keep `.env.local` private; Git ignores it.

For staff access, create a development instance in the Clerk Dashboard and copy its development publishable key (`pk_test_…`) into both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_PUBLISHABLE_KEY`. Put the matching development secret key (`sk_test_…`) in `CLERK_SECRET_KEY` only. See [Clerk's development key setup](https://clerk.com/docs/guides/development/clerk-environment-variables). Do not place the secret key in a `VITE_` variable or commit it.

Have the designated staff member register through the configured sign-in page, then copy their Clerk user ID from the Clerk Dashboard into `CRITS_ADMIN_USER_IDS`. Multiple approved staff IDs can be comma separated. Admin API access is denied until both keys and at least one approved user ID are configured. Do not substitute an email address for a user ID.

## Start the system

Apply the database schema:

```powershell
corepack pnpm --filter @workspace/db run push
```

Start the API and storefront in separate PowerShell windows from the repository root:

```powershell
corepack pnpm run dev:api
```

```powershell
corepack pnpm run dev:shop
```

Open `http://127.0.0.1:25380`. The storefront proxies `/api` to the API on `127.0.0.1:8080`. `/api/healthz` reports ready only when PostgreSQL and the required CRITS tables are available. The catalogue starts empty; add and review products through `/admin` after Clerk is configured.

To load the current CRITS Jiji snapshot into the local catalogue, run:

```powershell
corepack pnpm run catalogue:import-jiji
```

This idempotently upserts the individually verified listings in `scripts/import-jiji-crits.mjs`, including their source links, prices, categories and available listing photos. The storefront uses 12 listings per page; each catalogue page is addressable with the `?page=` query parameter.

Stop the app processes with Ctrl+C. Keep the database bound to loopback. Do not expose Vite's development server or PostgreSQL directly to the internet.

## Production deployment

The repository includes a Docker deployment for a single app instance behind Caddy. It serves the storefront and API on one HTTPS origin, uses a managed PostgreSQL database, and stores images on a persistent Docker volume.

1. Provision a server with Docker Compose, a public domain, and a managed PostgreSQL database with TLS and encrypted backups. Point DNS to the server and allow inbound ports 80 and 443.
2. Create a Clerk Production instance for the final domain. Invite approved staff in that instance and allowlist their production Clerk user IDs; development account IDs do not transfer.
3. Copy `deploy/production.env.example` to `.env.production`, replace every example value, and keep it private. Use the host's secret manager when available.
4. Run `corepack pnpm run preflight:deploy`. It validates production settings without displaying secret values.
5. Review `lib/db/migrations`, then apply reviewed database changes once:

   ```powershell
   docker-compose --env-file .env.production -f compose.production.yaml --profile operations run --rm migrate
   ```

6. Build and start the site:

   ```powershell
   docker-compose --env-file .env.production -f compose.production.yaml up --build -d
   ```

7. Confirm `/api/healthz` is ready, test public and approved-staff workflows, and verify separate database and media backup/restore procedures.

The production preflight requires live Clerk keys, a TLS-enabled PostgreSQL URL, an absolute writable media directory, one or more production Clerk user IDs, the exact HTTPS origin, and the trusted proxy count. The included Compose stack keeps the API private behind Caddy and persists images in the `crits_media` volume. Back up that volume off-host and keep the app at one instance until media is moved to shared object storage.

Read [security-and-operations.md](security-and-operations.md) and [launch-checklist.md](launch-checklist.md) before launch. `drizzle-kit push` is for local development; use reviewed migrations in production.
