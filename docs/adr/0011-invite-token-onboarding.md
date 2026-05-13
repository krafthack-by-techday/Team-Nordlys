# ADR-0011: Invite-token onboarding

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

A new peer joining the mesh has to obtain a `SignedPeerIdentity`
from the trust anchor (ADR-0010) before any other peer will accept
its events. The onboarding mechanism therefore has three jobs: it
must let the trust anchor authorise a specific candidate
out-of-band, it must let the candidate prove control of the
keypair it is registering, and it must keep the authorisation from
being usable by anyone other than the intended candidate. None of
these properties hold if the mesh accepts new identities solely on
the candidate's word, and none of them hold if onboarding requires
the trust anchor to be online for every step of every join.

This ADR assumes single-anchor (KraftCERT, v1.0); the
WS-connected-anchor parking model treats one anchor as the
validation target for any candidate. Multi-anchor support is
deferred and would generalise to "any reachable authorising anchor
for this candidate", with the anchor identity bound into the invite
token. The pre-issued-token pattern is sector-agnostic; the specific
anchor identity (KraftCERT here) is sector-specific and
parameterizable per deployment. This decision serves Tenet 7
(sector-specific cyber threat sharing) by routing onboarding through
the designated trust anchor, Tenet 2 (mesh continuity) by keeping
the mesh operational when the anchor is offline (only onboarding
pauses), and Tenet 8 (auditability) by recording every authorisation
as a signed identity rather than a side-channel approval.

## Decision

The trust anchor issues a single-use invite token (256 bits of
entropy, 1-hour validity, hashed at rest in the database) bound to
a specific company name. The candidate node, on its first
connection, presents the token in its HELLO frame together with
its public key and company name. The Varde finds a connected
trust-anchor session, forwards the validation request, and parks
the candidate's connection (5-minute TTL) until the anchor
responds. The trust anchor verifies the token, confirms the
company-name binding, signs a `SignedPeerIdentity`, and returns it.
The Varde delivers the identity to the candidate and broadcasts an
`IDENTITY_UPDATE` to every other connected node.

## Consequences

- Token entropy and the hash-at-rest property mean a database
  breach does not yield usable tokens. The 1-hour TTL bounds the
  window between token issuance and use; an intercepted token
  expires before most attackers could use it for sustained access.
- Single-use semantics prevent token replay. A token consumed by
  one node cannot be used to register a second one.
- Company-name binding prevents a token leaked or shared to the
  wrong recipient from being redeemed under a different
  organisation's name.
- The protocol depends on the trust anchor being currently
  WS-connected to the same Varde as the candidate. If the anchor
  is offline, the Varde returns `kraftcert_offline_retry_later`
  and the candidate retries. There is no asynchronous queue that
  would accept the request and complete it later.
- Cross-Varde invite forwarding is not implemented in v1.0. The
  candidate must connect to the trust anchor's own DMZ Varde
  during initial onboarding, then switch back to its own Varde
  once the identity has propagated. This is operationally
  awkward and is on the road-map.
- The pre-shared-token model places a manual step in every
  onboarding (the trust anchor operator generates and delivers a
  token through some other channel). At the design scale of
  hundreds of peers this is a one-time cost per peer, but it
  scales linearly with onboarding rate.

## Alternatives considered

- **Self-registration with anchor approval afterwards.** The
  candidate registers without a token; the anchor reviews and
  signs later. Rejected because the candidate would temporarily
  hold an unsigned identity and the mesh would have to track and
  later upgrade it. The state machine is more complex than the
  pre-issued-token model with no security gain.
- **Out-of-band public-key whitelist on the trust anchor.** The
  anchor maintains a list of approved keys and signs any
  candidate whose key matches. Rejected because the operator
  still has to communicate the key (so the cost is the same as
  passing a token) and the lack of a TTL means a leaked key
  remains usable until manually removed.
- **A web-of-trust model where existing peers can vouch.** A new
  peer joins by gathering signatures from N existing peers.
  Rejected because it diffuses responsibility for vetting across
  every peer rather than concentrating it on the designated
  authority, and the sector has chosen a single authority model
  (ADR-0010).

## References

- `app/be/services/core-svc/src/repos/invites.ts` (token format,
  TTL, hash storage)
- `app/be/services/core-svc/src/routes/identity.ts` (`/invites`,
  `/register`)
- `app/be/services/varde-svc/src/ws-handler.ts` (HELLO with
  invite token, parking, forward)
- `app/be/services/varde-svc/src/pending-invites.ts` (parked-
  candidate store, 5-minute TTL)
- `app/be/README.md` ("How a new node onboards" section)
