# ADR-0012: Postgres table partitioning

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Two tables grow without bound under normal operation: the events
table on the Varde, which receives every event the Varde is asked to
fan out and store, and the audit_log table on the API gateway, which
receives one row per external request. At the design scale (low
hundreds of peers, sub-second event latency, multi-year retention as
a reasonable product target) both tables accumulate millions of
rows. The retention policy itself is short by default (30 days for
events) but the day-to-day reclaim cost matters: a row-level DELETE
across millions of rows produces dead tuples that VACUUM must
reclaim, and during that window the table bloats and query plans
degrade. A retention sweep that takes tens of minutes and disturbs
query performance during that window is operationally
unacceptable in a system that has to keep responding to mesh
traffic.

A partitioned table reframes retention as a metadata operation: an
old partition is detached and dropped as a whole, releasing storage
immediately, with no row-level work and no follow-up reclaim sweep.

This decision serves Tenet 8 (auditability) by making retention a
metadata operation that does not disturb the audit semantics or
ordering of the table, and Tenet 6 (operational realism) by avoiding
the row-level deletion pathology that would otherwise interfere with
mesh traffic during retention sweeps.

## Decision

The events table on the Varde is range-partitioned by event creation
time into ISO-week partitions. The audit_log table on the API
gateway is range-partitioned by event timestamp into monthly
partitions. A startup task ensures the current and next period's
partitions exist; a daily task re-runs the same check. Retention is
enforced by detaching and dropping out-of-window partitions as whole
units, releasing storage in one step rather than deleting rows
individually. A fallback row-level deletion path handles environments
running an older non-partitioned schema. Other tables (peers,
indicators, chat messages, revocations) are unpartitioned.

## Consequences

- Reclaiming thirty days of events is the time of dropping one
  partition as a whole table (effectively immediate) instead of a
  multi-million-row delete plus the storage-engine reclaim sweep
  that would follow.
- Hot data is concentrated in the current and previous weekly
  partitions, which keeps working-set indexes small and warm.
- Time-bounded queries (the common case for the operator dashboard)
  benefit from partition pruning: the query planner skips
  partitions whose ranges fall outside the time filter.
- The partition key (`created_at` or `ts`) must be part of the
  primary key. The events table therefore has a composite PK
  `(id, created_at)` rather than a simple `id`, which is awkward
  in foreign-key constraints from other tables and requires
  callers to think about the time dimension.
- Maintenance has its own failure surface. A startup task that
  fails to create next week's partition causes inserts dated into
  that period to fail until the partition appears. The daily
  re-check mitigates but does not eliminate the risk.
- Partitioning is bad at low-volume deployments where the
  reclaim-cost problem does not exist. A small Varde with a
  handful of events per day pays the operational complexity of
  partitions for no measurable benefit. The fallback DELETE path
  is the safety net for those environments.
- Only events and audit_log are partitioned. If indicators or
  chat reach similar volumes, they need the same treatment, which
  becomes a schema migration.

## Alternatives considered

- **Row-level DELETE on a schedule.** Conceptually simpler.
  Rejected at design scale because of the VACUUM bloat and query
  disturbance described above. Kept as the fallback path for
  small or older deployments.
- **Truncate-and-archive on a rolling buffer.** Use an unlogged
  table or a separate archive table that is periodically
  truncated. Rejected because it complicates queries (callers
  have to union live and archive) and offers no benefit over
  partitioning, which is a Postgres-native equivalent.
- **External time-series store** (TimescaleDB, ClickHouse).
  Better tooling for time-range queries at much larger scale.
  Rejected because adding a new database engine doubles the
  operational surface for a problem that native Postgres
  partitioning solves at the design scale.

## References

- `app/be/packages/db/src/schema.ts` (composite PKs, comments on
  partition-key requirement)
- `app/be/services/varde-svc/src/partitions.ts` (DDL, ensure-ahead
  + drop-old logic)
- `app/be/services/varde-svc/src/retention.ts` (partitioned vs.
  flat detection, DELETE fallback)
- Postgres documentation, "Table Partitioning" chapter.
