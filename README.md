# CRITS Online Shop

[![Build and typecheck](https://github.com/richards23-del/CRITS-Online-Shop/actions/workflows/ci.yml/badge.svg)](https://github.com/richards23-del/CRITS-Online-Shop/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

CRITS Online Shop is a business storefront combining a technology catalogue with real-estate listings. Its current customer journey is **enquiry-based**: visitors browse listings, build an enquiry basket, and contact CRITS. It does not currently provide online checkout, payment processing, delivery management, or order fulfilment.

## Project overview

- **Application:** TypeScript workspace with a storefront and API
- **Database:** PostgreSQL
- **Authentication:** Clerk
- **Deployment:** Docker Compose with Caddy for HTTPS
- **Operations:** Environment preflight checks and documented encrypted backup/recovery procedures
- **CI:** GitHub Actions runs the locked dependency install, typecheck, and production build on pushes and pull requests

## Run locally

See [Local development](docs/local-development.md) for full prerequisites and configuration.

1. Copy `.env.example` to `.env.local` and configure local PostgreSQL, media signing, and Clerk development values.
2. Install locked workspace dependencies:

   ```sh
   corepack pnpm install
   ```

3. Apply the local schema:

   ```sh
   corepack pnpm --filter @workspace/db run push
   ```

4. Start the API and storefront in separate terminals:

   ```sh
   corepack pnpm run dev:api
   corepack pnpm run dev:shop
   ```

5. Open [http://127.0.0.1:25380](http://127.0.0.1:25380).

## Production readiness

Production uses Docker Compose, Caddy for HTTPS, a managed TLS-enabled PostgreSQL database, and persistent media storage. Start with:

- [Security and operations](docs/security-and-operations.md)
- [Launch checklist](docs/launch-checklist.md)
- [Production environment template](deploy/production.env.example)

Run the configuration preflight before deployment:

```sh
pnpm run preflight:deploy
```

Production requires live Clerk keys, approved production staff IDs, a remote encrypted Restic repository, a public domain, and a tested recovery process. Database changes must be reviewed and applied through versioned migrations; the schema `push` command is for local development only.

## Security basics

- Never commit `.env.local`, `.env.production`, database exports, Restic passwords, or Clerk secret keys.
- Keep production credentials in protected deployment secrets.
- Rotate any credential accidentally exposed in a commit, even if the commit is later removed.
- Rehearse backup restoration into an isolated environment before launch.
- Do not treat a successful build as proof that production configuration, authentication, or recovery procedures have been fully validated.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes and use [SECURITY.md](SECURITY.md) to report a potential vulnerability responsibly.
