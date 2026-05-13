export const config = {
  port: Number(process.env.PORT ?? 3000),

  // Database URL for auth tables (users, sessions, node_state).
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Redis pub/sub for SSE streaming.
  redisUrl: process.env.REDIS_URL ?? "",

  // Internal service URLs (Docker DNS in compose, localhost in dev).
  services: {
    core: process.env.CORE_SVC_URL ?? "http://localhost:3010",
    mesh: process.env.MESH_SVC_URL ?? "http://localhost:3011",
    collector: process.env.COLLECTOR_SVC_URL ?? "http://localhost:3012",
    scanner: process.env.SCANNER_SVC_URL ?? "http://localhost:3013",
  },

  // API keys: comma-separated "name:secret" pairs, loaded into a {secret -> name} map.
  // Example: API_KEYS="splunk-prod:abc123,sentinel-stage:xyz789"
  apiKeys: parseApiKeys(process.env.API_KEYS ?? ""),

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
} as const;

function parseApiKeys(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed.includes(":")) continue;
    const [name, secret] = trimmed.split(":", 2);
    if (name && secret) map.set(secret, name);
  }
  return map;
}
