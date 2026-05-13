import { Type, type Static } from "@sinclair/typebox";
import {
  Ed25519PublicKey,
  Ed25519Signature,
  IsoTimestamp,
} from "./primitives";

export const VardeId = Type.String({
  pattern: "^varde-[a-z0-9-]{1,32}$",
  description: "Varde identifier, e.g. 'varde-1'",
});
export type VardeId = Static<typeof VardeId>;

export const VardeIdentity = Type.Object({
  varde_id: VardeId,
  url: Type.String({ format: "uri" }),
  public_key: Ed25519PublicKey,
  registered_at: IsoTimestamp,
});
export type VardeIdentity = Static<typeof VardeIdentity>;

export const SignedVardeRoster = Type.Object({
  varder: Type.Array(VardeIdentity),
  generated_at: IsoTimestamp,
  signed_by: VardeId,
  signature: Ed25519Signature,
});
export type SignedVardeRoster = Static<typeof SignedVardeRoster>;
