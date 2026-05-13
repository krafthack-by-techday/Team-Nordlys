# Design Tenets — Nordlys

## What this document is

These are the foundational design principles that generated every architectural decision in Nordlys. They precede the ADRs in importance and in time: the ADRs answer specific questions ("which hashing scheme for Varde selection?"); these tenets describe the disposition that makes one answer feel right and another feel wrong.

Tenets change rarely. When they do, the change is itself an architectural event that should be deliberate and visible. Most ADRs will reference one or more tenets in their "Context" section; that is the intended use.

## How to use these tenets

**Reviewing a pull request.** If a change feels wrong but you cannot articulate why, walk through the fourteen tenets. Most disagreements about implementation collapse into a clear answer once you ask "which tenet does this serve, and which does it strain?"

**Writing a new ADR.** Reference at least one tenet in the Context section. If a decision has no relationship to any tenet, either you have not articulated the decision precisely, or you have discovered something the tenets do not yet cover — both are useful to surface.

**Adding a new feature.** Run it past the fourteen "What would violate this" sections at the end of each tenet. If the feature violates one, you do not necessarily need to abandon it — but you do need to document the tension and decide explicitly.

**Onboarding a new contributor or auditor.** Read this document first, the architecture overview second, the ADRs third. The reverse order is a common mistake.

---

## 1. Trust lives in signatures, not in transport

**Statement.** Every object that crosses a trust boundary is signed at its origin. Verification happens on receipt, never inferred from where the object came from.

**What it means.** Every layer between an origin and a final consumer is treated as untrusted: relays, peer hubs, our own internal services, even the local database during replication. The signature is the only thing that grants an object authority. This is what allows the transport to be replaced, an intermediate hub to be compromised without the mesh losing integrity, and a peer to relay events on behalf of others without inheriting their authority. Trust is a property of the object, not of the path it traveled.

**What would violate this.** Any path where an object's authority comes from "this arrived through the right channel" rather than "this signature verifies against a known identity." Any code that skips verification on the assumption that the previous hop already verified. Any in-band metadata that influences trust decisions but is not itself signed.

**Current implementation evidence.** Events, indicators, chat messages, identities, and revocations are all signed at origin. Verification happens both at relay ingress and at node ingest (`core-svc /inbound/*` re-verifies even though the relay already verified). The mesh service never holds private keys — it only carries already-signed objects. STATE_SNAPSHOT contents are re-verified individually rather than trusted because the snapshot was delivered.

---

## 2. Mesh continuity does not depend on any single actor

**Statement.** The mesh continues to operate when any single component goes down, including any single trust anchor.

**What it means.** Distinguish between *mesh continuity* (the existing peers continue exchanging events, verifying signatures, and operating as a coordinated whole) and *mesh growth* (the ability to onboard new peers). Continuity is resilient by design. Growth is deliberately gated by the trust anchors. A new peer cannot join while all anchors are offline; this is correct, not a gap. The boundary between these two categories is the line we defend.

In a deployment with multiple co-equal trust anchors (see Tenet 7), this property strengthens further: existing peers continue operating when any subset of anchors is offline, and new-peer onboarding remains possible as long as at least one anchor is reachable, subject to the deployment's anchor-governance rules.

**What would violate this.** Any new feature that requires a specific trust anchor to be online for existing peers to keep operating. Any state that has a single home and no replication path. Any operation whose failure mode is "the whole sector is offline because one component is down."

**Current implementation evidence.** Top-N tunnels per node ensure that losing any single relay does not isolate the node. Health-aware tunnel selection deprioritizes failing relays without excluding them. Anti-entropy pull at the relay layer means peer-relays recover from outages without coordination. Onboarding stops cleanly when no trust anchor is reachable (`kraftcert_offline_retry_later` rejection in the v1 single-anchor case), but already-onboarded peers are unaffected.

---

## 3. Bounded fanout, always

**Statement.** Every message-propagation path has an explicit upper bound. Unbounded broadcast is a design bug, not an optimization opportunity.

**What it means.** Distributed systems fail not when one component breaks, but when one broken component amplifies. The hardest incidents to recover from are those where a single misbehaving peer or a single malformed event saturates the network. Every propagation primitive in Nordlys bounds itself: how many hubs a node connects to, how many hops an event travels, how many events a peer can emit per minute. The default for a new propagation primitive is "what is the upper bound?" — answering "there isn't one" is the answer that needs to change, not the question.

**What would violate this.** A propagation primitive whose work scales with mesh size unbounded. A "broadcast and let the receivers deduplicate" pattern at scale. Removing a rate cap because "it has not been hit yet." Allowing relayed traffic to fan out without a hop limit.

