# CRITS Online Shop deployment checklist

Use this checklist for the public launch. Items marked **CRITS decision** need an authorized staff member to confirm them; code cannot verify business policy or external account settings.

## Production access and Clerk

- [ ] Create a Clerk **Production** instance for the final public domain. Development users do not transfer; invite or create staff accounts in Production and put their production `user_...` IDs in `CRITS_ADMIN_USER_IDS`.
- [ ] Use the matching Production `pk_live_...` and `sk_live_...` keys. The publishable key is also supplied as `VITE_CLERK_PUBLISHABLE_KEY`; the secret key stays server-side.
- [ ] Restrict production sign-up to approved staff. Add the deployed site origin to Clerk's allowed domains and confirm the sign-in email flow works for the staff members who will use the system.
- [ ] For Ugandan phone numbers, verify Clerk's current SMS availability before enabling phone-only sign-in. Use verified email sign-in where SMS delivery is unavailable.
- [ ] Sign in with an approved production account and verify product, category, enquiry, CSV, image, and privacy-setting operations. Verify an unapproved account receives a denial.

## Domain, hosting, and secrets

- [ ] Point the chosen domain to the deployment host and confirm HTTPS works. The included Docker setup terminates TLS through Caddy and serves the storefront and API on one origin.
- [ ] Copy `deploy/production.env.example` to the private root file `.env.production`, replace every example value, and keep that file out of Git. Prefer the host's secret manager for long-lived deployment.
- [ ] Run `pnpm run preflight:deploy`; it checks configuration without printing secret values. Fix every reported error before building.
- [ ] Configure `APP_ORIGIN` and `DOMAIN` to the same public host. Keep `TRUST_PROXY_HOPS` at the actual trusted reverse-proxy count (one for the included Caddy service).
- [ ] Use managed PostgreSQL with private networking and TLS. Set a dedicated database login, encrypted automated backups, and a tested restore process.
- [ ] Use the app's persistent `crits_media` volume for product images and arrange separate encrypted, off-host backups for that volume. Keep the deployment to one API instance while media uses the local volume.
- [ ] Keep port 8080 private to the proxy. Expose only ports 80 and 443 from the included stack; do not expose PostgreSQL publicly.

## Database and release procedure

- [ ] Review the SQL migrations under `lib/db/migrations` before applying them to production.
- [ ] Confirm the target database is empty before applying the initial migration. If it already contains CRITS tables or data, stop and plan a backed-up schema/data adoption; do not apply the create-table baseline as-is.
- [ ] Build the `migrator` target and apply migrations once, before deploying the new application image. Do not use `drizzle-kit push` against production.
- [ ] Confirm `/api/healthz` reports ready after the migration, and check the deployment logs for startup errors.
- [ ] Verify a failed database connection or missing schema returns an unhealthy readiness result and does not serve the app as healthy.
- [ ] Confirm the first backup can be listed and restore it into a separate non-production database. Test a separate product-media restore as well.

## Catalogue and customer workflows

- [ ] **CRITS decision:** approve product names, descriptions, condition, price or quote status, availability, stock, images, and source verification dates.
- [ ] Confirm CRITS has permission to reuse each product photo and listing description. Jiji content should not be scraped or copied without written permission and an approved export method; see `jiji-catalogue-integration.md`.
- [ ] Import approved records as drafts, review them in the admin catalogue, and publish each item individually. Check category IDs against the production Categories page.
- [ ] Confirm the public phone numbers, WhatsApp number, email, and social links. Do not add an address, hours, or CRITS/Candid relationship claims without approval.
- [ ] **CRITS decision:** approve the privacy notice and enquiry-retention period. Verify that staff know enquiry follow-up is manual; automated email and SMS notifications are not configured.
- [ ] Confirm the sales model is catalogue plus quote/enquiry. Checkout, payment processing, delivery integration, and order fulfillment are not part of this release.

## Customer-facing launch review

- [ ] Review the storefront at phone, tablet, and desktop sizes.
- [ ] Check search, filters, pagination, product details, basket quantities, enquiry submission, WhatsApp links, and the contact form fallback.
- [ ] Check empty catalogue states, missing product images, expired/unavailable products, and unavailable API/database behavior.
- [ ] Check page titles, descriptions, social previews, favicon, logo rendering, keyboard access, and outbound links.
- [ ] Submit a real test enquiry, confirm it appears in the admin workspace, and remove the test record according to the approved process.
- [ ] Confirm the deployment operator can roll back to the previous image and knows how to restore the database and media backups.

## Current known launch gates

- Production Clerk keys, domain, staff sign-in policy, and production staff IDs must be supplied by CRITS.
- Business ownership of catalogue photos/content, public contact details, privacy wording, retention, and any Candid Services claims require CRITS approval.
- No payment, delivery, or automatic enquiry notification service is configured.
- Production backups and an actual restore rehearsal must be established by the hosting operator.
