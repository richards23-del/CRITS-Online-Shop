# Security and operations

## Application and access

- The React/Vite storefront and Express API can be served from one origin. In production, the API serves the built storefront and Caddy terminates HTTPS in front of it.
- PostgreSQL stores products, categories, enquiries, enquiry items, analytics, and privacy settings. New installations start without catalogue records.
- Clerk staff access requires a verified session and an exact Clerk user ID in `CRITS_ADMIN_USER_IDS`. Production startup fails closed when required keys, approved staff IDs, HTTPS origin, trusted proxy count, or writable media storage are missing.
- Use a Clerk Production instance and `pk_live_...` / `sk_live_...` keys for production. Development users do not transfer to the Production instance; create/invite production staff and allowlist their production user IDs.
- `CLERK_SECRET_KEY` remains server-side. The matching publishable key is public and is embedded in the Vite storefront as `VITE_CLERK_PUBLISHABLE_KEY`.
- Clerk session verification restricts authorized parties to `APP_ORIGIN`. Admin write requests also require the configured same origin.
- Admin IDs must be Clerk user IDs, never email addresses. Restrict sign-up or issue staff invitations through Clerk before launch.

## Production deployment outside Replit

The included deployment uses Docker, a managed PostgreSQL service, one API container, a persistent media volume, and Caddy for automatic HTTPS. The API port is private to the Compose network; only Caddy exposes ports 80 and 443.

1. Provision a domain, a TLS-enabled managed PostgreSQL database, and an encrypted database backup policy. Point the domain's DNS to the Docker host and allow inbound ports 80 and 443.
2. Copy `deploy/production.env.example` to `.env.production`. Replace every placeholder; keep this file out of Git. Prefer a deployment secret manager.
3. Create the Clerk Production instance, configure the domain and allowed sign-in methods, issue/invite the approved staff accounts, and add their production user IDs to the environment file. Development account IDs do not work in Production.
4. Run `pnpm run preflight:deploy`. It checks required values, Clerk key prefixes and consistency, the database TLS mode, admin ID shape, origin/domain match, proxy count, and absolute media path without printing secret values.
5. Review migrations under `lib/db/migrations`. The initial migration creates a fresh schema; if the target database already has CRITS tables or data, stop and plan a backed-up schema/data adoption instead. For a clean database, apply the migration once with `docker-compose --env-file .env.production -f compose.production.yaml --profile operations run --rm migrate`.
6. Deploy with `docker-compose --env-file .env.production -f compose.production.yaml up --build -d`.
7. Confirm the API health check is ready, sign in with an approved production account, check the storefront and admin workflows, then confirm the backup and media restore procedures.

The API must stay at one instance while it uses the local media volume. The named `crits_media` volume is durable across container rebuilds but is not an off-host backup. Arrange a separate encrypted, off-host backup for product images and test restoring it. For horizontal scaling, replace filesystem media with shared managed object storage before adding API instances.

`TRUST_PROXY_HOPS` must equal the number of trusted reverse proxies. The included Caddy service is one hop. Do not publish port 8080, trust client-supplied forwarding headers, or expose PostgreSQL publicly. Production requires `sslmode=require`, `verify-ca`, or `verify-full` in the database connection URL.

`pnpm --filter @workspace/db run push` is for local development only. Review and apply versioned migrations for production; never run a schema push against the live database.

## Local staff setup

1. Create a Clerk development instance and set `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` in `.env.local`.
2. Restrict development sign-up or invite only designated staff accounts.
3. Have a staff member sign in and copy that account's Clerk user ID from the Clerk Dashboard.
4. Add the exact ID to `CRITS_ADMIN_USER_IDS`; separate multiple IDs with commas.
5. Restart the API and check `/admin`. Verify an unlisted account cannot read staff data or make changes.

Never commit `.env.local` or `.env.production`, add secrets to documentation, or paste a Clerk secret key or database password into chat. Rotate any secret that is accidentally exposed.

## Contact, enquiries, and privacy

- Public contact details are currently in the storefront source. Confirm them with CRITS before launch. `VITE_CRITS_WHATSAPP` can override or hide the WhatsApp links.
- Enquiry submission is validated by the API, checks selected products against the published catalogue, uses a honeypot, and is rate limited to five submissions per IP in 15 minutes.
- Enquiry records are available only through allowlisted admin routes. Follow-up is manual; email and SMS notifications are not configured.
- Retention is unset by default. Staff can configure a period under **Admin → Privacy settings**. Saving a period deletes older enquiries; deletion cannot be reversed by turning retention off.
- CRITS must approve the privacy notice, retention period, and applicable Ugandan privacy requirements before launch.

## Catalogue and product media

- Add only CRITS-approved catalogue records. CSV imports create drafts or archived records; publish each product after review.
- Product source URLs and verification dates can be stored with records.
- Uploaded product images are public. Do not upload customer documents or private files through the catalogue workflow.
- Confirm CRITS has rights to each image and description. The Jiji public page is not an approved export interface; do not scrape or reuse listing content without permission.
- Back up database and media separately. A database dump does not contain product images.

## Backups and recovery

Use a trusted shell connected to the managed database to create a compressed backup:

```sh
pg_dump "$DATABASE_URL" --format=custom --file="crits-db-$(date +%F).dump"
pg_restore --list "crits-db-YYYY-MM-DD.dump"
```

Restore only to a verified non-production target first and retain a separate current backup:

```sh
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" "crits-db-YYYY-MM-DD.dump"
```

The included Docker deployment stores images in the named volume `crits_media`. Back that volume up to encrypted off-host storage. A backup is not verified until both the database and media have been restored and checked in a separate environment.

## Operational limitations to disclose

- No checkout, payment provider, delivery integration, order fulfillment, or automated enquiry notification is configured.
- The catalogue must be approved and populated before public launch.
- A postal address, business hours, and CRITS/Candid Services relationship claims require CRITS confirmation before publication.
- Manual staff sign-in, admin operations, backup recovery, and real production email delivery need verification with CRITS and the chosen host.
