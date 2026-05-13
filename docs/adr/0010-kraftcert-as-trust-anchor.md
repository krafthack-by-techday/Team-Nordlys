# ADR-0010: KraftCERT as trust anchor

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Every signed object on the mesh verifies against a public key, and
the value of that verification depends on knowing whose key it is.
The mesh therefore needs an authority that says "this public key
belongs to that organisation" in a form every other peer can check.
Without such an authority, a hostile actor could announce a key under
any organisation's name and start signing events as that
organisation, with no mechanism for other peers to detect the
forgery.

The Norwegian power sector has one organisation that already plays a
roughly analogous role for incident coordination: KraftCERT, the
sector CSIRT. KraftCERT is not a state regulator (NVE, RME, NSM are)
but it is the established sector trust point for cybersecurity
information. Designating it as the identity authority leverages an
existing institutional trust relationship; designating any other
single peer would either duplicate KraftCERT's role or invent a new
authority where none exists. A multi-anchor design (NVE, RME, NSM as
co-equal anchors) is the desirable end state but adds a
multi-signature identity protocol that the v1.0 timeline does not
accommodate.

This ADR assumes single-anchor (KraftCERT, v1.0); multi-anchor
support is deferred. The single-anchor framing tensions Tenet 7's
explicit call for first-class multi-anchor support, and the team
should treat this ADR as a v1.0-only narrowing rather than the
intended end state. The trust-anchor mechanism is sector-specific
and parameterizable: other sector deployments would designate their
own anchor (sector CSIRT, regulatory body, or co-equal anchor set)
under the same protocol shape. This decision serves Tenet 7
(sector-specific cyber threat sharing) by recognising KraftCERT's
existing institutional role, Tenet 1 (trust lives in signatures) by
routing every identity statement through one signer in v1.0, and
Tenet 2 (mesh continuity) by keeping the anchor off the data path so
existing peers continue when it is offline.

## Decision

A single peer in the mesh, designated by a trust-anchor role flag in
its configuration, is the sole issuer of `SignedPeerIdentity` records
and the sole signer of `Revocation` records in v1.0. Every other
peer's identity is signed by KraftCERT before it enters the mesh,
and every revocation that downstream peers honour is signed by
KraftCERT. The KraftCERT peer otherwise looks identical to every
other peer (same node stack, same Varde, same protocol). The
multi-anchor design is on the road-map but is not part of v1.0.

## Consequences

- Identity statements have a single, well-defined signer. Every
  receiving peer can verify a `SignedPeerIdentity` against
  KraftCERT's known public key without consulting any other source.
- Revocations propagate through the same gossip channel as ordinary
  mesh objects. There is no separate revocation infrastructure
  (no OCSP responder, no CRL endpoint).
- KraftCERT is not on the data path: events do not flow through
  KraftCERT, and its outage does not block ordinary operation. Only
  onboarding new peers and issuing revocations require it.
- The system is bad at the case where KraftCERT itself is
  compromised. There is no second signer to cross-check against, so
  a forged identity signed by an attacker holding KraftCERT's key
  would be accepted by every peer. The multi-anchor road-map is the
  mitigation but is not in v1.0.
- Sector politics depend on KraftCERT being acceptable to all peers
  as the trust anchor. A peer that does not recognise KraftCERT's
  authority cannot meaningfully participate.
- Inbound identity verification has a documented bootstrap
  concession: if the issuer of an arriving `SignedPeerIdentity` is
  not yet known locally, the identity is accepted self-signed.
  This is intentional for fresh nodes that have no register at all,
  but it weakens the property that "every peer was vouched for by
  KraftCERT" in the bootstrap window. The concession is a v1.0
  shortcut; closure before any production deployment is on the
  road-map.

## Alternatives considered

- **No trust anchor; web of trust.** Each peer signs the peers it
  has met out-of-band, and trust accumulates over time. Rejected
  because the sector requires a known-up-front list of legitimate
  peers, not an emergent one, and because the operational cost of
  bilateral verification across hundreds of organisations is
  prohibitive.
- **Multi-anchor (NVE, RME, NSM as co-equal anchors) from v1.0.**
  Recorded as the desired end state. Rejected for v1.0 because
  multi-signature identity records require a protocol design and
  consensus that exceeds the timeline.
- **A self-issued PKI with a CA structure.** Sector association
  operates a root CA, issuing per-peer certificates. Effectively
  the same model as KraftCERT-as-anchor but with X.509 plumbing.
  Rejected because the X.509 layer adds complexity (revocation
  via OCSP/CRL, certificate transparency considerations, CA
  ceremony) without changing the trust shape.

## References

- `app/be/services/core-svc/src/config.ts` (`role` resolution)
- `app/be/services/core-svc/src/routes/identity.ts`
  (`config.role !== "kraftcert"` guard on /invites and /revoke)
- `app/be/services/core-svc/src/routes/inbound.ts` (issuer signature
  verification, bootstrap concession on unknown issuer)
- `README.md` (legal section: multi-anchor road-map)
