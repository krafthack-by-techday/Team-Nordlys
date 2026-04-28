"""Laster scenario-pakker, anvender peer-overstyringer, og evaluerer
regler mot innkommende syslog-meldinger.

Pakkene er YAML-filer med navngitte deteksjonsregler. Hver regel har:
- regex (med valgfrie navngitte capture-grupper)
- valgfri aggregat-policy (vindu + terskel + nøkkel)
- modenhetsnivå som styrer default-modus (live / shadow)
- severity som blir nodens event-severity

Falsk-positiv-vern:
- experimental + fp_likelihood: high → starter alltid i shadow uansett peer-config
- peer-config kan tvinge en regel til shadow, men ikke heve over pakkens severity
- aggregeringen forhindrer at hver enkelt event-melding blir et eget STK-event
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

log = logging.getLogger("kollektor.scenarios")

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


@dataclass
class Scenario:
    pack: str
    id: str
    title: str
    description: str
    severity: str
    regex: re.Pattern
    aggregate: Optional[dict] = None  # {"window_seconds", "threshold", "key": [...]}
    mode: str = "live"  # live | shadow
    maturity: str = "stable"
    fp_likelihood: str = "low"
    mitre: list[str] = field(default_factory=list)
    external_ref_template: str = ""

    # Aggregation state
    _hits: dict = field(default_factory=lambda: defaultdict(list))  # key_tuple -> [timestamps]
    _hits_lock: threading.Lock = field(default_factory=threading.Lock)


def _resolve_default_mode(maturity: str, fp_likelihood: str, declared: str) -> str:
    """Force shadow for risky defaults, regardless of pack author's claim."""
    if declared == "shadow":
        return "shadow"
    if maturity == "experimental" or fp_likelihood == "high":
        return "shadow"
    return "live"


