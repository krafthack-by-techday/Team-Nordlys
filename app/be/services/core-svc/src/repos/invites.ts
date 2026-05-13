import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { type Db, schema } from "@nordlys/db";

const INVITE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CreatedInvite {
  token: string; // raw, returned only at creation
  company: string;
  expiresAt: Date;
}

export type InviteStatus = "pending" | "consumed" | "expired";

export interface ListedInvite {
  token_prefix: string;
  company: string;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

export async function createInvite(
  db: Db,
  company: string,
): Promise<CreatedInvite> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db.insert(schema.inviteTokens).values({
    tokenHash: hashToken(token),
    company,
    expiresAt,
  });
  return { token, company, expiresAt };
}

export async function consumeInvite(
  db: Db,
  token: string,
  redeemedByNodeId: string,
): Promise<{ company: string } | null> {
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(schema.inviteTokens)
    .where(
      and(
        eq(schema.inviteTokens.tokenHash, tokenHash),
        isNull(schema.inviteTokens.usedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(schema.inviteTokens)
    .set({ usedAt: new Date(), usedByNodeId: redeemedByNodeId })
    .where(eq(schema.inviteTokens.tokenHash, tokenHash));

  return { company: row.company };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function listInvites(db: Db): Promise<ListedInvite[]> {
  const rows = await db
    .select()
    .from(schema.inviteTokens)
    .orderBy(desc(schema.inviteTokens.createdAt));
  const now = Date.now();
  return rows.map((row) => {
    const status: InviteStatus = row.usedAt
      ? "consumed"
      : row.expiresAt.getTime() < now
        ? "expired"
        : "pending";
    return {
      token_prefix: row.tokenHash.slice(0, 8),
      company: row.company,
      status,
      created_at: row.createdAt.toISOString(),
      expires_at: row.expiresAt.toISOString(),
      used_at: row.usedAt ? row.usedAt.toISOString() : null,
      used_by: row.usedByNodeId,
    };
  });
}
