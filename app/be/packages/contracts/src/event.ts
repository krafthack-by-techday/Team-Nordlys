import { Type, type Static } from "@sinclair/typebox";
import {
  Company,
  Ed25519Signature,
  EventSource,
  IsoTimestamp,
  NodeId,
  Severity,
  Uuid,
} from "./primitives";

export const EventCore = Type.Object({
  id: Uuid,
  node_id: NodeId,
  company: Company,
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.String({ default: "" }),
  severity: Severity,
  source: EventSource,
  external_ref: Type.String({ default: "", maxLength: 256 }),
  scenario_id: Type.String({ default: "", maxLength: 128 }),
  created_at: IsoTimestamp,
});
export type EventCore = Static<typeof EventCore>;

export const SignedEvent = Type.Composite([
  EventCore,
  Type.Object({
    signature: Ed25519Signature,
    recipients: Type.Optional(
      Type.Array(NodeId, {
        description:
          "If set, only these nodes should receive the event. Empty/absent means all peers.",
      }),
    ),
  }),
]);
export type SignedEvent = Static<typeof SignedEvent>;

export const EventIngestInput = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String()),
  severity: Severity,
  source: EventSource,
  external_ref: Type.Optional(Type.String({ maxLength: 256 })),
  scenario_id: Type.Optional(Type.String({ maxLength: 128 })),
  recipients: Type.Optional(Type.Array(NodeId)),
});
export type EventIngestInput = Static<typeof EventIngestInput>;
