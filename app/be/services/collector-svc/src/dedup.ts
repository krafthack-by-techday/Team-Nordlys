import { and, eq } from "drizzle-orm";
import { schema } from "@nordlys/db";
import { getDbInstance } from "./db";

// Per-(source, external_ref) idempotency. SIEMs commonly retry webhook
// deliveries; this lets collector-svc reject duplicates before forwarding to
// core-svc. external_ref="" is treated as "not idempotent" — every call is
// a new event.
export async function checkAndReserve(
  source: string,
  externalRef: string,
  eventId: string,
): Promise<{ accepted: boolean; existingEventId?: string }> {
  if (!externalRef) return { accepted: true };

  const db = getDbInstance();
  try {
    await db.insert(schema.ingestDedup).values({
      source,
      externalRef,
      eventId,
    });
    return { accepted: true };
  } catch {
    // Conflict on (source, external_ref) — fetch the existing event id so
    // the caller can echo it back to the SIEM as a retry result.
    const [row] = await db
      .select()
      .from(schema.ingestDedup)
      .where(
        and(
          eq(schema.ingestDedup.source, source),
          eq(schema.ingestDedup.externalRef, externalRef),
        ),
      )
      .limit(1);
    return {
      accepted: false,
      ...(row ? { existingEventId: row.eventId } : {}),
    };
  }
}
