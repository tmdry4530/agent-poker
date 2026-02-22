CREATE TABLE IF NOT EXISTS "agent_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"key_prefix" text DEFAULT '' NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chip_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"currency" text DEFAULT 'CHIP' NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chip_accounts_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chip_tx" (
	"id" text PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"debit_account_id" text NOT NULL,
	"credit_account_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chip_tx_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hand_events" (
	"id" text PRIMARY KEY NOT NULL,
	"hand_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hands" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"hand_no" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"result_summary" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seats" (
	"table_id" text NOT NULL,
	"seat_no" integer NOT NULL,
	"agent_id" text NOT NULL,
	"seat_token" text,
	"buy_in_amount" bigint NOT NULL,
	"status" text DEFAULT 'seated' NOT NULL,
	CONSTRAINT "seats_table_id_seat_no_unique" UNIQUE("table_id","seat_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"variant" text DEFAULT 'HU_LHE' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"max_seats" integer DEFAULT 6 NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chip_accounts" ADD CONSTRAINT "chip_accounts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chip_tx" ADD CONSTRAINT "chip_tx_debit_account_id_chip_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."chip_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chip_tx" ADD CONSTRAINT "chip_tx_credit_account_id_chip_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."chip_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hand_events" ADD CONSTRAINT "hand_events_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hands" ADD CONSTRAINT "hands_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seats" ADD CONSTRAINT "seats_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seats" ADD CONSTRAINT "seats_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_api_keys_prefix_idx" ON "agent_api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hand_events_hand_seq_idx" ON "hand_events" USING btree ("hand_id","seq");