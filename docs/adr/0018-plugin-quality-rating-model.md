# ADR-0018: Plugin quality rating model

**Status**: Proposed — depends on ADR-0017
**Date**: 2026-05-08
**Deciders**: (leave blank — to be filled by team)

## Context

Tenet 9 (extensibility) requires every extension to be anchor-signed
before loading, and ADR-0017 specifies what that signature attests
to and how the runtime enforces declared permissions. The signature
alone does not communicate the *quality* of an extension: an
anchor-signed extension may be well-tested or barely tested,
well-documented or opaque, conservative in its capability
declarations or maximalist. An operator deciding which extensions to
enable needs a quality signal that is independent of trust.

This ADR is orthogonal to ADR-0017. Trust (signature) and quality
(rating) are two separate questions, and conflating them weakens
the trust model: a signed-but-low-quality extension would either
have to be rejected by the trust model (denying the operator the
choice) or accepted at the same level as a signed high-quality
extension (eliding a real difference). The rating exists to
communicate quality without compromising the trust model. Tenet 8
(auditability) is also relevant — the rating itself, however
issued, must be auditable in the same sense as any other
anchor-issued attestation.

Home Assistant's Integration Quality Scale is a precedent worth
noting: deterministic, code-property-based, anchor-issued, a
progression rather than a category. The HA model informs this
design but does not bind it. Sector context matters: critical
infrastructure imposes a higher floor than the consumer-electronics
context HA serves. An HA-Bronze tier appropriate for a hobbyist
temperature-sensor integration may not be appropriate for any
production Nordlys extension at all.

## Decision

*To be completed after team review and after ADR-0017 is closed.*

## Consequences

*To be completed once the Decision is made.*

## Alternatives considered

- **Numeric score (e.g. 0–100 from a weighted checklist).** Each
  checklist item contributes a weighted number; the aggregate is
  reported as a single integer. Fine grain, supports nuanced
  ranking, allows policies like "extensions below 60 require
  explicit operator override". The cost is operator cognitive load
  — a 73 versus a 71 rarely communicates a meaningful difference,
  and the weighting itself becomes a contested artefact whenever
  the checklist evolves.

- **Tiered levels (Bronze/Silver/Gold/Platinum or a
  sector-equivalent).** The rating is a small enumerated label.
  Coarser than a numeric score but quickly readable by an operator
  triaging a list of extensions; the labels carry meaning that bare
  numbers do not. Trade-off is loss of fidelity within a tier (a
  barely-Gold and a strongly-Gold are indistinguishable to the
  operator) and the ongoing question of what each tier means as the
  checklist evolves.

- **Pass/fail per checklist item with no aggregate.** The operator
  sees the full checklist with each item marked pass or fail; no
  aggregate label is presented. Most honest about what is actually
  being measured and surfaces the dimensions on which an extension
  is weak. Cost is that operators must read every checklist to
  compare two extensions, which does not scale as the catalog
  grows.

## Open Questions

### Group A — what does the rating measure?

- Code properties only (tests, static analysis, declared schema,
  documented capabilities)? Or also behavioural properties (observed
  performance, observed error rates, audit-clean operation
  history)?
- Is a sub-extension rated independently of its parent, or does the
  parent's rating bound or influence it? A high-rated domain
  extension with a low-rated sub-extension is a distinct risk
  category from two independently rated extensions. (See ADR-0019
  for the composable extension points design.)
- Is the rating a property of the extension version, the publisher,
  or both?
- How is the rating recomputed when the checklist changes? Do
  existing extensions retain their rating until they republish, or
  are they re-evaluated?

### Group B — who issues the rating, and how?

- Anchor-issued, deterministic checklist (the HA model)?
- Multi-anchor: do KraftCERT and NVE issue independent ratings, a
  joint rating, or does each operator choose which anchor's rating
  to trust?
- What is automated and what is manual? Static analysis can be
  automated; "documented capabilities" might require a human pass.
- How does the rating get communicated to the operator UI? Embedded
  in the manifest? A separate signed object? Re-fetched on demand?

### Group C — sector context

- HA's Bronze tier is acceptable for a hobbyist plugin reading a
  temperature sensor. What is Nordlys's floor? Is there a tier
  below which an extension is not deployable in production at all,
  regardless of operator wish?
- How does the rating interact with the manifest's declared
  permissions? A high-permission extension at low rating is a
  different risk category than a low-permission extension at low
  rating; should the UI or policy reflect that?

### Group D — anchored to ADR-0017

This ADR cannot be closed until ADR-0017 specifies the following
three artefacts; they are listed explicitly as prerequisites:

- Manifest format.
- Capability language.
- Anchor signing protocol.

## References

- `docs/design-tenets.md` (Tenet 9, Tenet 8)
- ADR-0017 (Plugin trust model) — prerequisite
- ADR-0019 (Composable extension points) — forward reference;
  sub-extension rating is an open question in this ADR
- Home Assistant Integration Quality Scale,
  `https://developers.home-assistant.io/docs/core/integration-quality-scale/`
  — precedent only, not normative

> **Note**: This ADR is a skeleton and depends on ADR-0017. Do not
> begin filling in the Decision and Consequences until ADR-0017 is
> closed and the manifest format, capability language, and signing
> protocol are known.
