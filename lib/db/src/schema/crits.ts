import {
  boolean,
  bigint,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categoriesTable = pgTable(
  "crits_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("crits_categories_slug_uq").on(table.slug)],
);

export const productsTable = pgTable(
  "crits_products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    model: text("model"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    condition: text("condition").notNull().default("new"),
    description: text("description").notNull().default(""),
    specifications: jsonb("specifications")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    imageUrls: text("image_urls").array().notNull().default([]),
    priceUgx: integer("price_ugx"),
    availability: text("availability").notNull().default("quote"),
    stockQuantity: integer("stock_quantity"),
    sku: text("sku"),
    sourceListingUrl: text("source_listing_url"),
    sourceVerifiedAt: date("source_verified_at", { mode: "string" }),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("crits_products_slug_uq").on(table.slug)],
);

export const propertiesTable = pgTable(
  "crits_properties",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull(),
    landArea: text("land_area").notNull(),
    description: text("description").notNull().default(""),
    imageUrls: text("image_urls").array().notNull().default([]),
    priceUgx: bigint("price_ugx", { mode: "number" }),
    sourceListingUrl: text("source_listing_url"),
    sourceVerifiedAt: date("source_verified_at", { mode: "string" }),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("crits_properties_slug_uq").on(table.slug)],
);

export const enquiriesTable = pgTable(
  "crits_enquiries",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull(),
    name: text("name").notNull(),
    preferredContactMethod: text("preferred_contact_method").notNull(),
    contactValue: text("contact_value").notNull(),
    organisation: text("organisation"),
    locationNotes: text("location_notes"),
    message: text("message"),
    status: text("status").notNull().default("new"),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("crits_enquiries_reference_uq").on(table.reference)],
);

export const enquiryItemsTable = pgTable("crits_enquiry_items", {
  id: serial("id").primaryKey(),
  enquiryId: integer("enquiry_id")
    .notNull()
    .references(() => enquiriesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  priceUgx: integer("price_ugx"),
});

export const analyticsEventsTable = pgTable("crits_analytics_events", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  productId: integer("product_id"),
  query: text("query"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const privacySettingsTable = pgTable("crits_privacy_settings", {
  id: serial("id").primaryKey(),
  enquiryRetentionDays: integer("enquiry_retention_days"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
