import { Type, type Static } from "@sinclair/typebox";
import {
  Company,
  Ed25519PublicKey,
  Ed25519Signature,
  IsoTimestamp,
  NodeId,
} from "./primitives";

export const PeerIdentity = Type.Object({
  node_id: NodeId,
  company: Company,
  public_key: Ed25519PublicKey,
  registered_at: IsoTimestamp,
  registered_by: Type.String({
    description: 'Issuer node_id, e.g. "kraftcert" or "self"',
  }),
});
export type PeerIdentity = Static<typeof PeerIdentity>;

export const SignedPeerIdentity = Type.Composite([
  PeerIdentity,
  Type.Object({
    signature: Ed25519Signature,
    signed_by: NodeId,
  }),
]);
export type SignedPeerIdentity = Static<typeof SignedPeerIdentity>;

/** SignedPeerIdentity enriched with server-side status metadata (not part of the signed payload). */
export const PeerWithStatus = Type.Composite([
  SignedPeerIdentity,
  Type.Object({
    last_seen_at: Type.Optional(IsoTimestamp),
  }),
]);
export type PeerWithStatus = Static<typeof PeerWithStatus>;

export const Revocation = Type.Object({
  node_id: NodeId,
  company: Company,
  revoked_at: IsoTimestamp,
  reason: Type.String({ default: "" }),
  signed_by: NodeId,
  signature: Ed25519Signature,
});
export type Revocation = Static<typeof Revocation>;

export const InviteToken = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 128 }),
  company: Company,
  expires_at: IsoTimestamp,
});
export type InviteToken = Static<typeof InviteToken>;

export const InviteRedemption = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 128 }),
  node_id: NodeId,
  company: Company,
  public_key: Ed25519PublicKey,
});
export type InviteRedemption = Static<typeof InviteRedemption>;
