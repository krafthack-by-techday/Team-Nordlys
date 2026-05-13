import { and, asc, eq } from "drizzle-orm";
import { type Db, schema } from "@nordlys/db";
import type { SignedChatMessage } from "@nordlys/contracts";

export async function insertChat(
  db: Db,
  chat: SignedChatMessage,
): Promise<SignedChatMessage> {
  const [row] = await db
    .insert(schema.chatMessages)
    .values({
      id: chat.id,
      eventId: chat.event_id,
      nodeId: chat.node_id,
      company: chat.company,
      author: chat.author,
      message: chat.message,
      createdAt: new Date(chat.created_at),
      signature: chat.signature,
    })
    .onConflictDoNothing({ target: schema.chatMessages.id })
    .returning();
  return row ? rowToChat(row) : chat;
}

export async function listChatForEvent(
  db: Db,
  eventId: string,
): Promise<SignedChatMessage[]> {
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.eventId, eventId))
    .orderBy(asc(schema.chatMessages.createdAt));
  return rows.map(rowToChat);
}

type ChatRow = typeof schema.chatMessages.$inferSelect;

function rowToChat(row: ChatRow): SignedChatMessage {
  return {
    id: row.id,
    event_id: row.eventId,
    node_id: row.nodeId,
    company: row.company,
    author: row.author,
    message: row.message,
    created_at: row.createdAt.toISOString(),
    signature: row.signature,
  };
}