**Current implementation evidence.** Top-N (default 3) tunnels per node rather than all-known. Optional `recipients` list on events for unicast and multicast distribution. Hop counter on relayed events. Per-node rate cap at relay ingress. Per-scenario rate cap at the collector layer (source × scenario_id × severity). Frequency reduction for repeatedly-failing peer-relays.

---

## 4. Convergence over guaranteed delivery

**Statement.** The system assumes messages will be duplicated, reordered, and delayed, and recovers from all three without special-case logic.

**What it means.** Guaranteeing exactly-once or strict-order delivery in an open mesh across organizational boundaries has a cost we are not willing to pay, and offers little in return for our use case. Instead, every operation is idempotent. Duplicates are deduplicated by UUID. Late events are handled by cursor-based catch-up. Order, where it matters, is reconstructed at consumption time, not transmission time. This is what makes RESYNC trivial, partition healing automatic, and relay failures invisible to event consumers.

**What would violate this.** Any feature that depends on causal order between events originating at different peers. Any operation that is not idempotent under retry. Any logic that requires a peer to have seen event A before processing event B. Any "exactly-once" claim that is not implemented as "at-least-once with idempotency at the boundary."

**Current implementation evidence.** UUID-based deduplication at the database layer for every gossiped object type. Cursor-based pull (`/events/since/{cursor}`) for catch-up after disconnect. Anti-entropy in peer-gossip is chatty by design — duplicates are expected and dropped at the dedup layer. RESYNC is invited unconditionally after WELCOME, never assumed unnecessary.

---

## 5. One writer per responsibility

**Statement.** Every piece of state has exactly one component that owns mutations. Other components observe or forward; they never write directly.

**What it means.** Concurrency is hard. Concurrency across services is harder. Concurrency across services in a security-critical context is unauditable. We collapse the question by giving each kind of state a single writer. The trust boundary becomes one process to audit, not a shifting line across many. The cost is some forwarding overhead and one extra hop on the write path; the gain is that "what code can mutate this state?" has one answer per state, always.

**What would violate this.** A service that maintains its own copy of state owned by another. A shared mutation path between two processes. Scattering signature verification logic across multiple modules. Allowing the relay layer to write to the database directly because "it's faster."

**Current implementation evidence.** The core service is the only writer to the local database. The mesh service receives wire frames and forwards verified payloads to the core service's `/inbound/*` endpoints; it never writes locally. The node's private key is loaded only by the core service; the mesh service requests the public key for handshake purposes. The cryptography package is the only location of signing and verification logic.

---

## 6. Operational realism over theoretical purity

**Statement.** Design against how systems actually fail in production, not how they fail in textbooks.

**What it means.** Tunnel-flapping under noisy health signals is a real failure mode. Health metrics are noisy. New detection rules contain bugs. Misconfigured peers loop. Operators do not have time to tune dozens of parameters per deployment. Every operational primitive in Nordlys is a response to a real production failure mode that someone, somewhere, has lived through. Removing one of them in pursuit of a cleaner abstraction is not refactoring — it is forgetting.

**What would violate this.** A change that optimizes a benchmark at the expense of a known failure mode. A change that requires per-deployment parameter tuning to avoid a pathology already mitigated. Removing hysteresis because "the metric is stable in our test environment." Treating shadow-mode or rate-limiting as cruft.

**Current implementation evidence.** Sticky bonus and swap cooldown prevent tunnel-flapping under noisy health signals. Shadow mode for new collector rules — rules log locally without gossiping until they are proven. Per-scenario rate cap protects the mesh from a single misconfigured peer in a loop. Health-aware tunnel selection deprioritizes failing relays but never excludes them; degraded is better than disconnected. Frequency reduction (rather than blocking) for repeatedly-failing peer-relays.

---

## 7. The system is built for sector-specific cyber threat sharing

**Statement.** The architecture reflects sector-specific authority, topology, threat model, and trust. The first deployment is for the Norwegian energy sector. The same architecture can be instantiated for other sectors as separate deployments, and a single deployment can have one or more co-equal trust anchors reflecting the actual authority structure of its sector.

**What it means.** Generic distributed-systems design is not enough. Sector-specific cyber threat sharing has structural properties that generic distributed systems do not capture: the trust anchors are real-world institutions with legal mandates, the topology reflects operational realities (NAT, firewall, OT segmentation), the threat model is informed by named adversaries and named incidents, and the unit of accountability is the organization, not the node.

The Norwegian energy sector — the first deployment — is expected to require **multiple co-equal trust anchors**, reflecting the fact that authority in this sector is not held by any single institution. KraftCERT is the sector-CSIRT and the natural anchor for operational threat intelligence. NVE has regulatory authority and may be a co-equal anchor for that reason, particularly for peers whose participation depends on regulatory cover. Other anchors (NSM for critical-infrastructure framing, others) may follow the same model. Co-equal means each anchor can independently issue invite tokens, sign identities, and revoke peers within governance rules established between the anchors. The architecture supports one or more anchors uniformly; single-anchor is a special case, not a separate design.

