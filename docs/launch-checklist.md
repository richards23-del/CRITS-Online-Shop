# CRITS online shop launch checklist

## Staff and operations

- [ ] Add approved Clerk staff user IDs to `CRITS_ADMIN_USER_IDS`.
- [ ] Sign in as an approved staff member and verify product, category, enquiry, CSV, image upload, and privacy-setting workflows.
- [ ] Test that a signed-in account not on the allowlist cannot access staff data or make changes.
- [ ] Confirm staff know enquiry follow-up is manual in the admin workspace; there are no email or SMS notifications.
- [ ] Confirm a database backup and separate product-image backup process.

## Catalogue

- [ ] Approve product names, descriptions, condition, price or quote status, availability, stock, image rights, and source details before import.
- [ ] Add products with the current category IDs shown in **Admin → Categories**. The development category IDs may differ from production.
- [ ] Import records as drafts, check them in the admin catalogue, then publish them individually.
- [ ] Decide whether any Jiji listing data may be reused. Do not scrape or copy listings until rights and an approved export method are confirmed; see `jiji-catalogue-integration.md`.

## Public information

- [ ] Confirm the supplied telephone numbers, WhatsApp number, and email are current.
- [ ] Confirm that the supplied “Quality Redefined” wording is the official tagline before using it as separate marketing copy. The supplied logo itself is retained.
- [ ] Confirm the CRITS/Candid Services relationship before publishing any claims about it. Candid Services claims are intentionally omitted.
- [ ] Supply and approve a postal address or business hours before adding either to the site. Neither is currently shown.
- [ ] Review the privacy notice, select an enquiry-retention period, and confirm the policy meets applicable legal requirements.
- [ ] Confirm whether online payments are wanted later. This version has no checkout or payment processing.

## Final checks

- [ ] Review the public site on desktop and mobile.
- [ ] Test search, filters, pagination, product details, basket quantities, prefilled WhatsApp message, and form fallback.
- [ ] Verify all outbound social and contact links.
- [ ] Publish through Replit only after reviewing the production database changes and choosing the appropriate publishing settings.
