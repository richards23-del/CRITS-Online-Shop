# Product CSV template

Download the empty template from **Admin → Import & export**. It contains only the column headings; it intentionally has no example or unapproved products.

## Columns

| Column | Use |
| --- | --- |
| `title` | Required public product title. |
| `slug` | Optional URL slug; generated from the title if blank. |
| `brand`, `model` | Optional product details. |
| `categoryId` | Required numeric ID from **Admin → Categories**. IDs can differ between databases. |
| `condition` | Required: `new`, `used`, or `refurbished`. |
| `description` | Product description approved by CRITS. |
| `specifications` | JSON object, for example `{"Memory":"16 GB"}`. Leave blank for no specifications. |
| `imageUrls` | JSON array of approved public image URLs, for example `["https://example.com/approved-image.jpg"]`. Leave blank for no images. |
| `priceUgx` | Optional whole-number price in UGX; leave blank when a quote is required. |
| `availability` | Required: `available`, `quote`, or `out_of_stock`. |
| `stockQuantity` | Optional non-negative whole number. |
| `sku` | Optional staff SKU. |
| `sourceListingUrl` | Optional source URL for staff reference. Do not copy Jiji content without permission. |
| `sourceVerifiedAt` | Optional date in `YYYY-MM-DD` format. |
| `status` | Optional: `draft` or `archived`. Imports cannot publish products. |
| `featured` | Optional `true` or `false`. |

The importer supports quoted CSV fields and doubled quotation marks. If a JSON value contains quotation marks, quote the entire CSV cell and double each internal quotation mark. For example:

```csv
"Laptop","laptop-01","Brand","Model",3,new,"Approved copy","{""Memory"":""16 GB""}","[""https://example.com/image.jpg""]",,quote,,SKU-1,,,,draft,false
```

The example above documents formatting only; it is not a CRITS catalogue record. Confirm every product, category, image, source, price, and availability with CRITS before importing. CSV imports are staff-only, require a confirmation, and create non-public records for review.

## Export

The catalogue export uses the same headings and includes source URLs, verification dates, specifications, image URLs, status, and featured state. It contains catalogue records only, not customer enquiry details. It can be imported again after review; `published` is deliberately not accepted by the importer.