Other sectors — finance, health, transportation — can run their own Nordlys deployments. Each sector deployment is fully independent: its own anchors, its own Varde infrastructure, its own peer organizations, its own audit log, its own threat model. Sector deployments do not share state, do not share trust, and do not federate by default. Cross-sector event federation is explicitly out of scope for the current version and would be its own architectural decision.

Removing sector-awareness in pursuit of a single multi-sector or multi-tenant deployment would weaken the design, not strengthen it. We are building one tool that can be deployed once per sector, well, with first-class support for the multi-anchor reality of those sectors.

**What would violate this.** A design change that introduces a sector field on events to multiplex multiple sectors within a single deployment. A trust model that assumes a single anchor per deployment as a permanent property rather than a special case. An abstraction that hides the trust anchors' roles behind a generic "identity provider" interface that erases their distinct institutional authority. Any change motivated by "this would let us serve multiple sectors at once" without a corresponding decision to take on cross-sector federation as a deliberate scope expansion. Forcing the multi-anchor governance model to be uniform across sectors when sectors will in fact differ.

**Current implementation evidence.** The trust anchor in v1 is KraftCERT, single-anchor; the v1 invite-token, identity-signing, and scenario-package flows are anchor-specific in implementation but anchor-agnostic in design. Multi-anchor support is on the roadmap for v1.x and is expected to be required for Statnett's participation in particular, due to regulatory dependencies. The Varde-relay is named after the Norwegian coastal warning system and exists because peers behind strict firewalls are the norm in OT environments. "Peer" is used to mean organization throughout onboarding, revocation, and accountability flows. Threat model references concrete sector incidents (Poland, December 2025) and concrete OT equipment patterns (ABB Relion exploitation). Out-of-scope items reflect Norwegian regulatory context (Sikkerhetsloven, kraftberedskapsforskriften, NIS2).

---

## 8. Auditability is a precondition, not a feature

**Statement.** Anything that cannot be audited, we do not deploy in this sector. This is structural, not aspirational.

**What it means.** Energy sector security is a regulated, observed domain. Operators, regulators, and external auditors must be able to reconstruct after the fact: who said what, when, who relayed it, who acted on it, who validated whom, **and which trust anchor authorized that validation**. This dictates architecture before features, not the other way around. Audit logs are append-only and partitioned for retention. Events carry their relay path. Revocations are themselves signed events, not side-channel commands. In a multi-anchor deployment, every authorization decision records which anchor signed it, so that audit reconstruction can answer not just "who was let in" but "who let them in." The entire stack is open source so that auditors can read the implementation, not just the design. We do not have the option of "we will add observability in a later release."

**What would violate this.** Any feature that introduces a state mutation invisible to the audit log. Any closed-source dependency on the trust path. Any operation whose authorization is based on a side-channel — environment variable, config flag, hidden API — rather than a signed and verifiable record. Any "for performance" change that drops auditable detail without explicit retention-policy review. In a multi-anchor deployment, any flow where the audit log records "authorized" without recording *which* anchor authorized.

**Current implementation evidence.** Append-only `audit_log`, partitioned monthly, retention enforced by partition drop rather than row deletion. Every event signed at origin and verifiable post-hoc against the historical identity register. Path field on events records the relay chain (origin → relay → ...). Revocation is a signed event gossiped through the standard channel, not a separate administrative API. MIT license; the entire implementation is readable.

---

## 9. The core is what every peer needs; everything else is an extension

**Statement.** A capability belongs in the core if and only if every Nordlys peer needs it for basic mesh participation. Everything else is a signed extension, even if it is bundled by default. The core stays small and stable; functional reach is provided by extensions running with declared, reviewed permissions.

**What it means.** A security platform for the Norwegian energy sector — and any sector after — will be asked, over time, to do many things. Parse new log formats. Push events into operator ticketing systems. Render dashboards specific to one peer's workflow. Export to one regulator's report format. Integrate with one vendor's threat-intel feed. Run network scans on demand. Collect syslog from OT equipment. Most of these are valuable to *some* peers and irrelevant to others. Building each into the core would yield a large, slow, fragile core that no individual peer can audit and that ships at the speed of the slowest contributor. Building each as a separate fork would fragment the sector and make trust-model claims meaningless across deployments.

