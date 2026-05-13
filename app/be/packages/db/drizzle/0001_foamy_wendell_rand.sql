DROP INDEX IF EXISTS "idx_events_source_ref";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_source_ref" ON "events" USING btree ("source","external_ref");