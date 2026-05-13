import { Type, type Static } from "@sinclair/typebox";
import {
  Company,
  Ed25519Signature,
  IndicatorType,
  IsoTimestamp,
  NodeId,
  Severity,
  TLP,
  Uuid,
} from "./primitives";

export const IndicatorCore = Type.Object({
  id: Uuid,
  node_id: NodeId,
  company: Company,
  type: IndicatorType,
  value: Type.String({ minLength: 1, maxLength: 512 }),
  tlp: TLP,
  description: Type.String({ default: "" }),
  severity: Severity,
  created_at: IsoTimestamp,
});
export type IndicatorCore = Static<typeof IndicatorCore>;

export const SignedIndicator = Type.Composite([
  IndicatorCore,
  Type.Object({
    signature: Ed25519Signature,
    recipients: Type.Optional(Type.Array(NodeId)),
  }),
]);
export type SignedIndicator = Static<typeof SignedIndicator>;

export const IndicatorIngestInput = Type.Object({
  type: IndicatorType,
  value: Type.String({ minLength: 1, maxLength: 512 }),
  tlp: TLP,
  description: Type.Optional(Type.String()),
  severity: Severity,
  recipients: Type.Optional(Type.Array(NodeId)),
});
export type IndicatorIngestInput = Static<typeof IndicatorIngestInput>;
