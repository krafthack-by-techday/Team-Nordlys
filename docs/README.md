# Nordlys — Technical Introduction

**Audience**: Developers joining the project, technical leads evaluating
the architecture, anyone who wants to understand what Nordlys does and
how it thinks before reading 14 tenets and 24 ADRs.

**Reading time**: 5 minutes.

---

## What is Nordlys?

When a coordinated cyber-attack hits multiple Norwegian power companies
at once, the status quo is phone calls, Teams messages, and 30–60
minutes before anyone notices the pattern. A central reporting platform
would fix the speed problem but create a new one: it is a single point
of failure and a high-value target for the same adversaries.

Nordlys is the alternative. Every organisation runs its own node, signs
its own observations with its own cryptographic key, and shares them
across a peer-owned relay network. There is no central server. The mesh
keeps working even if the trust anchor (KraftCERT) goes offline. Scale
target: 400 peers across the Norwegian energy sector.

---

## How it works — the 60-second version

Imagine Hafslund detects a brute-force attack against an ABB Relion
relay:

1. Hafslund's **collector** picks up the alert from their SIEM.
2. The local **core service** signs it with Hafslund's Ed25519 private
   key (JCS-canonicalised, TLP:GREEN by default).
3. The signed event goes to Hafslund's **Varde** — a relay in
   Hafslund's own DMZ.
4. The Varde **gossips** the event to ~10 random peer Vardes (bounded
   gossip, not all 399). Peers pull missed events and push on
   receive — a pull-first protocol with eager forwarding.
5. Within 3–4 gossip rounds (~25 seconds), all 400 Vardes have it.
6. Every receiving node **verifies the signature** against the
   identity register before showing it to operators.

```
  Hafslund (internal)          Hafslund (DMZ)           Internet
 ┌──────────────────┐        ┌──────────┐
 │ collector → core │──WS──→ │  Varde   │ ──push──→  10 random Vardes
 │ (signs event)    │        │ (relays) │ ←─pull──   (verify, re-push,
 │ frontend ← api   │        └──────────┘            converge in ~25s)
 └──────────────────┘
```

The signing key never leaves the internal zone. The Varde — the only
internet-facing component — holds no keys and can forge nothing. If a
Varde is compromised, it can drop traffic but cannot create fake events.

---

## Example 2: TLP:RED — encrypted delivery to named recipients

KraftCERT receives intelligence about an active APT campaign targeting
two specific utilities. This is TLP:RED — only Hafslund and Statkraft
may see it.

1. KraftCERT operator creates an indicator with `tlp: RED` and
   `recipients: [hafslund_node_id, statkraft_node_id]`.
2. Core-svc validates the invariant: RED requires non-empty recipients.
   Signs the indicator.
3. Core-svc **encrypts** the signed indicator into a sealed envelope:
   generates a random symmetric key, encrypts the indicator, then
   encrypts that key separately for each recipient using X25519 key
   agreement (derived from their Ed25519 public keys). Pads to 7 slots
   so an observer cannot tell if there are 2 or 7 recipients.
4. Mesh-svc looks up recipient Vardes in the roster and delivers the
   envelope via **direct HTTP POST** — not through gossip.
5. Hafslund's Varde receives the envelope, cannot decrypt it (holds no
   keys), forwards it to Hafslund's node over WebSocket.
6. Hafslund's core-svc decrypts (finds its slot in the 7-slot array),
   verifies the inner Ed25519 signature, confirms its own `node_id` is
   in `recipients`. Stores the indicator.
7. **Glitrenett never sees anything.** No envelope, no ciphertext, no
   metadata about its existence — it was never sent there.
8. Even if an envelope were misrouted (bug, compromised relay), the
   content is encrypted — only Hafslund and Statkraft can decrypt.
9. Within Hafslund: only operators with RED clearance (ADR-0021) see
   the indicator. A GREEN-cleared analyst sees nothing.

This is **three layers of protection**: routing (never sent to
non-recipients), encryption (unreadable even if misrouted), and RBAC
(invisible to under-cleared operators within the organisation).

