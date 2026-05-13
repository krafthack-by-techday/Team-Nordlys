function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3020),
  databaseUrl: requiredEnv("DATABASE_URL"),
  vardeId: process.env.VARDE_ID ?? "varde-1",
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3020}`,

  // Peer Varder for HTTP gossip — comma-separated URLs.
  peerVardeUrls: (process.env.VARDE_PEERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Optional Ed25519 keypair via env. If absent, generated at startup
  // (suitable for dev; production must mount via Docker secret).
  publicKey: process.env.VARDE_PUBLIC_KEY,
  privateKey: process.env.VARDE_PRIVATE_KEY,

  // Limits
  maxNewConnectionsPerSec: Number(process.env.MAX_NEW_WS_PER_SEC ?? 50),
  maxEventsPerNodePerMin: Number(process.env.MAX_EVENTS_PER_NODE_PER_MIN ?? 60),
  inviteValidationTtlMs: 5 * 60 * 1000, // 5 minutes
  gossipIntervalMs: Number(process.env.GOSSIP_INTERVAL_MS ?? 7000),
  eventRetentionDays: Number(process.env.EVENT_RETENTION_DAYS ?? 30),

  // Drop sessions whose last PING is older than this. Nodes ping every 25s
  // by default, so 90s = ~3 missed pings.
  sessionIdleTimeoutMs: Number(process.env.SESSION_IDLE_TIMEOUT_MS ?? 90_000),
  healthCheckIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? 30_000),

  // Retention sweep cadence — once an hour is plenty for a 30-day TTL.
  retentionSweepIntervalMs: Number(
    process.env.RETENTION_SWEEP_INTERVAL_MS ?? 60 * 60 * 1000,
  ),

  // Node-ids of KraftCERT-role peers — the Varde forwards
  // INVITE_VALIDATION_FORWARD requests to any of these that are connected.
  kraftcertNodeIds: (process.env.KRAFTCERT_NODE_IDS ?? "kraftcert")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;
