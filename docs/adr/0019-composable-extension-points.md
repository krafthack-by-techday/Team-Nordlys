# ADR-0019: Composable extension points

**Status**: Proposed — depends on ADR-0017
**Date**: 2026-05-09
**Deciders**: (leave blank — to be filled by team)

## Context

Tenet 9 (extensibility) commits Nordlys to a small core surrounded
by signed extensions with declared permissions. ADR-0017 specifies
how trust is established between the core and an extension. Neither
addresses the case where an extension itself needs to be extensible
— where a domain extension exposes an interface that other
extensions implement, forming a two-level composition rather than a
flat list of core-registered extensions.

The need arises naturally in at least five identified domains:

1. **Vulnerability management → sources.** A vulnerability extension
   owns deduplication (ADR-0015), trust-ranked merging, and CVSS
   scoring. Source extensions supply data from NVD, CISA, vendor
   advisories, or specialised OT-equipment feeds. Each source
   implements the same interface; the vulnerability extension
   enforces merge invariants regardless of which sources are active.

2. **Collector → vendor adapters.** A collector extension owns the
   YAML scenario engine (ADR-0014), syslog ingestion, and
   `(source, external_ref)` deduplication. Vendor-adapter extensions
   parse vendor-specific log formats (ABB Relion, Siemens SICAM,
   Fortinet) into the normalised structure the scenario engine
   expects.

3. **Collector → scenario packs.** The same collector extension
   point, but for detection content rather than parsing. A scenario
   pack supplies a set of YAML scenarios tuned for a specific sector
   or threat landscape. The Norwegian energy sector ships one pack;
   a health-sector deployment ships another; a peer with unusual OT
   equipment ships a third.

4. **Export → format adapters.** An export extension owns scheduling,
   filtering, and delivery mechanics. Format-adapter extensions
   transform records into regulatory or interoperability formats:
   NIS2/digitalsikkerhetsloven reporting, kraftberedskapsforskriften
   templates, STIX/TAXII bundles.

5. **Scanner → scan strategies.** A scanner extension owns job
   lifecycle, CIDR allow-list enforcement, and result emission as
   signed events through core-svc. Strategy extensions supply
   different discovery techniques: active nmap, passive traffic
   analysis, OT-specific protocol probes.

The pattern is common across all five: a **domain extension** owns
invariants, state, and a contract; **sub-extensions** implement that
contract without direct access to core-svc. The domain extension
is the single writer for its state (honouring Tenet 5); the
sub-extension supplies data or logic through the domain extension's
declared interface. The domain extension enforces its invariants
(deduplication, rate caps, allow-lists) regardless of which
sub-extensions are active, so a misbehaving or compromised
sub-extension's blast radius is bounded by the domain extension's
enforcement, not by the sub-extension's own code.

## Decision

*To be completed after team review and after ADR-0017 is closed.
The trust model for extension-of-extension composition cannot be
specified until the base extension trust model (manifest format,
capability language, signing protocol) is known.*

## Consequences

*To be completed once the Decision is made.*

## Alternatives considered

- **Flat extension model (no nesting).** Every extension registers
  directly with core-svc; there is no parent–child relationship.
  A vulnerability-source extension would submit raw reports through
  core-svc's ingestion API, and deduplication, trust-ranked merging,
  and scoring would either live in core-svc itself or be duplicated
  in every source extension. The simplest model to implement and to
  reason about. The weakness is that domain logic that belongs to
  the vulnerability concept (merge rules, trust ranking, changelog)
  either migrates into the core — violating Tenet 9's "does every
  peer need this?" test — or is duplicated across source extensions,
  creating divergence.

- **Parent-declared extension points with sub-extension manifests.**
  A domain extension declares named extension points in its own
  manifest (e.g. `extension_points: [vulnerability.source]`). A
  sub-extension declares `extends: vulnerability-plugin` and
  `implements: vulnerability.source` in its manifest. The core
  runtime validates that the parent is installed and active, that
  the declared interface exists in the parent's manifest, and that
  the sub-extension's declared permissions are a subset of what the
  parent's extension point permits. Sub-extensions communicate with
  the parent through the parent's API, never with core-svc directly.
  Stronger than the flat model because domain invariants are enforced
  once, in the parent. The cost is a richer manifest schema, a
  dependency graph the runtime must manage, and lifecycle coupling
  (parent deactivation must cascade).

