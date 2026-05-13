import { getDb, type Db } from "@nordlys/db";
import { config } from "./config";

let cached: { db: Db; close: () => Promise<void> } | null = null;

export function getDbInstance(): Db {
  if (!cached) cached = getDb(config.databaseUrl);
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
