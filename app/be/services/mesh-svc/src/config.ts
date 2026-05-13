import { resolveIdentity } from "@nordlys/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// mesh-svc must not start with a placeholder identity — it would sign
// outbound mesh traffic with "uninitialized". Throws if NODE_ID/COMPANY
// are missing from both env and node_settings; the orchestrator should
// keep the container in a crash-loop until the setup wizard completes.
const identity = await resolveIdentity();

export const config = {
  port: Number(process.env.PORT ?? 3011),
  databaseUrl: requiredEnv("DATABASE_URL"),
  nodeId: identity.nodeId,
  company: identity.company,
  role: identity.role,
  coreSvcUrl: process.env.CORE_SVC_URL ?? "http://localhost:3010",

  // Bootstrap Varde URLs (WebSocket). Comma-separated. The roster-fetched
  // set takes over as soon as a HELLO returns a STATE_SNAPSHOT.
  vardeBootstrap: (process.env.VARDE_BOOTSTRAP ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Top-N count of Varder to keep tunnels open against.
  vardeTopN: Number(process.env.VARDE_TOP_N ?? 3),

  // Reconnect backoff bounds (ms).
  reconnectMinMs: Number(process.env.RECONNECT_MIN_MS ?? 1000),
  reconnectMaxMs: Number(process.env.RECONNECT_MAX_MS ?? 60000),

  pingIntervalMs: Number(process.env.PING_INTERVAL_MS ?? 25000),

  // ── Health scoring ────────────────────────────────────────────────
  healthDbPath: process.env.HEALTH_DB_PATH ?? "./data/health-scores.sqlite",
  healthPongTimeoutMs: Number(process.env.HEALTH_PONG_TIMEOUT_MS ?? 5000),
  healthSwapCooldownMs: Number(process.env.HEALTH_SWAP_COOLDOWN_MS ?? 60000),
  healthStickyBonus: Number(process.env.HEALTH_STICKY_BONUS ?? 15),
  healthDeprioritizeThreshold: Number(process.env.HEALTH_DEPRIORITIZE_THRESHOLD ?? 30),
  healthMinTunnels: Number(process.env.HEALTH_MIN_TUNNELS ?? 2),
} as const;