- **Pure configuration in the domain extension.** The domain
  extension accepts a list of sources, adapters, or strategies as
  configuration values rather than as separate extensions. Adding a
  new source means updating the domain extension's configuration
  (or its code). Simplest lifecycle: no dependency graph, no
  sub-extension manifests, no cascade rules. The weakness is that
  new sources cannot ship independently of the domain extension,
  which defeats the purpose of the extension model for third-party
  or peer-contributed sources. An OT vendor wanting to contribute a
  parser for its own equipment format would have to upstream it into
  the domain extension rather than publishing it independently.

## Open Questions

### Group A — trust and signing (depends on ADR-0017)

- Who signs a sub-extension's manifest? The same anchor that signs
  the parent, or can the parent's publisher sign sub-extensions for
  its own extension points? If the parent publisher signs, how does
  the anchor's attestation compose — does the anchor trust the
  parent publisher's judgement for sub-extensions, or must the
  anchor co-sign?
- Can a sub-extension declare permissions that the parent does not
  itself hold? (Expected answer: no — a sub-extension's permission
  envelope is bounded by the parent's declared permissions.)
- What does an anchor signature on a sub-extension manifest attest
  to — that the sub-extension implements the parent's interface
  contract correctly, or only publisher identity and permission
  envelope?

### Group B — lifecycle

- If a parent extension is deactivated, are all sub-extensions
  deactivated automatically? (Expected answer: yes — a
  sub-extension without its parent is inoperable.)
- Can a sub-extension be installed before its parent? (Expected
  answer: no — the runtime rejects installation if the declared
  parent is absent.)
- What happens when a parent extension upgrades and changes its
  extension-point contract? Is there a version compatibility
  declaration in the sub-extension manifest? What is the operator
  experience when an upgrade breaks a sub-extension?
- What is the update ordering? Must the parent update before
  sub-extensions, or is ordering unconstrained?

### Group C — runtime and state

- How do sub-extensions communicate with the parent? Go interfaces
  compiled into the same binary, gRPC across process boundaries,
  or an in-process event bus? The choice affects isolation,
  performance, and the complexity of the capability enforcement
  from ADR-0017.
- Do sub-extensions own their own state (extension-scoped tables),
  or do they write exclusively through the parent's API? If own
  state, how is that state's lifecycle coupled to the parent's?
- Should nesting depth be limited to one level (parent →
  sub-extension, no deeper)? Unbounded depth creates a dependency
  graph whose complexity may not be justified by real use cases.
  All five identified domains require only one level.

### Group D — capability model

- Does the extension-point declaration require a new capability
  type in the permission language (e.g.
  `extension_point.declare`, `extension_point.implement`), or is
  it expressed within the existing capability model from ADR-0017?
- How is sub-extension activity audit-logged? Per sub-extension
  with its own identity in the audit trail, or aggregated under
  the parent? Tenet 8 (auditability) argues for per-sub-extension
  attribution.
- What is the maximum TLP level a sub-extension may handle? Is it
  bounded by the parent's declared TLP ceiling (Tenet 10,
  ADR-0020), or can a sub-extension declare a higher level than
  its parent? (Expected answer: bounded by parent — a
  sub-extension's TLP ceiling cannot exceed the parent's.)

### Group E — anchored to ADR-0017

This ADR cannot be closed until ADR-0017 specifies the following
three artefacts; they are listed explicitly as prerequisites:

- Manifest format.
- Capability language.
- Anchor signing protocol.

## References

- `docs/design-tenets.md` (Tenet 9, Tenet 5, Tenet 8, Tenet 10,
  Tenet 11)
- ADR-0017 (Plugin trust model) — prerequisite
- ADR-0020 (TLP v2.0 enforcement architecture) — extensions must
  declare maximum TLP level; sub-extensions bounded by parent
- ADR-0014 (YAML scenario engine with shadow mode) — collector
  as reference extension
- ADR-0015 (Trust-ranked vulnerability deduplication) — vulnerability
  management as reference extension

> **Note**: This ADR is a skeleton and depends on ADR-0017. Do not
> begin filling in the Decision and Consequences until ADR-0017 is
> closed and the manifest format, capability language, and signing
> protocol are known.
