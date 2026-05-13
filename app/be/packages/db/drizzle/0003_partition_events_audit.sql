-- Partition events (RANGE by week on created_at) and audit_log (RANGE by month on ts).
-- Greenfield migration: no production data, so DROP + CREATE is safe.
-- Drizzle does not support PARTITION BY declaratively; this is a hand-written migration.

-- Drop existing tables (cascade removes dependent indexes automatically).
DROP TABLE IF EXISTS "events" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;

--> statement-breakpoint

-- ── events — partitioned by week on created_at ────────────────────────────
-- Primary key must include the partition key in Postgres partitioned tables.
CREATE TABLE "events" (
    "id"           uuid          NOT NULL DEFAULT gen_random_uuid(),
    "node_id"      text          NOT NULL,
    "company"      text          NOT NULL,
    "title"        text          NOT NULL,
    "description"  text          NOT NULL DEFAULT '',
    "severity"     text          NOT NULL,
    "source"       text          NOT NULL,
    "external_ref" text          NOT NULL DEFAULT '',
    "scenario_id"  text          NOT NULL DEFAULT '',
    "created_at"   timestamptz   NOT NULL DEFAULT now(),
    "signature"    text          NOT NULL,
    "recipients"   jsonb,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- Default partition catches inserts that fall outside all named partitions.
CREATE TABLE "events_default" PARTITION OF "events" DEFAULT;

-- Indexes on the parent table propagate to all partitions automatically.
CREATE INDEX "idx_events_created"    ON "events" USING btree ("created_at");
CREATE INDEX "idx_events_node"       ON "events" USING btree ("node_id", "created_at");
CREATE INDEX "idx_events_source_ref" ON "events" USING btree ("source", "external_ref");

--> statement-breakpoint

-- ── audit_log — partitioned by month on ts ────────────────────────────────
CREATE TABLE "audit_log" (
    "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
    "ts"          timestamptz NOT NULL DEFAULT now(),
    "actor"       text        NOT NULL,
    "method"      text        NOT NULL,
    "path"        text        NOT NULL,
    "status_code" integer     NOT NULL,
    "outcome"     text        NOT NULL,
    "ip"          text,
    "duration_ms" integer     NOT NULL,
    "detail"      text,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id", "ts")
) PARTITION BY RANGE ("ts");

-- Default partition catches inserts outside named partitions.
CREATE TABLE "audit_log_default" PARTITION OF "audit_log" DEFAULT;

CREATE INDEX "idx_audit_ts" ON "audit_log" USING btree ("ts");

--> statement-breakpoint

-- ── Bootstrap partitions for the current period ──────────────────────────
-- events: current ISO week (Monday–Sunday) so fresh inserts always land in a named partition.
DO $$
DECLARE
    week_start  date;
    week_end    date;
    tbl         text;
BEGIN
    week_start := date_trunc('week', CURRENT_TIMESTAMP)::date;
    week_end   := week_start + INTERVAL '7 days';
    tbl        := 'events_w' || to_char(week_start, 'IYYY') || '_' || to_char(week_start, 'IW');
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
        tbl, week_start::text, week_end::text
    );
END $$;

-- audit_log: current calendar month.
DO $$
DECLARE
    month_start date;
    month_end   date;
    tbl         text;
BEGIN
    month_start := date_trunc('month', CURRENT_TIMESTAMP)::date;
    month_end   := (month_start + INTERVAL '1 month')::date;
    tbl         := 'audit_log_m' || to_char(month_start, 'YYYY_MM');
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
        tbl, month_start::text, month_end::text
    );
END $$;