The third path — and the one this tenet commits us to — is a small core that does the things every peer must do (mesh transport, signing, identity, audit, gossip, storage of mesh objects), and a first-class extension surface for everything else. The litmus test for any new capability is precise: *"does every peer in the mesh need this for basic mesh participation?"* If no, it is an extension. The answer is rarely "yes" and never "yes, eventually" — eventual universality is not universality.

Some extensions are bundled by default in the standard distribution. Bundled does not mean active: a default-installed extension is still gated by an explicit operator decision to enable it before it can act on data. This preserves the property that a peer's running surface is exactly what its operator chose, not what came in the box.

Every extension carries a signed manifest declaring its kind, its capabilities, and the permissions it needs. The core enforces the declared permissions; extensions cannot quietly gain capabilities they did not declare. The signature requirement of Tenet 1 applies to extensions as it does to mesh objects: the path code travels is untrusted; the signature is what grants it authority. Extension publishers are scoped to the deployment's trust anchors (Tenet 7), so plugin trust composes with mesh trust rather than replacing it.

Adopting this tenet has a retroactive consequence for the current architecture. The collector service (syslog ingestion, scenario matching) and the scanner service (nmap-driven asset discovery) are not capabilities every peer needs for basic mesh participation. They were built into the core because the extension surface did not yet exist. Under this tenet they are reference extensions, not core services — bundled by default, enabled by operator choice, but architecturally outside the core. The same applies to vulnerability management, indicator handling beyond the gossip primitive, and any future capability with the same shape: useful to many peers, required by none.

**What would violate this.** Adding a new capability to a core service when the answer to "does every peer need this?" is no. Letting an extension run code without a signed manifest, even temporarily, even "for development". An extension permission model that grants more authority than the manifest declares, by oversight or by configuration. A core service that grows endpoints to serve one peer's workflow rather than parameterizing the workflow as an extension. Treating "we will refactor this into an extension later" as an acceptable shortcut — extensibility built after the fact is harder than extensibility designed in. A trust-anchor signature on an extension manifest where the anchor has not actually reviewed the manifest's declared permissions; that turns Tenet 1's signature requirement into a rubber stamp. Marking an extension as default-active rather than default-installed-but-disabled; bundling does not equal activation.

**Current implementation evidence.** The core, after this tenet is adopted, comprises four services: api-gateway, core-svc, mesh-svc, varde-svc. These together implement the mesh protocol, the trust model, the signing path, the storage layer for mesh objects, the audit log, and the gossip primitives. Capabilities not in this list — syslog ingestion (currently collector-svc), scenario matching (currently collector-svc), network scanning (currently scanner-svc), vulnerability handling beyond gossip transport, regulator-specific exports, vendor-specific log adapters, third-party threat-intel bridges, per-peer SOAR playbooks, peer-specific dashboards — are extensions. The collector and scanner services that exist today are the first reference extensions, bundled by default, gated by operator enable.

---

## 10. Distribution is access control, not metadata

**Statement.** The TLP (Traffic Light Protocol) distribution label on every object is a first-class access-control constraint, enforced at every propagation boundary. It is not advisory, not informational, and not something a downstream consumer may reinterpret.

**What it means.** FIRST's TLP v2.0 defines four distribution levels — RED, AMBER (+STRICT), GREEN, CLEAR — each describing who may receive the object. In many platforms these labels are carried as advisory metadata: a field the UI renders, but the transport ignores. In Nordlys the distribution label is structural. It is part of the signed canonical form of the object (Tenet 1), which means it cannot be altered after signing without invalidating the signature. It is evaluated at every propagation boundary — signing time, mesh fan-out, Varde gossip relay, API gateway, database query — and a failure at any one boundary does not grant access, because the next boundary enforces independently. This is defence in depth applied to information sharing, and it is the property that makes the system trustworthy enough for peers to share RED and AMBER material at all.

Three rules follow from this principle and are non-negotiable:

1. **Distribution can never be widened without the source's explicit consent.** A downstream peer, relay, or extension may narrow an object's distribution (e.g. treat a GREEN object as AMBER internally) but may never widen it. Widening requires a new object, signed by the original source, with the wider label. The architecture does not provide a "re-label" operation; it provides a "re-publish" operation, which is deliberate.

2. **Secure by default.** An inbound object with a missing, malformed, or unrecognised distribution label is rejected, not defaulted. On creation, when no label is specified by the operator, the system defaults to GREEN (community-scoped) — shared within the mesh but not beyond it. The asymmetry is intentional: inbound strictness catches protocol errors and downgrade attacks; creation-time defaulting prevents accidental over-restriction that would make the system useless.

3. **High-water mark on derived objects.** When an object is derived from one or more inputs (e.g. a correlation event produced from two indicators), the derived object inherits the maximum restriction of its inputs. An event derived from one GREEN and one AMBER indicator is AMBER. This is enforced at creation time by the core service, not left to the extension or operator producing the derived object.

