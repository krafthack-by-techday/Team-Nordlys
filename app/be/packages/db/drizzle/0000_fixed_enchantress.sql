CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"outcome" text NOT NULL,
	"ip" text,
	"duration_ms" integer NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"company" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signature" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"severity" text NOT NULL,
	"source" text NOT NULL,
	"external_ref" text DEFAULT '' NOT NULL,
	"scenario_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signature" text NOT NULL,
	"recipients" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" text NOT NULL,
	"company" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"tlp" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"severity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signature" text NOT NULL,
	"recipients" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_node_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "peers" (
	"node_id" text NOT NULL,
	"company" text NOT NULL,
	"public_key" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"registered_by" text NOT NULL,
	"signature" text NOT NULL,
	"signed_by" text NOT NULL,
	CONSTRAINT "peers_node_id_pk" PRIMARY KEY("node_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revocations" (
	"node_id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"signed_by" text NOT NULL,
	"signature" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result_summary" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"publisher" text NOT NULL,
	"manifest_url" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "varde_roster" (
	"varde_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"public_key" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cve_id" text DEFAULT '' NOT NULL,
	"cvss_score" real DEFAULT 0 NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"asset" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_ts" ON "audit_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_event" ON "chat_messages" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_created" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_created" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_node" ON "events" USING btree ("node_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_events_source_ref" ON "events" USING btree ("source","external_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_indicators_created" ON "indicators" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_indicators_tlp" ON "indicators" USING btree ("tlp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_indicators_value" ON "indicators" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_peers_company" ON "peers" USING btree ("company");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scans_status" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_status" ON "vulnerabilities" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_severity" ON "vulnerabilities" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_cve" ON "vulnerabilities" USING btree ("cve_id");