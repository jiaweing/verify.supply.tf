CREATE TABLE "short_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_url" varchar(255) NOT NULL,
	"short_path" uuid DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "short_urls_short_path_unique" UNIQUE("short_path")
);
--> statement-breakpoint
ALTER TABLE "short_urls" ADD CONSTRAINT "short_urls_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;