The layered enforcement deserves emphasis. At signing time, the label is canonicalised into the signed payload. At mesh fan-out, the mesh service checks the label against the recipient peer's distribution entitlement before forwarding. At the Varde gossip layer, relays enforce the same check — a relay that receives a RED object addressed to peers it does not serve drops it rather than storing it. At the API layer, queries are scoped by the caller's distribution clearance; an API consumer authorised only to GREEN never sees AMBER or RED objects in query results, even if they exist in storage. At the database layer, row-level predicates ensure that a query bug in the API layer cannot leak restricted objects. No single layer is trusted to be the only enforcer. If one fails — a code bug, a misconfiguration, a compromised relay — the next layer catches the violation. This is the same disposition as Tenet 1 (trust lives in signatures) applied to the distribution dimension: no single point of trust, no single point of failure.

**What would violate this.** Any path where a distribution label is advisory rather than enforced. Any code that copies an object and strips or changes its distribution label without producing a new signature from the original source. A relay that forwards objects without checking distribution entitlements because "the sender already checked." An API endpoint that returns objects across distribution levels and relies on the frontend to filter. A derived-object creation path that does not enforce the high-water mark rule. A default of CLEAR (unrestricted) on creation, which would make accidental over-sharing the common case. Any "admin override" that bypasses distribution enforcement without producing a signed, auditable re-publication — overrides that are invisible to the audit log are indistinguishable from exfiltration (Tenet 8). Treating TLP as a UI concern rather than a transport and storage concern.

**Current implementation evidence.** Distribution enforcement at this depth is a design commitment, not yet fully implemented across all layers. The signed canonical form includes the distribution field, so Tenet 1's signature protection already applies. Mesh fan-out filtering by distribution is specified in the gossip protocol design. API-layer and database-layer enforcement are on the implementation roadmap for v1.x and will be required before any peer shares AMBER or RED material through the mesh. The high-water mark rule is specified for derived objects but not yet enforced automatically — the current collector produces GREEN-only events. Full layered enforcement is a precondition for operational deployment with restricted material, not a post-launch enhancement.

---

## 11. Least privilege by default

**Statement.** Every actor in the system — human operator, extension, service process — operates with the minimum set of privileges required for its function. The default is deny.

**What it means.** Authority in Nordlys is not inherited from proximity, from role in the organisation, or from being "inside the perimeter." It is granted explicitly, scoped narrowly, and revocable independently. This applies uniformly across three categories of actor, each with its own enforcement mechanism.

*Operators* are subject to role-based access control with a maximum TLP clearance level. An operator with clearance GREEN sees objects classified at GREEN and CLEAR — never AMBER or RED. A new operator account starts with the minimum viable privilege set: read access to mesh health and public-facing objects, nothing more. Privilege elevation — a higher clearance, write access, administrative capability — requires explicit action by an authorised administrator. That action is itself a signed, auditable event (Tenet 8).

*Extensions* declare their required permissions in their signed manifest (Tenet 9). The runtime treats the manifest as a ceiling, not a suggestion. An extension that declares `read:events` and `write:extension-state` cannot access signing keys, cannot call the identity API, cannot open network sockets beyond what the declared capabilities permit. The permission model is allowlist-only: capabilities not declared are denied, not prompted for at runtime. A new extension starts with no permissions until an operator explicitly grants them; bundled-by-default does not mean permitted-by-default.

*Service processes* within a node follow the same principle at the process boundary. The mesh service carries signed objects but never holds private signing keys; it cannot forge signatures even if compromised. The collector service submits event candidates to the core service's ingestion endpoint; it cannot write to the events table directly (Tenet 5). Each service's access to database tables, key material, and network interfaces is scoped to what its function requires, enforced by the runtime, and enumerable by an auditor.

The principle operates at two levels that must not be confused. At the *mesh level*, Tenet 10 governs which peers see which objects — that is inter-organisational scoping. At the *node level*, this tenet governs which users and processes within a single peer's deployment see which objects — that is intra-organisational scoping. Both are necessary. A peer that enforces strict mesh-level access control but grants every local operator full access to every object has not implemented least privilege; it has implemented it halfway.

Privilege escalation — an operator gaining higher clearance, an extension being granted additional permissions, a service process being given access to new key material — is never automatic and never silent. It requires explicit action by an actor who is themselves authorised to grant that specific privilege. The escalation, the granter, the grantee, and the scope of what was granted are recorded in the audit log as a signed event. Escalation that bypasses this path is a security incident, not an edge case.

