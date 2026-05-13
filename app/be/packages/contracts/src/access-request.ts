import { Type, type Static } from "@sinclair/typebox";
import { NodeId, Company, Ed25519PublicKey, Ed25519Signature, IsoTimestamp } from "./primitives";

export const AccessRequestContact = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: "email" }),
  phone: Type.Optional(Type.String()),
});
export type AccessRequestContact = Static<typeof AccessRequestContact>;

export const AccessRequest = Type.Object({
  node_id: NodeId,
  company: Company,
  public_key: Ed25519PublicKey,
  contact: AccessRequestContact,
  requested_at: IsoTimestamp,
  signature: Ed25519Signature,
});
export type AccessRequest = Static<typeof AccessRequest>;
