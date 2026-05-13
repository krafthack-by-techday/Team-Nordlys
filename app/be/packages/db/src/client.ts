import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: { db: Db; close: () => Promise<void> } | null = null;

export function getDb(connectionString = process.env.DATABASE_URL): {
  db: Db;
  close: () => Promise<void>;
} {
  if (cached) return cached;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  cached = { db, close: () => client.end() };
  return cached;
}
