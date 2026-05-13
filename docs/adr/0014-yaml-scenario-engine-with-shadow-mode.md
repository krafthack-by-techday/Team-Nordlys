# ADR-0014: YAML scenario engine with shadow mode

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Raw OT logs (syslog from RTUs, vendor-specific formats, SIEM
webhooks) carry too much detail and too little structure to be
useful as mesh events directly. Each peer needs a layer that decides
what is interesting, classifies it by severity, and emits a small
number of structured events that other peers can act on. The
classification logic has to be authored by people who know the
domain (security analysts and OT engineers) and reviewed by people
who do not necessarily read the implementation language. A new
classification rule has to be deployable on a live system without
the risk that a bad rule floods the mesh with false-positive events
that other peers then have to triage.

The scenario engine is sector-agnostic; the scenario library content
is sector-specific and parameterizable per deployment. This decision
serves Tenet 6 (operational realism) by giving new rules a shadow
path before they affect the mesh, and Tenet 3 (bounded fanout) by
holding rate caps at the signing layer rather than letting one rule
saturate the channel.

## Decision

The collector service holds a library of YAML scenarios. Each
scenario declares an id, a severity, an optional shadow flag, a
list of matchers (field path plus one of `contains`, `equals`, or
`regex`), and optional title and description templates with
field-path interpolation. All matchers in a scenario must hold for
the scenario to fire (AND-logic, no OR). When a scenario fires in
non-shadow mode, the collector forwards the resulting structured
event to core-svc for signing and persistence. When a scenario
fires in shadow mode (either set on the scenario or globally), the
match is logged locally and the event is dropped before signing.

## Consequences

- Scenarios are reviewable by people who do not read the
  implementation language. A YAML file with named matchers is
  closer to a detection rule than to code.
- New scenarios can be deployed in shadow mode and observed
  against live traffic before going public to the mesh, which
  means a rule with too-broad matching does not generate
  false-positive mesh events while it is being tuned.
- The matching engine is small and predictable: AND-logic, first
  match wins, no scripting, no expression language. There is no
  scenario whose behaviour depends on knowing how the engine
  evaluates short-circuits or operator precedence.
- The engine cannot express OR-logic without splitting a scenario
  into multiple files. A rule that wants to match either of two
  patterns has to be written twice; this duplicates the title and
  severity declaration.
- There is no signature on scenario YAML. A peer that compromises
  a node's filesystem can add or modify scenarios silently. The
  road-map mentions signed scenario packs (the data model
  supports it; the loader does not yet enforce it).
- Rate caps are per-severity at the signing layer, not per-
  scenario at the matching layer. A scenario that fires often
  consumes the severity budget for all other scenarios at the
  same severity. Per-scenario rate caps are on the road-map.

## Alternatives considered

- **Sigma rules (industry-standard detection format).** A more
  expressive, more standard format. Rejected for v1.0 because the
  full Sigma matcher set is a much bigger implementation, and
  because a smaller bespoke format lets the collector own its
  own field-path conventions for OT data.
- **In-process scripting (Lua, JavaScript).** Maximum
  expressiveness; can also enforce per-rule rate caps in the
  rule. Rejected because untrusted rules in a privileged process
  is a sandbox problem the project does not need to take on.
- **External rule engine** (Sigma converter, Drools). Rejected
  because the operational cost of a separate engine is not
  justified by the scenario complexity in v1.0.

## References

- `app/be/services/collector-svc/src/scenarios.ts`
- `app/be/services/collector-svc/src/routes/ingest.ts`
- Sigma project, `https://github.com/SigmaHQ/sigma` (for
  comparison only).
- ADR-0019 (Composable extension points) — identifies vendor
  adapters and scenario packs as sub-extension use cases for the
  collector extension.
