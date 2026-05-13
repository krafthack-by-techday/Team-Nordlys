import { Type, type Static } from "@sinclair/typebox";
import { IsoTimestamp, Uuid, StringEnum } from "./primitives";

export const ScanStatus = StringEnum(["queued", "running", "completed", "failed"] as const);
export type ScanStatus = Static<typeof ScanStatus>;

export const ScanRequest = Type.Object({
  targets: Type.Array(
    Type.String({ description: "CIDR or hostname; must match policy whitelist" }),
    { minItems: 1, maxItems: 64 },
  ),
  ports: Type.Optional(Type.String({ description: "nmap port spec, e.g. '1-1024'" })),
  profile: StringEnum(["quick", "standard", "deep"] as const),
});
export type ScanRequest = Static<typeof ScanRequest>;

export const Scan = Type.Object({
  id: Uuid,
  request: ScanRequest,
  status: ScanStatus,
  created_at: IsoTimestamp,
  started_at: Type.Optional(IsoTimestamp),
  completed_at: Type.Optional(IsoTimestamp),
  result_summary: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});
export type Scan = Static<typeof Scan>;
