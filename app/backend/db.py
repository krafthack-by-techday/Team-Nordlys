import os
import sqlite3
import threading

DB_PATH = os.environ.get("DB_PATH", "/data/stk.db")

_local = threading.local()


def get_db() -> sqlite3.Connection:
    """Return a per-thread SQLite connection."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        _local.conn = conn
    return conn


def _column_names(db: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            company TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            severity TEXT DEFAULT 'medium',
            created_at TEXT NOT NULL,
            signature TEXT DEFAULT '',
            source TEXT DEFAULT 'manual',
            external_ref TEXT DEFAULT '',
            scenario_id TEXT DEFAULT ''
        )
    """)

    # Forward-compatible migration for existing databases.
    cols = _column_names(db, "events")
    for col in ("source", "external_ref", "scenario_id"):
        if col not in cols:
            default = "manual" if col == "source" else ""
            db.execute(f"ALTER TABLE events ADD COLUMN {col} TEXT DEFAULT '{default}'")

    db.execute("CREATE INDEX IF NOT EXISTS idx_events_external_ref ON events(source, external_ref)")

    # ── Indicators (IoC) ────────────────────────────────────────────
    db.execute("""
        CREATE TABLE IF NOT EXISTS indicators (
            id TEXT PRIMARY KEY,
            node_id TEXT NOT NULL,
            company TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'ip',
            value TEXT NOT NULL,
            tlp TEXT NOT NULL DEFAULT 'AMBER',
            description TEXT DEFAULT '',
            severity TEXT DEFAULT 'medium',
            created_at TEXT NOT NULL,
            signature TEXT DEFAULT ''
        )
    """)
    db.execute("CREATE INDEX IF NOT EXISTS idx_indicators_created ON indicators(created_at)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_indicators_tlp ON indicators(tlp)")

    # ── Chat messages (per-event discussion) ────────────────────────
    db.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            company TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            signature TEXT DEFAULT ''
        )
    """)
    db.execute("CREATE INDEX IF NOT EXISTS idx_chat_event ON chat_messages(event_id, created_at)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at)")

    # ── Vulnerabilities ─────────────────────────────────────────────
    db.execute("""
        CREATE TABLE IF NOT EXISTS vulnerabilities (
            id TEXT PRIMARY KEY,
            cve_id TEXT NOT NULL DEFAULT '',
            cvss_score REAL DEFAULT 0.0,
            severity TEXT DEFAULT 'medium',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            asset TEXT DEFAULT '',
            status TEXT DEFAULT 'open',
            created_at TEXT NOT NULL
        )
    """)
    db.execute("CREATE INDEX IF NOT EXISTS idx_vuln_status ON vulnerabilities(status)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities(severity)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_vuln_cve ON vulnerabilities(cve_id)")

    db.commit()


def seed_vulnerabilities():
    """Pre-populate known OT CVEs if the table is empty."""
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM vulnerabilities").fetchone()[0]
    if count > 0:
        return

    import uuid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    cves = [
        ("CVE-2023-2611", 9.8, "critical", "ABB Relion 615/620 — Uautentisert tilgang",
         "Uautentisert ekstern tilgang til vernreleets konfigurasjon via HMI-grensesnitt. Ingen pålogging kreves.",
         "ABB Relion 615 serie"),
        ("CVE-2022-31806", 9.8, "critical", "CODESYS Runtime — Standardpassord",
         "CODESYS V3 runtime bruker svakt standardpassord som gir full kontroll over PLC-logikk.",
         "CODESYS V3 PLC-er"),
        ("CVE-2024-3400", 10.0, "critical", "Palo Alto PAN-OS — Command Injection",
         "Uautentisert kommandoinjeksjon via GlobalProtect-gateway. Aktivt utnyttet i norsk infrastruktur.",
         "Palo Alto brannmur"),
        ("CVE-2023-3595", 9.8, "critical", "Rockwell ControlLogix — Remote Code Execution",
         "Kritisk RCE i Rockwell ControlLogix/GuardLogix. Kan endre PLC-program uten autentisering.",
         "Rockwell ControlLogix 1756"),
        ("CVE-2022-2097", 5.3, "medium", "OpenSSL AES-OCB — Ukrypterte bytes",
         "AES-OCB-modus krypterer ikke alle bytes på 32-bit x86. Relevant for OT-systemer med eldre hardware.",
         "OT gateway (OpenSSL)"),
        ("CVE-2023-46747", 9.8, "critical", "F5 BIG-IP — Autentiseringsbypass",
         "Undone AJ-AJAX-endepunkt lar angripere omgå autentisering og kjøre vilkårlig kode.",
         "F5 BIG-IP (DMZ)"),
        ("CVE-2024-21762", 9.6, "critical", "Fortinet FortiOS — Out-of-bound Write",
         "SSL-VPN-sårbarhet som gir uautentisert RCE. Aktivt utnyttet mot norske virksomheter.",
         "FortiGate brannmur"),
        ("CVE-2023-0286", 7.4, "high", "OpenSSL X.509 — Type Confusion",
         "X.509 GeneralName type confusion kan lede til minnelekkasje eller DoS i TLS-autentisering.",
         "SCADA gateway (TLS)"),
        ("CVE-2022-22965", 9.8, "critical", "Spring4Shell — Remote Code Execution",
         "RCE i Spring Framework via data binding. Relevant for Java-baserte SCADA-webgrensesnitt.",
         "EMS webgrensesnitt"),
        ("CVE-2023-44487", 7.5, "high", "HTTP/2 Rapid Reset — DoS",
         "HTTP/2 rapid reset-angrep (DDoS). Kan ta ned OT-webgrensesnitt og API-endepunkter.",
         "Alle HTTP/2-tjenester"),
        ("CVE-2024-0012", 9.8, "critical", "Palo Alto PAN-OS — Authentication Bypass",
         "Bypass av autentisering i management-grensesnitt. Gir full admin-tilgang uten legitimering.",
         "Palo Alto (mgmt)"),
        ("CVE-2023-20198", 10.0, "critical", "Cisco IOS XE — Web UI Privilege Escalation",
         "Uautentisert opprettelse av admin-konto via web-UI. Aktivt utnyttet globalt.",
         "Cisco nettverksutstyr"),
    ]

    for cve_id, cvss, sev, title, desc, asset in cves:
        db.execute(
            """INSERT INTO vulnerabilities (id, cve_id, cvss_score, severity, title, description, asset, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
            (str(uuid.uuid4()), cve_id, cvss, sev, title, desc, asset, now),
        )
    db.commit()


