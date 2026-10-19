# CRITS Online Shop

The CRITS storefront combines a technology catalogue and real estate listings. The current customer journey is enquiry based: visitors can browse products, build an enquiry basket, and contact CRITS. Online checkout, payment processing, delivery management, and order fulfillment are not configured.

## Run locally

See [Local development](docs/local-development.md) for prerequisites, PostgreSQL setup, Clerk development configuration, and startup commands. The short version is:

1. Copy `.env.example` to `.env.local` and configure local PostgreSQL, media signing, and Clerk development values.
2. Install dependencies with `corepack pnpm install`.
3. Apply the local schema with `corepack pnpm --filter @workspace/db run push`.
4. Start the API and storefront in separate terminals with `corepack pnpm run dev:api` and `corepack pnpm run dev:shop`.
5. Open `http://127.0.0.1:25380`.

## Production

The production stack uses Docker Compose, Caddy for HTTPS, a managed TLS-enabled PostgreSQL database, and a persistent media volume. Start with [Security and operations](docs/security-and-operations.md), [Launch checklist](docs/launch-checklist.md), and [`deploy/production.env.example`](deploy/production.env.example). Production requires live Clerk keys, approved production staff IDs, a remote encrypted Restic repository, a public domain, and a tested recovery process. The preflight checks configuration without printing secret values:

```sh
pnpm run preflight:deploy
```

Database changes must be reviewed and applied through versioned migrations. The `push` command is for local development only.

The production repository includes a restricted Restic container plus a systemd service and daily timer for encrypted database and uploaded-media backups. Configure the private remote repository and credentials first, initialize it once, then install the timer as described in [Security and operations](docs/security-and-operations.md). Rehearse recovery into an isolated environment before launch.

## Repository checks

GitHub Actions installs the locked workspace dependencies and runs the typecheck and production build on pushes and pull requests. It does not access production credentials or deploy the application.

Never commit `.env.local`, `.env.production`, database exports, Restic passwords, or Clerk secret keys. Rotate any secret that is accidentally exposed.
