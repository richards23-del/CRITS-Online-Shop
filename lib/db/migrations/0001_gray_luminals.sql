CREATE TABLE "crits_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"location" text NOT NULL,
	"land_area" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_urls" text[] DEFAULT '{}' NOT NULL,
	"price_ugx" integer,
	"source_listing_url" text,
	"source_verified_at" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "crits_properties_slug_uq" ON "crits_properties" USING btree ("slug");