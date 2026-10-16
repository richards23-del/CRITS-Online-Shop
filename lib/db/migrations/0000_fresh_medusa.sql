CREATE TABLE "crits_analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"product_id" integer,
	"query" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crits_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crits_enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"preferred_contact_method" text NOT NULL,
	"contact_value" text NOT NULL,
	"organisation" text,
	"location_notes" text,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crits_enquiry_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"enquiry_id" integer NOT NULL,
	"product_id" integer,
	"title" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_ugx" integer
);
--> statement-breakpoint
CREATE TABLE "crits_privacy_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"enquiry_retention_days" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crits_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"model" text,
	"category_id" integer NOT NULL,
	"condition" text DEFAULT 'new' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_urls" text[] DEFAULT '{}' NOT NULL,
	"price_ugx" integer,
	"availability" text DEFAULT 'quote' NOT NULL,
	"stock_quantity" integer,
	"sku" text,
	"source_listing_url" text,
	"source_verified_at" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crits_enquiry_items" ADD CONSTRAINT "crits_enquiry_items_enquiry_id_crits_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."crits_enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crits_products" ADD CONSTRAINT "crits_products_category_id_crits_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."crits_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crits_categories_slug_uq" ON "crits_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "crits_enquiries_reference_uq" ON "crits_enquiries" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "crits_products_slug_uq" ON "crits_products" USING btree ("slug");