---

## Five concepts you need

| Concept | One sentence |
|---|---|
| **Node** | Your organisation's backend stack — holds the signing key, stores events, runs the dashboard. Lives inside the firewall. |
| **Varde** | Your organisation's relay in the DMZ. Internet-facing, but it only relays and verifies — it never signs or decrypts. |
| **KraftCERT** | The trust anchor that issues identities for new peers. A peer like any other; the mesh runs without it. |
| **Signature** | Every event is Ed25519-signed over its JCS-canonical form. Trust is in the signature, not in which channel delivered it. |
| **TLP** | Traffic Light Protocol (FIRST v2.0). RED/AMBER/GREEN/CLEAR — enforced cryptographically at every boundary, not as a suggestion. |

Full glossary: [CONCEPTS.md](CONCEPTS.md).

---

## Design tenets — the "why" behind every decision

Before the ADRs, there are the **tenets**: 14 foundational principles
that describe what the architecture values. When two developers disagree
about an implementation, the tenets usually resolve it.

| # | Name | One-liner |
|---|---|---|
| 1 | Trust lives in signatures | Every layer is untrusted; the signature is authority. |
| 2 | Mesh continuity | No single actor's failure stops the mesh. |
| 3 | Bounded fanout | Every propagation path has an explicit upper bound. |
| 4 | Convergence over delivery | Idempotent, deduped, order-independent. |
| 5 | One writer per responsibility | Single owner of each state mutation. |
| 6 | Operational realism | Design for real failures, not textbook ones. |
| 7 | Sector-specific | One tool, one sector, one trust model. |
| 8 | Auditability is a precondition | If it can't be audited, it doesn't ship. |
| 9 | Core is what every peer needs | Everything else is an extension. |
| 10 | Distribution is access control | TLP is enforced, not advisory. |
| 11 | Least privilege by default | Default is deny. Elevation is explicit and logged. |
| 12 | Idempotent identity | Object identity from content, not DB sequences. |
| 13 | Privilege inversely proportional to exposure | Signing keys are in the least-reachable component. |
| 14 | Canonical form is the signature's substrate | One byte-level representation, no unsigned fields in signed objects. |

Full text with explanations, violations, and conflict-resolution
guidance: [design-tenets.md](design-tenets.md).

---

## Architecture Decision Records (ADRs)

ADRs document specific choices — the decision, its consequences
(including what it makes harder), and the alternatives that were
rejected. They outlive the code: an engineer porting the system should
use them as the design reference.

**Grouped by area:**

| Area | ADRs |
|---|---|
| **Mesh & transport** | 0001 (topology), 0002 (WebSocket), 0003 (rendezvous hash), 0004 (top-N), 0007 (bootstrap), 0008 (resync), 0009 (anti-entropy), 0016 (health-aware), **0023 (bounded gossip)**, **0024 (direct delivery + encryption)** |
| **Trust & identity** | 0005 (single writer), 0006 (key isolation), 0010 (trust anchor), 0011 (onboarding) |
| **Data & storage** | 0012 (partitioning), 0013 (contracts), 0015 (vuln dedup) |
| **Extensions** | 0014 (scenario engine), 0017 (plugin trust), 0018 (quality rating), 0019 (extension points) |
| **Security & access control** | **0020 (TLP enforcement)**, 0021 (RBAC), **0022 (correlation)** |

Full grouped index: [adr/README.md](adr/README.md).

---

## Recommended reading order

1. **This document** — you are here.
2. **[design-tenets.md](design-tenets.md)** — the 14 principles.
   Read all of them; they are short.
3. **[architecture-overview.md](architecture-overview.md)** — the
   system in five pages.
4. **[CONCEPTS.md](CONCEPTS.md)** — the glossary. Skim; return when
   a term is unclear.
5. **[adr/](adr/README.md)** — individual decisions. Read the ones
   relevant to your work.

The reverse order is a mistake. Start from principles, then
structure, then details.