**What would violate this.** A new operator account that starts with administrative privileges or full TLP clearance "for convenience during onboarding." An extension that gains capabilities beyond its manifest through a configuration flag, an environment variable, or an undeclared API. A service process that holds key material it does not need for its function. A permission model that defaults to allow and requires explicit deny. Any privilege change that is not audit-logged. Any actor whose effective permissions cannot be enumerated by an auditor at any point in time. A "superuser" mode that bypasses RBAC for local debugging without itself being scoped, time-limited, and logged.

**Current implementation evidence.** Least privilege at this depth is a design commitment. Process-level isolation exists in the architecture: the mesh service does not hold signing keys, the collector service does not write to mesh-object tables, and the core service's API surface mediates all writes. Operator-level RBAC with TLP-based clearance is specified as a requirement for v1.x and is a precondition for deployments where operators handle AMBER or RED material. Extension-level permission enforcement depends on the manifest format and capability language specified in ADR-0017. Full least-privilege enforcement across all three actor categories is a precondition for operational deployment in regulated environments, not a post-launch enhancement.

---

## 12. Idempotent operations through intrinsic object identity

**Statement.** Every object's identity is derived from its content or a stable external reference, never from database sequence numbers, insertion order, or any other artefact of a particular node's local state.

**What it means.** When two nodes independently ingest the same CVE, the same STIX indicator, or the same operator-authored event, they must arrive at the same object with the same identity. This is what makes mesh convergence (Tenet 4) mechanically achievable rather than aspirational: peers do not need to coordinate to avoid duplicates, because duplicates are defined away by construction. Re-processing the same input — whether due to a retry, a re-crawl, or a sync from a second peer — produces an object that the dedup layer recognises and collapses.

This principle extends beyond dedup. Idempotent identity means that the order in which objects arrive is irrelevant to the final state. A node that was offline for a week and then syncs should converge to the same object set as a node that received every object in real time. It means the storage layer can be rebuilt from scratch — critical for the planned Go port — and the resulting database will be identical, object for object, to one that was migrated in place.

The practical corollary is that no component may mint identity from a local counter, an auto-increment column, or a wall-clock timestamp. Identity comes from content hashes, from `(source, external_ref)` pairs for externally-sourced objects, or from the signing key and a deterministic payload for operator-authored objects. Where a content hash is too expensive or the content is mutable, a stable external reference serves the same purpose — but the reference must itself be deterministic and globally meaningful, not local to one node.

**What would violate this.** Generating a UUID at insertion time rather than deriving it from the object's content or external reference. Using database row IDs in any cross-node protocol. Producing different object identities when the same raw input is processed twice. Any code path where replaying an ingest operation creates a second, distinct object rather than recognising the existing one. A migration that changes object identities.

**Current implementation evidence.** Collectors use `(source, external_ref)` pairs for dedup, so re-crawling the same advisory produces the same object. UUID-based dedup at the database layer collapses duplicates on ingest. JCS canonicalisation (RFC 8785) ensures that the byte-level input to signing and hashing is deterministic regardless of field ordering. The Go port design treats content-addressed identity as a foundational assumption. Full content-hash-based identity for all object types remains a design commitment — some objects still rely on external-ref dedup rather than pure content derivation.

---

## 13. Network exposure inversely proportional to privilege

**Statement.** The more privilege a component holds — signing keys, write authority, access to unredacted data — the less network surface it may expose; the most network-exposed components hold no keys and can forge nothing.

**What it means.** This is the architectural dual of Tenet 1. Where Tenet 1 says trust lives in signatures, this tenet dictates where signatures may be created: only in components that are shielded from direct network contact. The signing key is the root of a node's authority in the mesh. If it is compromised, every object the node has ever signed or will sign is in question. Therefore the component that holds it — `core-svc` — must be the least reachable component in the deployment, not the most.

The architecture enforces a strict gradient. At the outer edge, Vardes face the public internet but hold no private keys, cannot author objects, and can only relay and verify. One step inward, `mesh-svc` manages peer connections but delegates all signing to `core-svc` over an internal channel. The API gateway faces operator browsers but never touches signing material — it forwards requests inward. At the centre, `core-svc` holds the node's private key but accepts connections only from co-located services, never from the network. This gradient means that compromising the most exposed component yields the least authority, and reaching the most privileged component requires breaching multiple layers.

The principle also constrains future design. Any new component that needs network exposure must not be granted signing capability. Any component that needs signing capability must not be granted a listening socket reachable from outside the node. If a feature seems to require both, the feature must be split into two components — one that faces the network, one that holds the key — connected by a narrow internal interface.

**What would violate this.** Giving `core-svc` a public-facing API endpoint. Embedding the node's signing key in `mesh-svc` or a Varde for "convenience." A deployment where a single process both terminates TLS from the internet and holds the private signing key. Any component that can be reached from outside the node and can also forge signed mesh objects. An architecture where compromising the most exposed component grants write authority to the mesh.

