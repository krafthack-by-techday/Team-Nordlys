import { Type, type Static } from "@sinclair/typebox";
import { Ed25519Signature, IsoTimestamp, Uuid } from "./primitives";

export const ToolManifest = Type.Object({
  id: Uuid,
  name: Type.String({ minLength: 1, maxLength: 128 }),
  version: Type.String({ pattern: "^\\d+\\.\\d+\\.\\d+" }),
  description: Type.String({ default: "" }),
  publisher: Type.String({ minLength: 1, maxLength: 128 }),
  manifest_url: Type.String({ format: "uri" }),
  manifest_hash: Type.String({ minLength: 32 }),
  signature: Ed25519Signature,
  created_at: IsoTimestamp,
});
export type ToolManifest = Static<typeof ToolManifest>;
