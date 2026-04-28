"""STK syslog-kollektor — sidecar-prosess.

Lytter på UDP for syslog (RFC 5424 og RFC 3164), evaluerer hver melding mot
de aktive scenario-pakkene, og POST-er kvalifiserte hendelser til den lokale
STK-noden via /events/ingest. Default-mode for risikable regler er
shadow — disse logges lokalt men gossipes ikke. Dette er falsk-positiv-vernet
som hindrer at en feilkonfigurert peer oversvømmer meshen.

Kjøring (fra inne i samme container/working dir som noden — backend/):
    python -m kollektor.syslog_adapter \\
        --node http://localhost:8000 \\
        --key s3cret \\
        --config kollektor/peer-config.yaml \\
        --listen 0.0.0.0:5514

Miljø-variabler (overstyres av CLI):
    STK_NODE_URL, STK_INGEST_KEY, STK_KOLLEKTOR_CONFIG,
    STK_LISTEN, STK_SCENARIOS_DIR
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import socket
import sys
import threading
import time
from pathlib import Path

import yaml

from .dedup import LRUDedup
from .post import IngestPoster
from .scenario_loader import ScenarioEngine

log = logging.getLogger("kollektor.syslog")

# ── Syslog parsers ─────────────────────────────────────────────────────────

# RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
RFC5424_RE = re.compile(
    r'^<(?P<pri>\d+)>(?P<ver>\d+)\s+(?P<ts>\S+)\s+(?P<host>\S+)\s+(?P<app>\S+)\s+'
    r'(?P<procid>\S+)\s+(?P<msgid>\S+)\s+(?:\[.*?\]|-)\s*(?P<msg>.*)$'
)

# RFC 3164: <PRI>MMM DD HH:MM:SS HOSTNAME TAG: MSG
RFC3164_RE = re.compile(
    r'^<(?P<pri>\d+)>(?P<ts>[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+'
    r'(?P<host>\S+)\s+(?P<msg>.*)$'
)

SYSLOG_SEVERITIES = {
    0: "critical", 1: "critical", 2: "critical",  # emergency / alert / critical
    3: "high",      # error
    4: "medium",    # warning
    5: "low", 6: "low", 7: "low",  # notice / info / debug
}


def _parse_syslog(raw: str) -> dict:
    m = RFC5424_RE.match(raw)
    if m:
        pri = int(m.group("pri"))
        return {
            "facility": pri >> 3,
            "severity": SYSLOG_SEVERITIES.get(pri & 7, "low"),
            "host": m.group("host"),
            "app": m.group("app"),
            "msg": m.group("msg"),
            "format": "rfc5424",
        }
    m = RFC3164_RE.match(raw)
    if m:
        pri = int(m.group("pri"))
        return {
            "facility": pri >> 3,
            "severity": SYSLOG_SEVERITIES.get(pri & 7, "low"),
            "host": m.group("host"),
            "app": "",
            "msg": m.group("msg"),
            "format": "rfc3164",
        }
    # Unparseable — pass through with defaults
    return {
        "facility": 16, "severity": "low", "host": "unknown", "app": "",
        "msg": raw, "format": "raw",
    }


# ── Adapter ────────────────────────────────────────────────────────────────


class SyslogKollektor:
    def __init__(
        self,
        listen_addr: tuple[str, int],
        poster: IngestPoster,
        engine: ScenarioEngine,
        shadow_log_path: Path,
    ):
        self.listen_addr = listen_addr
        self.poster = poster
        self.engine = engine
        self.shadow_log_path = shadow_log_path
        self.shadow_log_path.parent.mkdir(parents=True, exist_ok=True)
        self.dedup = LRUDedup(max_entries=2048, ttl_seconds=120)
        self._sock: socket.socket | None = None

    def serve_forever(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(self.listen_addr)
        self._sock = sock
        log.info("listening for syslog on %s:%d", *self.listen_addr)

        while True:
            try:
                data, addr = sock.recvfrom(8192)
            except OSError as e:
                log.warning("recv error: %s", e)
                continue
            try:
                self._handle(data.decode("utf-8", errors="replace"), addr)
            except Exception as e:
                log.exception("handler error: %s", e)

    def _handle(self, raw: str, addr: tuple) -> None:
        parsed = _parse_syslog(raw.strip())
        # Match-strengen er "<host> <msg>" slik at scenario-regex kan matche
        # device-prefiks (f.eks. RELION615) uavhengig av syslog-format.
        match_string = f"{parsed['host']} {parsed['msg']}".strip()
        events = self.engine.evaluate(match_string, parsed["host"], parsed["severity"])
        if not events:
            return

        for ev in events:
            # Local dedup: same (scenario, external_ref) within TTL → skip
            dedup_key = f"{ev['scenario_id']}|{ev.get('external_ref', '')}"
            if ev.get("external_ref") and self.dedup.seen(dedup_key):
                log.debug("dedup-skip %s", dedup_key)
                continue

            mode = ev.pop("_mode", "live")
            ev.pop("_pack", None)
            ev.pop("_mitre", None)

            if mode == "shadow":
                self._log_shadow(ev, parsed, addr)
                continue

            self.poster.send(ev)

    def _log_shadow(self, ev: dict, parsed: dict, addr: tuple) -> None:
        """Append a shadow-event to a local log so the operator can review.
        We deliberately do NOT post these to the node — that's the whole point."""
        line = (
            f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\t"
            f"scenario={ev['scenario_id']}\tseverity={ev['severity']}\t"
            f"src={addr[0]}\thost={parsed['host']}\ttitle={ev['title']}\n"
        )
        try:
            with open(self.shadow_log_path, "a") as f:
                f.write(line)
        except Exception as e:
            log.warning("shadow log write failed: %s", e)
        log.info("SHADOW (not gossiped): %s", ev["title"])


