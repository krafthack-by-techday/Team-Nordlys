CREATE TABLE IF NOT EXISTS "ingest_dedup" (
	"source" text NOT NULL,
	"external_ref" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "ingest_dedup_source_external_ref_pk" PRIMARY KEY("source","external_ref")
);
