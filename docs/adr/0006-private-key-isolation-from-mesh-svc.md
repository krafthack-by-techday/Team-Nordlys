# ADR-0006: Private key isolation from mesh-svc

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

The node holds a long-lived asymmetric keypair that signs every event,
indicator, chat message, and peer-identity record originating from
that node. The signature is the basis of cross-mesh trust: a peer
believing an event came from this node depends entirely on the
signature verifying against the public key in the local identity
register. The private key is therefore the most security-critical
asset on the node.

Several processes on the node have legitimate reasons to be involved
with signed objects. The mesh transport service holds open WebSocket
connections to publicly-reachable Vardes, which makes it the most
network-exposed process on the node. A compromise of that service is
the most likely attacker entry point. If the same process also held
the signing key, the attacker would gain the ability to forge events
in the node's name across the entire mesh, with downstream effects
that no per-event verification could catch.

The decision is anchor-agnostic: a peer's own signing key is held
locally regardless of how many trust anchors exist externally. This
decision serves Tenet 1 (trust lives in signatures) by ensuring the
most network-exposed process cannot forge a signature, and Tenet 5
(one writer per responsibility) by giving the signing key one process
to audit and rotate.

## Decision

The private key is loaded by exactly one service (core-svc) and is
never transmitted, exported, or referenced by any other process.
Signing happens at the point of persistence inside that service:
incoming candidates are canonicalised under JCS, signed, and inserted
in one code path. Already-signed objects flow outward as opaque
blobs; the mesh transport service receives a complete
`{ ...fields, signature }` object and forwards it without ever
seeing the private key.

## Consequences

- Compromise of the mesh transport service does not yield signing
  capability. The attacker can drop or duplicate frames but cannot
  forge an object that another peer will trust.
- The signing key has one storage path (env var, then filesystem,
  then ephemeral dev fallback) and one process to audit. Key
  rotation procedures only need to consider one process.
- Mesh transport cannot re-sign or re-canonicalise objects in
  flight. If the canonicalisation rules change, the change has to
  cross both the signing service and every verifier; there is no
  shortcut where the network layer normalises objects.
- The architecture forces an extra HTTP hop on the publish path:
  the producing service forwards to the signer, the signer forwards
  to the transport. At node scale this is sub-millisecond but it is
  more failure surface than a single in-process call.
- Operationally, the rule "only one service touches the key" is
  easy to state but only enforced by code review. There is no
  language-level capability that prevents a future change from
  importing the keystore into another service. The discipline
  depends on contributors knowing the rule.

## Alternatives considered

- **Sign at the transport layer (mesh-svc holds the key).** Avoids
  an HTTP hop and centralises mesh-related code. Rejected because
  the most network-exposed process would also be the most
  privileged, which inverts the principle of least privilege.
- **Hardware security module for the private key.** All signing
  goes through an HSM via PKCS#11 or similar. A reasonable end-state
  for a production deployment but not feasible for a hackathon
  proof-of-concept. Recorded on the road-map; out of scope here.
- **Ephemeral per-session keys.** Each WS session uses a freshly
  generated key signed by a long-lived identity key. Rejected
  because it does not solve the underlying problem (the long-lived
  key still has to live somewhere) and adds a session-key issuance
  protocol with its own surface area.

## References

- `app/be/services/core-svc/src/keystore.ts`
- `app/be/services/core-svc/src/routes/events.ts` (signing point)
- `app/be/services/core-svc/src/mesh-publish.ts` (signed object
  forwarded to mesh-svc as an opaque blob)
- `app/be/services/mesh-svc/src/routes/publish.ts` (mesh-svc receives
  signed object, never the key)
