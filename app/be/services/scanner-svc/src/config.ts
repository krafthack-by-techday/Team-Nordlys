function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3013),
  databaseUrl: requiredEnv("DATABASE_URL"),
  coreSvcUrl: process.env.CORE_SVC_URL ?? "http://localhost:3010",

  // CIDR/host whitelist. Comma-separated. Targets outside the whitelist
  // are rejected unless SCANNER_ALLOW_EXTERNAL=true is set explicitly.
  whitelist: (process.env.SCANNER_WHITELIST ?? "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  allowExternal: process.env.SCANNER_ALLOW_EXTERNAL === "true",

  // Hard cap to prevent runaway scans. 30 minutes is enough for a /24 deep
  // scan at default rate.
  scanTimeoutMs: Number(process.env.SCAN_TIMEOUT_MS ?? 30 * 60 * 1000),

  // When nmap is unavailable (dev environments without the binary), emit
  // a synthetic result instead of failing. Set to "false" in production.
  mockWhenMissing: (process.env.SCANNER_MOCK_WHEN_MISSING ?? "true") === "true",
} as const;
