CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_encryption_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"encrypted_key" text NOT NULL,
	"active_from" timestamp NOT NULL,
	"active_to" timestamp NOT NULL,
	CONSTRAINT "global_encryption_keys_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" varchar(64) NOT NULL,
	"serial_number" varchar(64) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"mint_number" varchar(64) NOT NULL,
	"weight" varchar(32) NOT NULL,
	"nfc_serial_number" varchar(64) NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"original_owner_name" varchar(255) NOT NULL,
	"original_owner_email" varchar(255) NOT NULL,
	"current_owner_name" varchar(255) NOT NULL,
	"current_owner_email" varchar(255) NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"purchased_from" varchar(255) NOT NULL,
	"manufacture_date" timestamp NOT NULL,
	"produced_at" varchar(255) NOT NULL,
	"current_block_hash" varchar(64) NOT NULL,
	"previous_block_hash" varchar(64) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"item_encryption_key_hash" varchar(64) NOT NULL,
	"global_key_version" varchar(64) NOT NULL,
	"nfc_link" varchar(255) NOT NULL,
	CONSTRAINT "items_block_id_unique" UNIQUE("block_id"),
	CONSTRAINT "items_serial_number_unique" UNIQUE("serial_number"),
	CONSTRAINT "items_mint_number_unique" UNIQUE("mint_number"),
	CONSTRAINT "items_nfc_serial_number_unique" UNIQUE("nfc_serial_number"),
	CONSTRAINT "items_nfc_link_unique" UNIQUE("nfc_link")
);
--> statement-breakpoint
CREATE TABLE "ownership_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"owner_email" varchar(255) NOT NULL,
	"transfer_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"current_owner_email" varchar(255) NOT NULL,
	"new_owner_email" varchar(255) NOT NULL,
	"new_owner_name" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"current_mint_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skus_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"show_ownership_history" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_sku_skus_code_fk" FOREIGN KEY ("sku") REFERENCES "public"."skus"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_history" ADD CONSTRAINT "ownership_history_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;