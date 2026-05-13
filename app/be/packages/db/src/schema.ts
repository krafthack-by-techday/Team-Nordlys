import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Events ─────────────────────────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    // Postgres requires the partition key to be in the primary key, so the
    // PK is composite (id, created_at). UUID collisions on `id` alone are
    // astronomically unlikely; ON CONFLICT targets need both columns.
    id: uuid("id").notNull().defaultRandom(),
    nodeId: text("node_id").notNull(),
    company: text("company").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    severity: text("severity").notNull(),
    source: text("source").notNull(),
    externalRef: text("external_ref").default("").notNull(),
    scenarioId: text("scenario_id").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    signature: text("signature").notNull(),
    recipients: jsonb("recipients").$type<string[] | null>(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.createdAt] }),
    createdIdx: index("idx_events_created").on(t.createdAt),
    nodeIdx: index("idx_events_node").on(t.nodeId, t.createdAt),
    // (source, external_ref) lookup for SIEM dedup — collector-svc consults
    // this before insert. Not a unique constraint because manual events all
    // have source="manual", external_ref="" and would collide.
    sourceRef: index("idx_events_source_ref").on(t.source, t.externalRef),
  }),
);

// ── Indicators (IoCs with TLP) ────────────────────────────────────────────

export const indicators = pgTable(
  "indicators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: text("node_id").notNull(),
    company: text("company").notNull(),
    type: text("type").notNull(),
    value: text("value").notNull(),
    tlp: text("tlp").notNull(),
    description: text("description").default("").notNull(),
    severity: text("severity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    signature: text("signature").notNull(),
    recipients: jsonb("recipients").$type<string[] | null>(),
  },
  (t) => ({
    createdIdx: index("idx_indicators_created").on(t.createdAt),
    tlpIdx: index("idx_indicators_tlp").on(t.tlp),
    valueIdx: index("idx_indicators_value").on(t.type, t.value),
  }),
);

// ── Chat (per-event discussion) ───────────────────────────────────────────

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    nodeId: text("node_id").notNull(),
    company: text("company").notNull(),
    author: text("author").default("").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    signature: text("signature").notNull(),
  },
  (t) => ({
    eventIdx: index("idx_chat_event").on(t.eventId, t.createdAt),
    createdIdx: index("idx_chat_created").on(t.createdAt),
  }),
);

// ── Identity register ─────────────────────────────────────────────────────

export const peers = pgTable(
  "peers",
  {
    nodeId: text("node_id").notNull(),
    company: text("company").notNull(),
    publicKey: text("public_key").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    registeredBy: text("registered_by").notNull(),
    signature: text("signature").notNull(),
    signedBy: text("signed_by").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.nodeId] }),
    companyIdx: index("idx_peers_company").on(t.company),
  }),
);

export const revocations = pgTable(
  "revocations",
  {
    nodeId: text("node_id").primaryKey(),
    company: text("company").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason").default("").notNull(),
    signedBy: text("signed_by").notNull(),
    signature: text("signature").notNull(),
  },
);

export const inviteTokens = pgTable("invite_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  company: text("company").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByNodeId: text("used_by_node_id"),
});

// ── v0.2 features ─────────────────────────────────────────────────────────

export const vulnerabilities = pgTable(
  "vulnerabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cveId: text("cve_id").default("").notNull(),
    cvssScore: real("cvss_score").default(0).notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    asset: text("asset").default("").notNull(),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("idx_vuln_status").on(t.status),
    severityIdx: index("idx_vuln_severity").on(t.severity),
    cveIdx: index("idx_vuln_cve").on(t.cveId),
  }),
);

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").default("").notNull(),
  publisher: text("publisher").notNull(),
  manifestUrl: text("manifest_url").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    request: jsonb("request").notNull(),
    status: text("status").default("queued").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resultSummary: text("result_summary"),
    error: text("error"),
  },
  (t) => ({ statusIdx: index("idx_scans_status").on(t.status) }),
);

// ── Varde-roster (local mirror of mesh's Varde set) ───────────────────────

export const vardeRoster = pgTable("varde_roster", {
  vardeId: text("varde_id").primaryKey(),
  url: text("url").notNull(),
  publicKey: text("public_key").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

// ── Ingest dedup (collector-svc writes; SIEM-side idempotency) ──────────

export const ingestDedup = pgTable(
  "ingest_dedup",
  {
    source: text("source").notNull(),
    externalRef: text("external_ref").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventId: uuid("event_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.source, t.externalRef] }),
  }),
);

// ── Node state & settings ─────────────────────────────────────────────────

export const nodeState = pgTable("node_state", {
  id: integer("id").primaryKey().default(1),
  status: text("status").notNull().default("uninitialized"), // uninitialized | pending | active
  setupCode: text("setup_code"),
  setupCodeExpiresAt: timestamp("setup_code_expires_at", { withTimezone: true }),
  setupAttempts: integer("setup_attempts").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nodeSettings = pgTable("node_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Users & Sessions ──────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"), // null for OIDC-only users
    provider: text("provider").notNull().default("local"), // local | oidc
    role: text("role").notNull().default("operator"), // admin | operator | viewer
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("idx_users_email").on(t.email),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_sessions_user").on(t.userId),
    expiresIdx: index("idx_sessions_expires").on(t.expiresAt),
  }),
);

// ── Audit log (api-gateway writes here) ───────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    // Composite PK (id, ts) because the table is partitioned by ts.
    id: uuid("id").notNull().defaultRandom(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    outcome: text("outcome").notNull(),
    ip: text("ip"),
    durationMs: integer("duration_ms").notNull(),
    detail: text("detail"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.ts] }),
    tsIdx: index("idx_audit_ts").on(t.ts),
  }),
);