class ScenarioEngine:
    def __init__(self):
        self.scenarios: list[Scenario] = []

    def load(
        self,
        scenarios_dir: Path,
        active_packs: list[str],
        overrides: dict,
        require_signature: bool = False,
        kraftcert_pubkey_path: Optional[Path] = None,
    ) -> None:
        """Load scenario packs from disk. Active packs are matched by `pack` field."""
        loaded_count = 0
        for path in sorted(scenarios_dir.glob("*.yaml")):
            sig_path = path.with_suffix(".yaml.sig")
            if require_signature:
                if not sig_path.exists() or not kraftcert_pubkey_path:
                    log.error("rejecting unsigned pack %s (signature required)", path.name)
                    continue
                if not _verify_pack_signature(path, sig_path, kraftcert_pubkey_path):
                    log.error("rejecting pack %s — bad signature", path.name)
                    continue
            elif sig_path.exists() and kraftcert_pubkey_path:
                if not _verify_pack_signature(path, sig_path, kraftcert_pubkey_path):
                    log.warning("pack %s has invalid signature — loading anyway (unsigned-ok mode)", path.name)

            try:
                doc = yaml.safe_load(path.read_text())
            except Exception as e:
                log.error("failed to parse %s: %s", path.name, e)
                continue

            pack_name = doc.get("pack")
            if not pack_name or pack_name not in active_packs:
                log.info("skipping pack %s (not in active_packs)", pack_name)
                continue

            for sc_def in doc.get("scenarios", []):
                sc = self._build_scenario(pack_name, sc_def, overrides)
                if sc is not None:
                    self.scenarios.append(sc)
                    loaded_count += 1

        log.info("loaded %d scenarios from %s", loaded_count, scenarios_dir)

    def _build_scenario(self, pack_name: str, sc_def: dict, overrides: dict) -> Optional[Scenario]:
        sid = sc_def.get("id")
        if not sid:
            log.warning("scenario missing id in pack %s", pack_name)
            return None

        ovr = overrides.get(sid, {}) or {}
        if ovr.get("disabled"):
            log.info("scenario %s disabled by peer-config", sid)
            return None

        try:
            regex = re.compile(sc_def["match"]["regex"])
        except (KeyError, re.error) as e:
            log.error("scenario %s has invalid regex: %s", sid, e)
            return None

        # Severity: peer can lower but not raise
        pack_sev = sc_def.get("severity", "medium")
        if pack_sev not in SEVERITY_RANK:
            log.warning("scenario %s has unknown severity %s", sid, pack_sev)
            return None
        severity = pack_sev
        if "severity" in ovr and ovr["severity"] in SEVERITY_RANK:
            if SEVERITY_RANK[ovr["severity"]] <= SEVERITY_RANK[pack_sev]:
                severity = ovr["severity"]
            else:
                log.warning(
                    "ignoring override of %s severity %s -> %s (cannot raise above pack)",
                    sid, pack_sev, ovr["severity"],
                )

        declared_mode = sc_def.get("default_mode", "live")
        mode = _resolve_default_mode(
            sc_def.get("maturity", "stable"),
            sc_def.get("fp_likelihood", "low"),
            declared_mode,
        )
        if ovr.get("mode") == "shadow":
            mode = "shadow"

        return Scenario(
            pack=pack_name,
            id=sid,
            title=sc_def.get("title", sid),
            description=sc_def.get("description", ""),
            severity=severity,
            regex=regex,
            aggregate=sc_def.get("aggregate"),
            mode=mode,
            maturity=sc_def.get("maturity", "stable"),
            fp_likelihood=sc_def.get("fp_likelihood", "low"),
            mitre=sc_def.get("mitre", []) or [],
            external_ref_template=sc_def.get("external_ref_template", ""),
        )

    def evaluate(self, message: str, host: str, severity_hint: str) -> list[dict]:
        """Run all scenarios against a syslog message. Returns 0 or more event payloads.

        Returned dicts have keys: title, description, severity, source, external_ref,
        scenario_id, _mode (used by caller to decide whether to gossip).
        """
        out = []
        for sc in self.scenarios:
            m = sc.regex.search(message)
            if not m:
                continue
            captures = m.groupdict() or {}

            if sc.aggregate:
                hit = self._aggregate(sc, captures, host)
                if hit is None:
                    continue
                ext_ref = _format_template(sc.external_ref_template, {**captures, **hit})
                description = (
                    f"{sc.description}\n\n"
                    f"Aggregert: {hit['count']} hendelser i vinduet "
                    f"({hit['window_seconds']}s, key={hit['key_value']}).\n"
                    f"Siste melding: {message.strip()}"
                )
            else:
                window_start = int(time.time())
                ext_ref = _format_template(
                    sc.external_ref_template, {**captures, "window_start": window_start}
                )
                description = f"{sc.description}\n\nSyslog: {message.strip()}"

            out.append({
                "title": sc.title,
                "description": description,
                "severity": sc.severity,
                "source": "syslog",
                "external_ref": ext_ref,
                "scenario_id": sc.id,
                "_mode": sc.mode,
                "_pack": sc.pack,
                "_mitre": sc.mitre,
            })
        return out

    def _aggregate(self, sc: Scenario, captures: dict, host: str) -> Optional[dict]:
        agg = sc.aggregate or {}
        window = int(agg.get("window_seconds", 60))
        threshold = int(agg.get("threshold", 5))
        key_fields = agg.get("key", [])

        key_value = "|".join(captures.get(k, host if k == "host" else "") for k in key_fields) or host
        key_tuple = (sc.id, key_value)

        now = time.time()
        with sc._hits_lock:
            hits = sc._hits[key_tuple]
            hits = [t for t in hits if now - t < window]
            hits.append(now)
            sc._hits[key_tuple] = hits

            if len(hits) < threshold:
                return None
            # Threshold met: clear hits to avoid emitting again until next window fills
            sc._hits[key_tuple] = []
            return {
                "count": len(hits),
                "window_seconds": window,
                "key_value": key_value,
                "window_start": int(hits[0]),
            }


def _format_template(tpl: str, values: dict) -> str:
    if not tpl:
        return ""
    try:
        return tpl.format(**{k: (v or "") for k, v in values.items()})
    except KeyError:
        return tpl


def _verify_pack_signature(yaml_path: Path, sig_path: Path, pubkey_path: Path) -> bool:
    """Verify a base64-encoded RSA-SHA256 signature over the YAML file content."""
    import base64
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    try:
        pub = serialization.load_pem_public_key(pubkey_path.read_bytes())
        sig = base64.b64decode(sig_path.read_text().strip())
        pub.verify(sig, yaml_path.read_bytes(), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        return False