**Current implementation evidence.** `core-svc` holds the node's Ed25519 private key and is reachable only over the internal Docker network. `mesh-svc` terminates peer connections but holds no signing material — it calls `core-svc` to sign outbound objects. Vardes are designed as internet-facing relays that verify inbound signatures but cannot produce them. The API gateway authenticates operators but delegates object signing to `core-svc`. This gradient is present in the current architecture and is a hard constraint for the Go port.

---

## 14. Canonical form is the signature's substrate

**Statement.** Every signed object has exactly one canonical byte-level representation, and that representation is what gets signed, what gets hashed for identity, and what gets compared for equality — no exceptions.

**What it means.** A signature is only as trustworthy as the definition of what it covers. If the same logical object can be serialised in multiple ways — keys reordered, whitespace varied, optional fields omitted or defaulted differently — then a signature over one serialisation says nothing about another. Worse, if metadata can travel alongside a signed object without being part of the signed form, that metadata inherits the object's apparent authority while being entirely unverified. This tenet eliminates both risks by requiring a single, deterministic canonical form that is the exclusive input to all cryptographic operations.

For Nordlys this means JCS (RFC 8785) canonicalisation is not an optimisation or a convenience — it is a security boundary. The canonical form defines the scope of the signature. Every field that influences a consumer's decisions must be inside the canonical form and therefore inside the signature. This is particularly critical for TLP labels: because Tenet 10 requires TLP to be enforced cryptographically, the TLP field must be part of the canonical form. A TLP label that exists in the wire format but outside the canonical form would be an unsigned assertion travelling with signed authority — exactly the kind of in-band unsigned metadata that Tenet 1 prohibits.

The practical rule is simple: if a field is present in the serialised object that crosses a trust boundary, it is either inside the canonical form (and therefore signed) or it is explicitly marked as transport metadata and stripped before any trust decision. There is no middle ground. Extensions (Tenet 9) may add new fields to objects, but those fields must be included in the canonical form and covered by the signature. If an extension needs genuinely unsigned metadata — routing hints, relay timestamps, hop counts — that metadata must travel in an envelope outside the signed object, never inside it.

**What would violate this.** Two serialisation paths that produce different byte sequences for the same logical object. A field inside a signed object's JSON that is excluded from JCS canonicalisation and therefore unsigned. A TLP label that can be modified in transit without invalidating the signature. Any code path that computes an identity hash over a non-canonical representation. Introducing a binary wire format (e.g. Protobuf) for signed objects without defining a canonical mapping that is byte-for-byte equivalent across implementations. A Go implementation that produces a different canonical form than the Python implementation for the same logical object.

**Current implementation evidence.** JCS (RFC 8785) canonicalisation is used for all signed objects in the current implementation. The signing pipeline canonicalises before signing, and the verification pipeline canonicalises before verifying. TLP labels are included in the signed payload. The Go port is committed to using the same JCS canonicalisation, with cross-implementation test vectors to guarantee byte-level agreement. A formal canonical-form specification covering all object types is a design commitment not yet completed.

---

## When tenets conflict

The fourteen tenets do not always pull in the same direction. Nine common tensions, with how to resolve them:

**Bounded fanout (3) vs Mesh continuity (2).** Top-N selection with N=3 means a node has limited reachability if its three relays all fail. Increasing N improves continuity at the cost of fanout. The resolution is N as a configurable parameter with a sector-default that errs toward continuity (N≥3), but the principle "we choose a number, we do not say 'connect to everything'" is non-negotiable.

**Operational realism (6) vs Auditability (8).** Rate-limiting and frequency-reduction silently drop events when caps are exceeded. This is operationally correct, but it creates a class of events that exist briefly and are not audited. The resolution is: every drop is itself an audit event (logged, counted, exposed via metrics). The auditability requirement is preserved at the meta-level even where individual events are correctly suppressed.

**Mesh continuity (2) vs Sector-specific authority (7) under multi-anchor.** With co-equal anchors, mesh continuity argues for "any single anchor can authorize anything" (maximum availability). Sector authority argues for governance rules that may require coordination between anchors for some decisions (e.g. revocation of a major peer). The resolution is to keep operational decisions (signing routine identities, issuing invite tokens) as single-anchor-sufficient, and to reserve coordination for decisions whose stakes warrant the latency. The specific rules belong in a per-deployment governance document, not in the architecture itself.