def seed_indicators():
    """Pre-populate demo IoCs if the table is empty."""
    db = get_db()
    count = db.execute("SELECT COUNT(*) FROM indicators").fetchone()[0]
    if count > 0:
        return

    import uuid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    node_id = os.environ.get("NODE_ID", "unknown")
    company = os.environ.get("COMPANY", node_id)

    iocs = [
        ("ip", "185.220.101.34", "RED", "high", "Tor exit-node sett i scanning mot SCADA-port 502"),
        ("ip", "91.219.236.222", "RED", "critical", "C2-server brukt i Sandworm-kampanje mot energisektor"),
        ("ip", "45.155.205.99", "AMBER", "high", "Brute-force SSH mot OT-jumphost, 12k forsøk/time"),
        ("domain", "update-scada.kfraud.ru", "RED", "critical", "Phishing-domene som imiterer SCADA-oppdatering"),
        ("domain", "vpn-portal-kraft.com", "AMBER", "high", "Falsk VPN-portal som høster legitimering"),
        ("hash", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", "AMBER", "medium", "SHA-256 av malware-dropper funnet i e-postvedlegg"),
        ("hash", "deadbeef01234567deadbeef01234567", "RED", "critical", "Industroyer2 variant — SHA-256 av payload"),
        ("ip", "193.142.30.166", "AMBER", "medium", "Scanning mot IEC 104-porter (2404) fra dette IP-et"),
        ("ttp", "T1190 — Exploit Public-Facing Application", "GREEN", "medium", "Observert mot FortiGate VPN i norsk kraftsektor"),
        ("ttp", "T1078.004 — Valid Accounts: Cloud Accounts", "AMBER", "high", "Kompromittert Azure AD-konto brukt mot OT-tilgang"),
        ("domain", "cdn-kraftcert-no.xyz", "RED", "critical", "Typosquatting av KraftCERT — distribuerer bakdør"),
        ("ip", "23.106.215.76", "GREEN", "low", "Scanning mot DNS-porter — lav konfidens, overvåking"),
    ]

    for ioc_type, value, tlp, sev, desc in iocs:
        db.execute(
            """INSERT INTO indicators (id, node_id, company, type, value, tlp, description, severity, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), node_id, company, ioc_type, value, tlp, desc, sev, now),
        )
    db.commit()
