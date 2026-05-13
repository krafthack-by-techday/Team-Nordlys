import { Type, type Static } from "@sinclair/typebox";
import {
  Company,
  Ed25519Signature,
  IsoTimestamp,
  NodeId,
  Uuid,
} from "./primitives";

export const ChatMessageCore = Type.Object({
  id: Uuid,
  event_id: Uuid,
  node_id: NodeId,
  company: Company,
  author: Type.String({ default: "" }),
  message: Type.String({ minLength: 1, maxLength: 4000 }),
  created_at: IsoTimestamp,
});
export type ChatMessageCore = Static<typeof ChatMessageCore>;

export const SignedChatMessage = Type.Composite([
  ChatMessageCore,
  Type.Object({ signature: Ed25519Signature }),
]);
export type SignedChatMessage = Static<typeof SignedChatMessage>;

export const ChatMessageInput = Type.Object({
  event_id: Uuid,
  message: Type.String({ minLength: 1, maxLength: 4000 }),
  author: Type.Optional(Type.String({ maxLength: 128 })),
});
export type ChatMessageInput = Static<typeof ChatMessageInput>;
