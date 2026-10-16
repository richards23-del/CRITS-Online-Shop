# CRITS Online Shop — security and operations

## Application overview

- Public storefront: React and Vite web artifact.
- API: Express routes under `/api`, with request logging through Pino.
- Data: PostgreSQL tables for categories, products, enquiries, enquiry items, analytics, and privacy settings.
- Staff sign-in: Replit-managed Clerk. Public catalogue and contact pages do not require sign-in.
- Product images: Replit Object Storage. Product images are public once their listing is published; only an authenticated staff member on the server allowlist can request an upload URL.
- Payments are not collected.

## Staff access

Admin API access is denied unless the signed-in Clerk user ID appears in the comma-separated `CRITS_ADMIN_USER_IDS` environment variable. An empty value denies all users. Do not put a business email address in this setting; it expects Clerk user IDs.

Before staff can use `/admin`:

1. Have the approved staff member register/sign in through the Clerk sign-in flow.
2. Obtain that account's Clerk user ID through the project's managed Clerk user-management view.
3. Set `CRITS_ADMIN_USER_IDS` in the Replit environment/secrets flow. Use a comma-separated list for multiple approved staff accounts.
4. Restart the API workflow and verify that an approved user can access `/admin` and an unlisted account receives an access-denied response.

Clerk keys and Object Storage configuration are managed by Replit. Keep their values in Replit's secrets flow; do not copy them into source files, this document, or a CSV export.

## Public contact configuration

The website uses the supplied CRITS contact details. `VITE_CRITS_WHATSAPP` can override the supplied WhatsApp number at build time. If it is explicitly set to an empty value, WhatsApp links are hidden and the standard enquiry form remains available. If it is unset, the supplied number is used. A new value should be verified with CRITS before publication.

## Enquiries and privacy

- Enquiry submission validates data on the server, checks the selected published products, uses a honeypot, and is limited to five submissions per IP per 15 minutes.
- Enquiry details are visible only through allowlisted admin routes. Follow-up is manual in the staff workspace; no email/SMS notification service is configured.
- Retention is unset by default, so the application does not automatically delete enquiry records. A staff member can set a period in **Admin → Privacy settings**.
- Saving a retention period immediately deletes enquiries older than that period; the page requires an explicit confirmation. A daily sweep also removes records after the configured period. Turning automatic deletion off does not restore previously deleted records.
- CRITS must approve the privacy notice, choose a retention period consistent with its obligations, and confirm applicable Ugandan privacy requirements before launch.

## Catalogue and media

- There are no seeded product records. Only CRITS-approved records should be added.
- CSV imports create drafts or archived records only; publish each product individually after review.
- Product source URLs and last-verified dates are stored with the catalogue record.
- Uploaded product media is public. Do not upload customer documents or private files through the product image workflow.
- The database backup does not include Object Storage files. Keep separate copies of original product images and verify any Object Storage backup/versioning policy before relying on it.

## Development and deployment

From the repository root:

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm run typecheck
```

The configured API and web workflows are `artifacts/api-server: API Server` and `artifacts/crits-shop: web`. Use the Replit Publish flow to publish the project. Review the production database schema changes shown by Publish before applying them. Configure the staff allowlist before granting access to the admin workspace.

Required platform-managed configuration:

- Clerk: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and Clerk proxy configuration.
- Object Storage: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, and `PUBLIC_OBJECT_SEARCH_PATHS`.
- Session support: `SESSION_SECRET`.
- Staff access: `CRITS_ADMIN_USER_IDS`.
- Optional public WhatsApp override: `VITE_CRITS_WHATSAPP`.

The first four groups are supplied through Replit-managed setup/secrets. Do not commit their values.

## Database backup and restore

Run backups in a trusted shell with the correct Replit database connection configured as `DATABASE_URL`. Do not paste or print the connection string.

Create a compressed backup:

```sh
pg_dump "$DATABASE_URL" --format=custom --file="crits-db-$(date +%F).dump"
```

Check that a backup can be read:

```sh
pg_restore --list "crits-db-YYYY-MM-DD.dump"
```

Restore only after verifying the target database and retaining a separate current backup. The following can replace existing data in the target:

```sh
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "crits-db-YYYY-MM-DD.dump"
```

Test restores against a non-production database first. Database dumps do not contain product images stored in Object Storage.

## Known launch gaps

- `CRITS_ADMIN_USER_IDS` has no initial staff IDs until CRITS completes staff onboarding.
- Product catalogue is intentionally empty.
- Jiji sync/export permission is unconfirmed; there is no Jiji integration.
- CRITS must confirm the tagline and the CRITS/Candid Services relationship before using those details in new public copy.
- A full postal address and hours have not been confirmed, so the site does not publish them or show a map.
- No payment provider, delivery integration, automated enquiry notification, or automated Object Storage backup is configured.
- Authenticated staff screens could not be verified in a browser session without an allowlisted staff account.

## Verification performed

- Workspace library typecheck and the API/frontend package typechecks.
- Database schema push to the development database.
- Public health, catalogue, category, enquiry validation, and unauthenticated admin access checks are verified in the current development environment.
- Manual staff journeys, product image upload, and CSV import/export require an allowlisted account and product records; do not treat them as verified until tested with CRITS staff.
