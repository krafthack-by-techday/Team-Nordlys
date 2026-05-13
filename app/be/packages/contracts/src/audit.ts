import { Type, type Static } from "@sinclair/typebox";
import { IsoTimestamp, Uuid, StringEnum } from "./primitives";

export const AuditOutcome = StringEnum(["allowed", "denied", "error"] as const);
export type AuditOutcome = Static<typeof AuditOutcome>;

export const AuditLogEntry = Type.Object({
  id: Uuid,
  ts: IsoTimestamp,
  actor: Type.String({
    description: "API key name, user id, or 'anonymous'",
  }),
  method: Type.String(),
  path: Type.String(),
  status_code: Type.Integer(),
  outcome: AuditOutcome,
  ip: Type.Optional(Type.String()),
  duration_ms: Type.Integer(),
  detail: Type.Optional(Type.String()),
});
export type AuditLogEntry = Static<typeof AuditLogEntry>;