# ── Main ───────────────────────────────────────────────────────────────────


def _parse_listen(s: str) -> tuple[str, int]:
    host, _, port = s.rpartition(":")
    return (host or "0.0.0.0", int(port))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="STK syslog kollektor")
    parser.add_argument("--node", default=os.environ.get("STK_NODE_URL", "http://localhost:8000"),
                        help="URL til lokal STK-node")
    parser.add_argument("--key", default=os.environ.get("STK_INGEST_KEY", ""),
                        help="X-Ingest-Key (delt hemmelighet med noden)")
    parser.add_argument("--config", default=os.environ.get("STK_KOLLEKTOR_CONFIG", ""),
                        help="Sti til peer-config.yaml")
    parser.add_argument("--scenarios", default=os.environ.get(
                            "STK_SCENARIOS_DIR",
                            str(Path(__file__).parent / "scenarios"),
                        ),
                        help="Mappe med scenario-pakker")
    parser.add_argument("--listen", default=os.environ.get("STK_LISTEN", "0.0.0.0:5514"),
                        help="UDP listen-adresse for syslog")
    parser.add_argument("--require-signed-packs", action="store_true",
                        help="Avvis usignerte scenario-pakker")
    parser.add_argument("--kraftcert-pubkey", default="",
                        help="Sti til KraftCERT public key (PEM) for pakke-signaturverifikasjon")
    parser.add_argument("--shadow-log", default="/tmp/stk-kollektor-shadow.log",
                        help="Fil hvor shadow-events skrives lokalt")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    if not args.key:
        log.error("missing --key (or STK_INGEST_KEY)")
        return 2

    config = {}
    if args.config and Path(args.config).exists():
        config = yaml.safe_load(Path(args.config).read_text()) or {}

    active_packs = config.get("active_packs") or ["generic-syslog-ot"]
    overrides = config.get("overrides") or {}
    ingest_url = (config.get("node") or {}).get("ingest_url") or f"{args.node.rstrip('/')}/events/ingest"

    pubkey_path = Path(args.kraftcert_pubkey) if args.kraftcert_pubkey else None
    engine = ScenarioEngine()
    engine.load(
        scenarios_dir=Path(args.scenarios),
        active_packs=active_packs,
        overrides=overrides,
        require_signature=args.require_signed_packs,
        kraftcert_pubkey_path=pubkey_path,
    )

    if not engine.scenarios:
        log.warning("no scenarios loaded — kollektor will not emit events")

    poster = IngestPoster(ingest_url=ingest_url, ingest_key=args.key)
    kollektor = SyslogKollektor(
        listen_addr=_parse_listen(args.listen),
        poster=poster,
        engine=engine,
        shadow_log_path=Path(args.shadow_log),
    )

    try:
        kollektor.serve_forever()
    except KeyboardInterrupt:
        log.info("kollektor shutting down")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
