import { Type, type Static } from "@sinclair/typebox";
import {
  Company,
  Ed25519PublicKey,
  IsoTimestamp,
  NodeId,
  SignedChatMessage,
  SignedEvent,
  SignedIndicator,
  SignedPeerIdentity,
  SignedVardeRoster,
  Revocation,
  Uuid,
  VardeId,
} from "@nordlys/contracts";

// Every message has a `seq` (per-sender monotonic counter, replay-detect)
// and an optional `corr_id` for request/response correlation.
const Envelope = Type.Object({
  seq: Type.Integer({ minimum: 0 }),
  corr_id: Type.Optional(Uuid),
});

// ── Upstream (node → Varde) ────────────────────────────────────────────────

export const HelloMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("HELLO"),
    node_id: NodeId,
    company: Company,
    public_key: Ed25519PublicKey,
    invite_token: Type.Optional(Type.String()),
    last_event_cursor: Type.Optional(IsoTimestamp),
  }),
]);
export type HelloMsg = Static<typeof HelloMsg>;

export const EventMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("EVENT"),
    event: SignedEvent,
    path: Type.Optional(Type.Array(NodeId)),
  }),
]);
export type EventMsg = Static<typeof EventMsg>;

export const IndicatorMsg = Type.Composite([
  Envelope,
  Type.Object({ type: Type.Literal("INDICATOR"), indicator: SignedIndicator }),
]);
export type IndicatorMsg = Static<typeof IndicatorMsg>;

export const ChatMsg = Type.Composite([
  Envelope,
  Type.Object({ type: Type.Literal("CHAT"), chat: SignedChatMessage }),
]);
export type ChatMsg = Static<typeof ChatMsg>;

export const PingMsg = Type.Composite([
  Envelope,
  Type.Object({ type: Type.Literal("PING") }),
]);
export type PingMsg = Static<typeof PingMsg>;

export const ResyncMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("RESYNC"),
    from_cursor: IsoTimestamp,
    channels: Type.Array(
      Type.Union([
        Type.Literal("events"),
        Type.Literal("indicators"),
        Type.Literal("chat"),
      ]),
    ),
  }),
]);
export type ResyncMsg = Static<typeof ResyncMsg>;

export const InviteValidationRequest = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("INVITE_VALIDATION_REQUEST"),
    invite_token: Type.String(),
    candidate_node_id: NodeId,
    candidate_company: Company,
    candidate_public_key: Ed25519PublicKey,
  }),
]);
export type InviteValidationRequest = Static<typeof InviteValidationRequest>;

// KraftCERT-node → Varde: response to a forwarded validation request.
// `corr_id` matches the FORWARD message the Varde sent.
export const InviteValidationResponseMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("INVITE_VALIDATION_RESPONSE"),
    accepted: Type.Boolean(),
    reason: Type.Optional(Type.String()),
    // Present only when accepted=true. The signed identity that Varde and
    // the rest of the mesh will treat as the new peer's authoritative record.
    identity: Type.Optional(
      Type.Object({}, { additionalProperties: true }),
    ),
  }),
]);
export type InviteValidationResponseMsg = Static<typeof InviteValidationResponseMsg>;

// ── Downstream (Varde → node) ──────────────────────────────────────────────

export const WelcomeMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("WELCOME"),
    accepted: Type.Literal(true),
    since_cursor: IsoTimestamp,
  }),
]);
export type WelcomeMsg = Static<typeof WelcomeMsg>;

export const RejectedMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("REJECTED"),
    reason: Type.String(),
  }),
]);
export type RejectedMsg = Static<typeof RejectedMsg>;

export const IdentityUpdateMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("IDENTITY_UPDATE"),
    identity: SignedPeerIdentity,
  }),
]);
export type IdentityUpdateMsg = Static<typeof IdentityUpdateMsg>;

export const RevocationMsg = Type.Composite([
  Envelope,
  Type.Object({ type: Type.Literal("REVOCATION"), revocation: Revocation }),
]);
export type RevocationMsg = Static<typeof RevocationMsg>;

export const VardeRosterMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("VARDE_ROSTER"),
    roster: SignedVardeRoster,
  }),
]);
export type VardeRosterMsg = Static<typeof VardeRosterMsg>;

export const PongMsg = Type.Composite([
  Envelope,
  Type.Object({ type: Type.Literal("PONG"), seq_echo: Type.Integer() }),
]);
export type PongMsg = Static<typeof PongMsg>;

// Varde → KraftCERT-tagged node: forward an incoming HELLO that carries an
// invite_token but doesn't match a known peer. The KraftCERT node validates
// the token in its local invite_tokens table and replies with an
// INVITE_VALIDATION_RESPONSE carrying the same corr_id.
export const InviteValidationForwardMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("INVITE_VALIDATION_FORWARD"),
    invite_token: Type.String(),
    candidate_node_id: NodeId,
    candidate_company: Company,
    candidate_public_key: Ed25519PublicKey,
  }),
]);
export type InviteValidationForwardMsg = Static<typeof InviteValidationForwardMsg>;

export const StateSnapshotMsg = Type.Composite([
  Envelope,
  Type.Object({
    type: Type.Literal("STATE_SNAPSHOT"),
    identities: Type.Array(SignedPeerIdentity),
    revocations: Type.Array(Revocation),
    varde_roster: SignedVardeRoster,
    generated_at: IsoTimestamp,
    signed_by: VardeId,
    signature: Type.String({
      description: "Ed25519 signature over the JCS form of the snapshot body",
    }),
  }),
]);
export type StateSnapshotMsg = Static<typeof StateSnapshotMsg>;

// ── Tagged union ───────────────────────────────────────────────────────────

export const ClientMsg = Type.Union([
  HelloMsg,
  EventMsg,
  IndicatorMsg,
  ChatMsg,
  PingMsg,
  ResyncMsg,
  InviteValidationRequest,
  InviteValidationResponseMsg,
]);
export type ClientMsg = Static<typeof ClientMsg>;

export const ServerMsg = Type.Union([
  WelcomeMsg,
  RejectedMsg,
  EventMsg,
  IndicatorMsg,
  ChatMsg,
  IdentityUpdateMsg,
  RevocationMsg,
  VardeRosterMsg,
  PongMsg,
  StateSnapshotMsg,
  InviteValidationForwardMsg,
]);
export type ServerMsg = Static<typeof ServerMsg>;