**Extensibility (9) vs One writer per responsibility (5).** Extensions naturally want to write data. A webhook extension records its delivery state. A collector extension writes events. A vulnerability-management extension owns vulnerability records. Tenet 5 says every piece of state has a single writer. The resolution is layered: extensions never write directly to mesh-object tables (events, identities, revocations, audit log); those are written exclusively by core-svc, which enforces signature, canonicalisation, and rate-limit invariants for all callers — internal or extension. Extensions own their own state in extension-scoped tables that are explicitly partitioned from core state. A collector extension producing an event does so by submitting an unsigned candidate to core-svc's ingestion endpoint, exactly as an internal collector would; the writer of the events table is still core-svc. The tenet does not relax to make extensions easier to write; instead, the core-svc API surface is the contract through which all writes pass, internal and external alike.

**Distribution control (10) vs Mesh continuity (2).** Distribution enforcement can prevent an object from reaching a peer that would otherwise receive it — a RED event addressed to three peers will not propagate to the rest of the mesh, even if broader propagation would improve situational awareness. Mesh continuity argues for maximum replication; distribution control argues for minimum necessary access. The resolution is that distribution enforcement is a hard constraint and mesh continuity operates within it. The mesh remains continuous for the set of peers entitled to receive a given object; it does not sacrifice distribution control to achieve universal reachability. If a peer is not entitled to an object, the correct behaviour is that the peer never learns the object exists, not that it receives a redacted version. Redaction is a separate, source-initiated operation (re-publish at a wider distribution with reduced detail), not an automatic mesh behaviour.

**Distribution control (10) vs Extensibility (9).** Extensions that process, correlate, or enrich objects need access to the distribution label and must respect it. An extension that ingests AMBER indicators and produces a derived event must mark that event as AMBER or higher (high-water mark rule). An extension that exports data to an external system must enforce distribution constraints on the export path — an export extension that pushes events to a third-party SIEM must not export AMBER or RED events unless the SIEM's operators are within the distribution scope. The resolution is that the extension permission model (Tenet 9) includes distribution as a declared capability: an extension's manifest declares the maximum distribution level it is permitted to handle, and the core service enforces this at the ingestion and query boundaries. An extension declared as GREEN-only never receives AMBER or RED objects from the core API, regardless of what it requests. This composes with the layered enforcement of Tenet 10: the extension's declared scope is one more enforcement layer, not a replacement for the others.

**Least privilege (11) vs Operational realism (6).** In an emergency — an active intrusion, a critical indicator that must reach all operators immediately — the operator who happens to be on-call may lack the clearance to see the relevant RED objects or to perform the required administrative action. Strict least-privilege says they cannot act; operational realism says the incident does not wait for the right person to wake up. The resolution is emergency escalation: a time-bounded, scope-limited privilege elevation that an authorised administrator can grant (or that a break-glass procedure can invoke when no administrator is reachable). The escalation is audit-logged with the escalation reason, the scope granted, the duration, and the granting authority. The escalation expires automatically. The audit record is immutable. The principle is not suspended — it is bent in a controlled, visible, reversible way, and the bend itself becomes part of the audit trail. A system that cannot accommodate emergencies without disabling access control has not taken operational realism seriously; a system that accommodates emergencies by silently granting permanent privilege has not taken least privilege seriously.

**Idempotent identity (12) vs Operational realism (6).** Pure content-addressed identity — hashing full object bodies — can be expensive for large objects and adds latency to every ingest path. The resolution is to use the cheapest deterministic identity that is still globally unique: `(source, external_ref)` pairs for externally-sourced objects, and content hashes only where no stable external reference exists. The system should never sacrifice idempotency, but it may choose the most economical derivation strategy. If a cheaper identity scheme risks collisions, fall back to content hashing — correctness dominates performance.

**Privilege gradient (13) vs Mesh continuity (2).** Isolating high-privilege components from the network can create availability bottlenecks: if `core-svc` is the only component that can sign, and it is unreachable, the node cannot produce objects. The resolution is redundancy and queue-based decoupling, not relaxation of the exposure rule. Outbound objects can be queued and signed asynchronously; the node can buffer requests during brief `core-svc` restarts. What must never happen is moving the signing key outward to a more exposed component for the sake of availability. Availability is solved with operational patterns (retries, queues, health checks), not by widening the attack surface.

When in doubt, the resolution is rarely "pick one and ignore the other" — it is to find the form of the design where both are honored, even if the form is more complex than either tenet alone would suggest.

---

## When to update the tenets

Tenets are amended only when the team agrees that the architecture's foundational disposition has changed, not when an individual decision needs different framing. The bar is high. An amendment is itself an ADR (e.g. ADR-NNNN: "Amend Tenet 7 to support cross-sector federation") and triggers a review of every existing ADR for consistency. The intent is that the tenets here outlast any individual implementation, including the current codebase, the planned Go port, and any subsequent refactors.

