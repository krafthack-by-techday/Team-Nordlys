function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3012),
  databaseUrl: requiredEnv("DATABASE_URL"),
  coreSvcUrl: process.env.CORE_SVC_URL ?? "http://localhost:3010",

  // Directory containing YAML scenario packs. Each .yaml is loaded at startup.
  scenariosDir: process.env.SCENARIOS_DIR ?? "./scenarios",

  // Global shadow-mode override. When true, no events are forwarded to
  // core-svc even if scenarios match (matches are still logged for tuning).
  shadowMode: process.env.COLLECTOR_SHADOW === "true",
} as const;
