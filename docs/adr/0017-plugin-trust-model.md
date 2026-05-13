# ADR-0017: Plugin trust model

**Status**: Proposed — blocked on external clarifications
**Date**: 2026-05-08
**Deciders**: (leave blank — to be filled by team)

## Context

Tenet 9 (extensibility) commits Nordlys to "signed extensions with
declared, reviewed permissions" but does not specify the signing
protocol, the permission language, or the runtime enforcement
mechanism — those are this ADR's scope. The decision required is
concrete: how is trust established for an extension before its code
is loaded into a Nordlys node? What does an anchor's signature on an
extension manifest attest to, and how is that attestation enforced
at runtime?

This ADR operates within the constraints of Tenet 1 (trust lives in
signatures, not in transport) and Tenet 7 (sector-specific authority
with multi-anchor support). Multi-anchor signing is in scope for
this ADR; the v1 starting point is single-anchor with KraftCERT
only. The choices made here will determine how plugin trust composes
with mesh trust rather than replacing it.

## Decision

*To be completed after team review and external clarifications. This
ADR is currently a skeleton capturing the open questions.*

## Consequences

*To be completed once the Decision is made.*

## Alternatives considered

- **Anchor-signed manifest only, runtime trusts manifest contents.**
  The manifest declares the extension's capabilities and required
  permissions; the signature attests publisher identity and anchor
  approval; the runtime loads the extension and treats it as
  operating within the declared envelope. The simplest model to
  implement and to audit; the trust boundary is the manifest
  signature alone. The weakness is that runtime behaviour is assumed
  to match declarations with no mechanical enforcement against drift,
  bug, or compromise.

- **Anchor-signed manifest plus runtime capability enforcement
  against declared permissions.** The manifest declares capabilities;
  the runtime enforces them at every privileged call site, so an
  extension cannot reach an undeclared capability even if its code
  attempts to. Stronger than manifest-only because behaviour is
  constrained at runtime, not on paper alone. Requires a designed
  capability model — a list of named capabilities, a grant
  mechanism, and discipline to insert checks at the correct
  boundaries. Implementation cost is higher; the gain is that a
  misbehaving or compromised extension's reach is bounded by its
  declarations.

- **Anchor-signed manifest plus runtime sandbox isolation.** The
  extension runs in a sandboxed execution environment (separate
  process, language sandbox, or container) such that its access to
  host resources is mediated by the runtime regardless of declared
  capabilities. The strongest enforcement model and the most
  language-agnostic. Implementation cost is the highest — sandbox
  engineering, inter-boundary call mechanics, performance overhead
  for every boundary crossing. Suitable when the threat model
  includes a compromised extension whose code cannot be trusted to
  honour the capability checks of the previous option.

## Open Questions

This section is the substance of the skeleton. Questions are grouped
by who needs to be in the conversation; the order in which
conversations happen follows the group order.

### Group A — questions for KraftCERT (and NVE, when multi-anchor is in scope)

- What does an anchor signature on an extension manifest attest to?
  (Identity of publisher? Code review by anchor? Permission set is
  reasonable? All three?)
- What is the anchor's review process for a candidate extension?
  Who does the review? What happens when the anchor disagrees with
  a publisher's permission declaration?
- What is the anchor's capacity for review at scale? Is there an
  automated component, or is every signature manually authorised?
- How is signing-key compromise handled? Is there a sub-key model,
  or does anchor compromise invalidate every previously signed
  extension?
- In multi-anchor: can NVE and KraftCERT sign different sets of
  extensions, or must they agree? What does "co-equal" mean
  specifically for extension signing?

### Group B — questions for the implementation team (primarily backend lead)

- What is the capability/permission language? A list of named
  capabilities (`event.read`, `indicator.publish`, `outbound.http`,
  `ui.render`), or a more structured grant model?
- How are declared permissions enforced at runtime? Code-level
  capability checks at every privileged call site, or runtime
  isolation (process boundary, sandbox)? What is the cost of each
  in the Go-port architecture?
- What does extension lifecycle look like? Install, enable, disable,
  update, revoke, uninstall — which transitions require operator
  confirmation, which are automatic on a signed-manifest update?
- How does the audit log record extension activity in a form that
  Tenet 8 satisfies? (Per-extension call log, or audit at the
  capability boundary?)
- How do extensions handle their own state without violating
  Tenet 5? Specify the boundary: extension-owned tables, core-svc
  forwarded writes, or both?
- How does the trust model extend to sub-extensions — extensions
  that implement an interface declared by a parent extension
  rather than registering directly with core-svc? Can a parent
  publisher sign sub-extension manifests for its own extension
  points, or must the anchor sign every sub-extension
  independently? (See ADR-0019 for the composable extension
  points design.)

### Group C — questions that can only be answered after Group A and B

- What is the manifest format? (Will be specified in a follow-up
  ADR.)
- What is the wire format for gossiping extension manifests across
  the mesh?
- What is the rating model that operates on top of this trust
  model? (Forward reference to ADR-0018.)

## References

- `docs/design-tenets.md` (Tenet 9, Tenet 1, Tenet 7, Tenet 10,
  Tenet 11)
- ADR-0019 (Composable extension points) — forward reference;
  extends the trust model to parent–sub-extension composition
- ADR-0020 (TLP v2.0 enforcement architecture) — extension
  manifests must declare maximum TLP level
- ADR-0021 (RBAC) — extension permissions interact with operator
  clearance
- The "Plugin System for Nordlys" planning document (`TODO.md`) as
  historical context only — the plan predates Tenet 9 and predates
  the formal trust-model design.

> **Note**: This ADR is a skeleton. The Decision and Consequences
> sections will be filled in after the open questions in Group A
> are resolved with the trust anchors and Group B is resolved with
> the implementation team. ADR-0018 depends on this ADR; do not
> begin ADR-0018 until at least Group A is closed.
